from fastapi import APIRouter, Depends, Query, UploadFile, File, Form, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_pg
from app.services.rag import retrieve, embed_query
from app.services.ingest import ingest_document, delete_source, SUPPORTED_EXTENSIONS
from app.log import get_logger

router = APIRouter()
log = get_logger("api.rag")

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB per file


@router.get("/rag/status")
async def rag_status(pg: AsyncSession = Depends(get_pg)):
    """Return embedding corpus stats — chunk count per source."""
    try:
        result = await pg.execute(
            text("""
                SELECT source_id, COUNT(*) AS chunks, MAX(created_at) AS last_ingested
                FROM embeddings
                GROUP BY source_id
                ORDER BY last_ingested DESC
            """)
        )
        rows = [dict(r._mapping) for r in result]
        for r in rows:
            if hasattr(r.get("last_ingested"), "isoformat"):
                r["last_ingested"] = r["last_ingested"].isoformat()
        total = sum(r["chunks"] for r in rows)
        return {"total_chunks": total, "sources": rows, "ready": total > 0}
    except Exception as e:
        return {"total_chunks": 0, "sources": [], "ready": False, "error": str(e)}


@router.get("/rag/search")
async def rag_search(
    q: str = Query(..., min_length=3, description="Natural language search query"),
    top_k: int = Query(default=5, ge=1, le=20),
    equipment_id: str | None = None,
    pg: AsyncSession = Depends(get_pg),
):
    """Semantic search over ingested document chunks."""
    chunks = await retrieve(pg, q, top_k=top_k, equipment_id=equipment_id)
    return {
        "query": q,
        "total": len(chunks),
        "results": [
            {
                "source_id":      c.source_id,
                "chunk_idx":      c.chunk_idx,
                "score":          c.score,
                "content":        c.content,
                "equipment_tags": c.equipment_tags,
            }
            for c in chunks
        ],
    }


@router.post("/rag/ingest")
async def rag_ingest(
    file: UploadFile = File(..., description="PDF, TXT, or MD document to ingest"),
    equipment_tags: str | None = Form(
        default=None,
        description="Comma-separated equipment IDs to tag this document (e.g. chiller_1,chiller_2). "
                    "Auto-detected from filename if omitted.",
    ),
    replace_existing: bool = Form(
        default=True,
        description="Delete existing chunks for this filename before re-ingesting.",
    ),
    pg: AsyncSession = Depends(get_pg),
):
    """
    Upload and ingest a document into the RAG knowledge base.

    - Extracts text (PDF via pypdf, TXT/MD as UTF-8)
    - Chunks into ~400-word segments with 80-word overlap
    - Embeds each chunk with nomic-embed-text via Ollama
    - Stores vectors in the embeddings table (pgvector)

    Returns the number of chunks stored and detected equipment tags.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required.")

    from pathlib import Path
    suffix = Path(file.filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Accepted: .pdf, .txt, .md",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(content) // 1024} KB). Max 50 MB.",
        )

    log.info("rag_ingest_request filename=%s size_kb=%s", file.filename, len(content) // 1024)

    try:
        result = await ingest_document(
            pg,
            content=content,
            filename=file.filename,
            equipment_tags=equipment_tags if equipment_tags else None,
            replace_existing=replace_existing,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {
        "status":         "ok",
        "source_id":      result["source_id"],
        "chunks_stored":  result["chunks_stored"],
        "equipment_tags": result["equipment_tags"],
        "message":        f"Ingested {result['chunks_stored']} chunks from '{file.filename}'.",
    }


@router.delete("/rag/sources/{source_id:path}")
async def rag_delete_source(
    source_id: str,
    pg: AsyncSession = Depends(get_pg),
):
    """Remove all chunks for a given source document from the knowledge base."""
    removed = await delete_source(pg, source_id)
    if removed == 0:
        raise HTTPException(status_code=404, detail=f"Source '{source_id}' not found.")
    log.info("rag_source_deleted source=%s chunks_removed=%s", source_id, removed)
    return {"status": "ok", "source_id": source_id, "chunks_removed": removed}
