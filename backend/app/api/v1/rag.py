from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_pg
from app.services.rag import retrieve, embed_query

router = APIRouter()


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
                "source_id": c.source_id,
                "chunk_idx": c.chunk_idx,
                "score": c.score,
                "content": c.content,
                "equipment_tags": c.equipment_tags,
            }
            for c in chunks
        ],
    }


@router.get("/rag/status")
async def rag_status(pg: AsyncSession = Depends(get_pg)):
    """Return embedding corpus stats — how many chunks per source."""
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
