"""
Redis cache service — Sprint 2 P1-1.

Wraps redis.asyncio with graceful degradation: if Redis is down or
unavailable, get_or_set() falls through to the fetch function without
raising. Callers never need to handle Redis errors directly.
"""
import json
from typing import Any, Callable, Awaitable

import redis.asyncio as aioredis

from app.log import get_logger

log = get_logger("services.cache")

_client: aioredis.Redis | None = None


def init_redis(url: str) -> None:
    global _client
    try:
        _client = aioredis.from_url(url, decode_responses=True, socket_connect_timeout=1)
        log.info("redis_client_ready url=%s", url.split("@")[-1])
    except Exception as e:
        log.warning("redis_init_failed err=%s — caching disabled", e)
        _client = None


def get_client() -> aioredis.Redis | None:
    return _client


async def get(key: str) -> Any | None:
    if _client is None:
        return None
    try:
        raw = await _client.get(key)
        return json.loads(raw) if raw else None
    except Exception as e:
        log.debug("cache_get_failed key=%s err=%s", key, e)
        return None


async def set(key: str, value: Any, ttl: int) -> None:
    if _client is None:
        return
    try:
        await _client.setex(key, ttl, json.dumps(value, default=str))
    except Exception as e:
        log.debug("cache_set_failed key=%s err=%s", key, e)


async def delete(key: str) -> None:
    if _client is None:
        return
    try:
        await _client.delete(key)
    except Exception as e:
        log.debug("cache_delete_failed key=%s err=%s", key, e)


async def get_or_set(
    key: str,
    ttl: int,
    fetch_fn: Callable[[], Awaitable[Any]],
) -> Any:
    """
    Return cached value if present, otherwise call fetch_fn, cache
    the result, and return it. Falls back to fetch_fn if Redis is down.
    """
    cached = await get(key)
    if cached is not None:
        log.debug("cache_hit key=%s", key)
        return cached

    value = await fetch_fn()
    await set(key, value, ttl)
    return value
