"""
RAG document ingestion service — Phase 4.

Shared between POST /rag/ingest API endpoint and the CLI script
(backend/scripts/ingest_docs.py). Handles text extraction, chunking,
embedding via Ollama nomic-embed-text, and Postgres vector storage.
"""
import io
import uuid
from pathlib import Path

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.log import get_logger

log = get_logger("services.ingest")

EMBED_MODEL   = "nomic-embed-text"
EMBED_DIM     = 768
CHUNK_SIZE    = 400   # words per chunk
CHUNK_OVERLAP = 80    # words of overlap between consecutive chunks
EMBED_TIMEOUT = httpx.Timeout(60.0, connect=10.0)

SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".md"}

_EQUIPMENT_TAG_MAP = {
    "chiller_1":      ["chiller_1", "chiller 1"],
    "chiller_2":      ["chiller_2", "chiller 2"],
    "cooling_tower":  ["cooling_tower", "cooling tower"],
    "condenser_pump": ["condenser_pump", "condenser pump"],
}


# ── Text extraction ────────────────────────────────────────────────────────────

def extract_text(content: bytes, filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix in (".txt", ".md"):
        return content.decode("utf-8", errors="replace")
    if suffix == ".pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except ImportError:
            raise RuntimeError("pypdf not installed — run: pip install pypdf")
        except Exception as e:
            raise RuntimeError(f"PDF extraction failed: {e}")
    raise ValueError(f"Unsupported file type '{suffix}'. Accepted: .pdf, .txt, .md")


# ── Chunking ───────────────────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    words  = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i: i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
        i += chunk_size - overlap
    return chunks


# ── Equipment tag inference ────────────────────────────────────────────────────

def infer_equipment_tags(filename: str) -> str:
    name_lower = filename.lower()
    tags = [tag for tag, aliases in _EQUIPMENT_TAG_MAP.items()
            if any(alias in name_lower for alias in aliases)]
    return ",".join(tags)


# ── Ollama embedding ───────────────────────────────────────────────────────────

async def embed_chunks(chunks: list[str]) -> list[list[float]]:
    vectors: list[list[float]] = []
    async with httpx.AsyncClient(timeout=EMBED_TIMEOUT) as client:
        for i, chunk in enumerate(chunks):
            try:
                resp = await client.post(
                    f"{settings.OLLAMA_HOST}/api/embeddings",
                    json={"model": EMBED_MODEL, "prompt": chunk},
                )
                resp.raise_for_status()
                vectors.append(resp.json()["embedding"])
            except Exception as e:
                raise RuntimeError(f"Embedding failed at chunk {i}: {e}")
    return vectors


# ── Postgres storage ───────────────────────────────────────────────────────────

async def delete_source(pg: AsyncSession, source_id: str) -> int:
    result = await pg.execute(
        text("DELETE FROM embeddings WHERE source_id = :sid RETURNING id"),
        {"sid": source_id},
    )
    await pg.commit()
    return result.rowcount


async def store_chunks(
    pg: AsyncSession,
    source_id: str,
    chunks: list[str],
    vectors: list[list[float]],
    equipment_tags: str = "",
) -> int:
    for idx, (chunk, vec) in enumerate(zip(chunks, vectors)):
        vec_str = "[" + ",".join(f"{v:.6f}" for v in vec) + "]"
        await pg.execute(
            text("""
                INSERT INTO embeddings
                    (id, source_type, source_id, chunk_idx, content, embedding, equipment_tags)
                VALUES (:id, 'manual', :sid, :ci, :content, :vec::vector, :tags)
                ON CONFLICT (id) DO NOTHING
            """),
            {
                "id":      str(uuid.uuid4()),
                "sid":     source_id,
                "ci":      idx,
                "content": chunk,
                "vec":     vec_str,
                "tags":    equipment_tags,
            },
        )
    await pg.commit()
    return len(chunks)


# ── High-level entry point ─────────────────────────────────────────────────────

async def ingest_document(
    pg: AsyncSession,
    content: bytes,
    filename: str,
    equipment_tags: str | None = None,
    replace_existing: bool = True,
) -> dict:
    """
    Extract → chunk → embed → store one document.
    Returns {source_id, chunks_stored, equipment_tags}.
    Raises ValueError / RuntimeError on failure.
    """
    text_content = extract_text(content, filename)
    if not text_content.strip():
        raise ValueError("No extractable text found in the file.")

    chunks = chunk_text(text_content)
    if not chunks:
        raise ValueError("Document produced no chunks after parsing.")

    if equipment_tags is None:
        equipment_tags = infer_equipment_tags(filename)

    if replace_existing:
        removed = await delete_source(pg, filename)
        if removed:
            log.info("ingest_replaced_existing source=%s removed=%s", filename, removed)

    log.info("ingest_start source=%s chunks=%s", filename, len(chunks))
    vectors = await embed_chunks(chunks)
    stored  = await store_chunks(pg, filename, chunks, vectors, equipment_tags)
    log.info("ingest_done source=%s stored=%s tags=%s", filename, stored, equipment_tags)

    return {
        "source_id":      filename,
        "chunks_stored":  stored,
        "equipment_tags": equipment_tags,
    }
