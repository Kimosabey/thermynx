"""FlashRank cross-encoder reranking (F2).

Refines the pgvector top-k by true query↔passage relevance (a small ms-marco
cross-encoder, CPU, ~ms — Apache-2.0, on-prem, no egress). The RAG node retrieves
wider (top-k≈15) then reranks down to the final top-k, which beats cosine-only
ordering as the knowledge base grows. Graceful: any error falls back to the
original cosine order.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any

from app.log import get_logger

log = get_logger("ai.graph.rerank")


@lru_cache(maxsize=1)
def _ranker() -> Any:
    from flashrank import Ranker  # downloads a small cross-encoder on first use
    return Ranker()


def rerank(query: str, chunks: list[Any], top_k: int = 5) -> list[Any]:
    """Reorder ``chunks`` (objects with ``.content``) by cross-encoder relevance; return top_k."""
    if not chunks or not query:
        return chunks[:top_k]
    try:
        from flashrank import RerankRequest
        passages = [{"id": i, "text": getattr(c, "content", "") or ""} for i, c in enumerate(chunks)]
        ranked = _ranker().rerank(RerankRequest(query=query, passages=passages))
        return [chunks[r["id"]] for r in ranked][:top_k]
    except Exception as e:  # never break retrieval on a rerank hiccup
        log.warning("rerank_failed err=%s", e)
        return chunks[:top_k]
