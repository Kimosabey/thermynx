"""Tribal-knowledge service — institutional memory from resolved work orders.

The flywheel:
  resolve a work order  →  capture_resolution() embeds the fix as an
  `incident` chunk in the same `embeddings` table the manuals live in  →
  the next similar fault retrieves it (here, and automatically inside the
  agent's search_knowledge_base tool, which queries all embeddings).

Operators can also seed/search past fixes directly from the Past Fixes page.

All embedding I/O reuses app.ai.rag.embed_query (nomic-embed-text via Ollama)
and degrades gracefully — a failed embed never blocks the work-order action.
"""
from __future__ import annotations

import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.rag import embed_query
from app.db.models import Embedding, WorkOrder
from app.log import get_logger

log = get_logger("ai.knowledge")

INCIDENT_SOURCE_TYPE = "incident"
_RELEVANCE_THRESHOLD = 0.55  # same bar as manual RAG


async def capture_incident(
    pg: AsyncSession,
    *,
    content: str,
    source_id: str,
    equipment_id: str | None = None,
) -> bool:
    """Embed `content` and store it as an `incident` chunk. Best-effort:
    returns False (without raising) if the embedding call fails or content
    is empty, so callers in a write path never break on it."""
    content = (content or "").strip()
    if not content:
        return False

    vector = await embed_query(content)
    if vector is None:
        log.warning("incident_embed_failed source_id=%s", source_id)
        return False

    row = Embedding(
        id=str(uuid.uuid4()),
        source_type=INCIDENT_SOURCE_TYPE,
        source_id=source_id[:128],
        chunk_idx=0,
        content=content,
        embedding=vector,
        equipment_tags=(equipment_id or ""),
    )
    pg.add(row)
    await pg.commit()
    log.info("incident_captured source_id=%s equipment=%s chars=%s",
             source_id, equipment_id, len(content))
    return True


async def capture_resolution(
    pg: AsyncSession,
    wo: WorkOrder,
    *,
    resolution_note: str | None = None,
) -> bool:
    """Turn a resolved work order into a searchable past-fix. Skips work orders
    that carry no real resolution signal (no diagnosis / actions / note)."""
    diagnosis = (wo.diagnosis or "").strip()
    actions = (wo.recommended_actions or "").strip()
    note = (resolution_note or "").strip()
    if not (diagnosis or actions or note):
        return False  # nothing worth remembering yet

    parts = [
        f"Equipment: {wo.equipment_id or 'plant'}",
        f"Issue: {wo.title}",
    ]
    if diagnosis:
        parts.append(f"Diagnosis: {diagnosis}")
    if actions:
        parts.append(f"Recommended actions: {actions}")
    if note:
        parts.append(f"Resolution: {note}")

    source_id = f"WO {wo.id[:8]} · {wo.title[:60]}"
    return await capture_incident(
        pg,
        content="\n".join(parts),
        source_id=source_id,
        equipment_id=wo.equipment_id,
    )


async def search_incidents(
    pg: AsyncSession,
    query: str,
    *,
    top_k: int = 5,
    equipment_id: str | None = None,
) -> list[dict]:
    """Semantic search over past fixes only (source_type='incident')."""
    vector = await embed_query(query)
    if vector is None:
        return []
    vec_str = "[" + ",".join(f"{v:.6f}" for v in vector) + "]"

    params: dict = {"vec": vec_str, "k": top_k}
    eq_clause = ""
    if equipment_id:
        eq_clause = " AND (equipment_tags = '' OR equipment_tags ILIKE :eq_filter)"
        params["eq_filter"] = "%" + equipment_id.replace("%", "%%").replace("_", r"\_") + "%"

    try:
        sql = text(
            "SELECT source_id, content, equipment_tags, created_at, "
            "1 - (embedding <=> CAST(:vec AS vector)) AS score "
            "FROM embeddings "
            "WHERE source_type = 'incident'" + eq_clause + " "
            "ORDER BY embedding <=> CAST(:vec AS vector) LIMIT :k"
        )
        result = await pg.execute(sql, params)
        rows = result.mappings().all()
    except Exception as e:  # pgvector missing / table empty — degrade
        log.warning("incident_search_failed err=%s", e)
        return []

    out = []
    for r in rows:
        score = float(r["score"])
        if score <= _RELEVANCE_THRESHOLD:
            continue
        out.append({
            "source_id": r["source_id"],
            "content": r["content"],
            "equipment_tags": r["equipment_tags"] or "",
            "score": round(score, 4),
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        })
    return out


async def list_incidents(
    pg: AsyncSession,
    *,
    limit: int = 25,
    equipment_id: str | None = None,
) -> list[dict]:
    """Most-recent past fixes (no vector search) — the page's default view."""
    params: dict = {"k": limit}
    eq_clause = ""
    if equipment_id:
        eq_clause = " AND equipment_tags ILIKE :eq_filter"
        params["eq_filter"] = "%" + equipment_id.replace("%", "%%").replace("_", r"\_") + "%"
    try:
        sql = text(
            "SELECT source_id, content, equipment_tags, created_at "
            "FROM embeddings WHERE source_type = 'incident'" + eq_clause + " "
            "ORDER BY created_at DESC LIMIT :k"
        )
        rows = (await pg.execute(sql, params)).mappings().all()
    except Exception as e:
        log.warning("incident_list_failed err=%s", e)
        return []
    return [
        {
            "source_id": r["source_id"],
            "content": r["content"],
            "equipment_tags": r["equipment_tags"] or "",
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]
