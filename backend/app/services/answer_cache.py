"""Analyzer answer cache — Redis-backed, 60s TTL.

Uses the existing app.services.cache helpers (get/set) which already handle
Redis unavailability gracefully (degrade to miss without raising).

Cache key: SHA-256 of (question + equipment_id + hours + window_end).
Cache value: fully-streamed answer text.

Cache HIT: answer replayed as token SSE frames — same streaming UX, <100ms.
Cache MISS: normal LLM path runs and writes the answer on success.

Window_end is included in the key so stale answers are never served when
new telemetry arrives (the telemetry window end changes after ingest).
"""
from __future__ import annotations

import hashlib
import logging

from app.services import cache as _cache

log = logging.getLogger("services.answer_cache")

_PREFIX = "thermynx:answer:"


def _key(question: str, equipment_id: str | None, hours: int, window_end: str | None) -> str:
    raw = f"{question.strip().lower()}|{equipment_id or ''}|{hours}|{window_end or ''}"
    return _PREFIX + hashlib.sha256(raw.encode()).hexdigest()[:32]


async def get_cached_answer(
    question: str,
    equipment_id: str | None,
    hours: int,
    window_end: str | None,
) -> str | None:
    """Return cached answer text or None on miss / Redis unavailable."""
    key = _key(question, equipment_id, hours, window_end)
    val = await _cache.get(key)
    if val:
        log.info("answer_cache_hit key=%s", key[:16])
    return val


async def set_cached_answer(
    question: str,
    equipment_id: str | None,
    hours: int,
    window_end: str | None,
    answer: str,
    ttl_s: int = 60,
) -> None:
    """Store answer in cache. Silently degrades if Redis is unavailable."""
    if not answer or not answer.strip():
        return
    key = _key(question, equipment_id, hours, window_end)
    await _cache.set(key, answer, ttl=ttl_s)
    log.info("answer_cache_set key=%s ttl=%ss chars=%s", key[:16], ttl_s, len(answer))
