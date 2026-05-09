"""
RAG retrieval service — Phase 4.

Given a query string:
  1. Embed it with nomic-embed-text via Ollama
  2. Vector-search embeddings table for top-k chunks
  3. Return list of {content, source_id, chunk_idx, score}

Falls back gracefully if pgvector is unavailable or embeddings table is empty.
"""
import json
from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.log import get_logger

log = get_logger("services.rag")

EMBED_MODEL = "nomic-embed-text"
EMBED_TIMEOUT = httpx.Timeout(30.0, connect=10.0)


@dataclass
class RetrievedChunk:
    source_id:  str
    chunk_idx:  int
    content:    str
    score:      float      # cosine similarity 0-1
    equipment_tags: str


async def embed_query(query: str) -> list[float] | None:
    """Return a 768-dim embedding vector for `query`, or None on failure."""
    try:
        async with httpx.AsyncClient(timeout=EMBED_TIMEOUT) as client:
            resp = await client.post(
                f"{settings.OLLAMA_HOST}/api/embeddings",
                json={"model": EMBED_MODEL, "prompt": query},
            )
            resp.raise_for_status()
            return resp.json()["embedding"]
    except Exception as e:
        log.warning("rag_embed_failed query_chars=%s err=%s", len(query), e)
        return None


async def retrieve(
    pg: AsyncSession,
    query: str,
    top_k: int = 5,
    equipment_id: str | None = None,
) -> list[RetrievedChunk]:
    """
    Embed `query` and return top_k most similar document chunks.
    Filters by equipment_tags when equipment_id is provided.
    Returns [] on any failure (graceful degradation).
    """
    vector = await embed_query(query)
    if vector is None:
        return []

    vec_str = "[" + ",".join(f"{v:.6f}" for v in vector) + "]"

    # Check embeddings table has data before querying
    try:
        count_result = await pg.execute(text("SELECT COUNT(*) FROM embeddings"))
        count = count_result.scalar()
        if not count:
            log.debug("rag_empty_table skipping retrieval")
            return []
    except Exception as e:
        log.warning("rag_table_check_failed err=%s", e)
        return []

    try:
        if equipment_id:
            sql = text("""
                SELECT source_id, chunk_idx, content, equipment_tags,
                       1 - (embedding <=> :vec::vector) AS score
                FROM embeddings
                WHERE equipment_tags = '' OR equipment_tags ILIKE :eq_filter
                ORDER BY embedding <=> :vec::vector
                LIMIT :k
            """)
            result = await pg.execute(sql, {
                "vec": vec_str,
                "eq_filter": f"%{equipment_id}%",
                "k": top_k,
            })
        else:
            sql = text("""
                SELECT source_id, chunk_idx, content, equipment_tags,
                       1 - (embedding <=> :vec::vector) AS score
                FROM embeddings
                ORDER BY embedding <=> :vec::vector
                LIMIT :k
            """)
            result = await pg.execute(sql, {"vec": vec_str, "k": top_k})

        rows = result.mappings().all()
        chunks = [
            RetrievedChunk(
                source_id=r["source_id"],
                chunk_idx=r["chunk_idx"],
                content=r["content"],
                score=round(float(r["score"]), 4),
                equipment_tags=r["equipment_tags"] or "",
            )
            for r in rows
            if float(r["score"]) > 0.4   # relevance threshold
        ]
        log.info("rag_retrieved query_chars=%s chunks=%s top_score=%s",
                 len(query), len(chunks), chunks[0].score if chunks else None)
        return chunks

    except Exception as e:
        log.warning("rag_retrieval_failed err=%s", e)
        return []


def format_rag_context(chunks: list[RetrievedChunk]) -> str:
    """Format retrieved chunks as a prompt context block with citations."""
    if not chunks:
        return ""
    lines = ["## RELEVANT DOCUMENTATION (cite by [source: filename §chunk_idx])\n"]
    for c in chunks:
        lines.append(f"[source: {c.source_id} §{c.chunk_idx}] (relevance: {c.score:.2f})")
        lines.append(c.content.strip())
        lines.append("")
    return "\n".join(lines)
