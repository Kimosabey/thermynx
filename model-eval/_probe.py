"""Connectivity probe — confirms the real DBs + corpus + Ollama are reachable
(read-only) before the harness runs. Run: python model-eval/_probe.py"""
import asyncio

import _bootstrap  # noqa: F401  (sets sys.path + cwd)
import httpx
from sqlalchemy import text

from app.config import settings
from app.db.session import MySQLSession, PGSession


async def main() -> None:
    print(f"OLLAMA_HOST = {settings.OLLAMA_HOST}")
    print(f"MySQL       = {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")
    print(f"Postgres    = {settings.POSTGRES_URL.split('@')[-1]}")
    print("-" * 50)

    # MySQL unicharm (read-only)
    try:
        async with MySQLSession() as db:
            n = (await db.execute(text("SELECT COUNT(*) FROM chiller_1_normalized"))).scalar()
            mx = (await db.execute(text("SELECT MAX(slot_time) FROM chiller_1_normalized"))).scalar()
        print(f"[OK]   MySQL chiller_1_normalized: {n} rows, latest slot_time={mx}")
    except Exception as e:
        print(f"[FAIL] MySQL: {e}")

    # Postgres pgvector corpus (read-only)
    try:
        async with PGSession() as pg:
            cnt = (await pg.execute(text("SELECT COUNT(*) FROM embeddings"))).scalar()
            srcs = (await pg.execute(text("SELECT COUNT(DISTINCT source_id) FROM embeddings"))).scalar()
        print(f"[OK]   Postgres embeddings: {cnt} chunks across {srcs} sources")
    except Exception as e:
        print(f"[FAIL] Postgres embeddings: {e}")

    # Ollama tags
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get(f"{settings.OLLAMA_HOST}/api/tags")
            r.raise_for_status()
            names = sorted(m["name"] for m in r.json().get("models", []))
        print(f"[OK]   Ollama: {len(names)} models")
        print("       " + ", ".join(names))
    except Exception as e:
        print(f"[FAIL] Ollama: {e}")


if __name__ == "__main__":
    asyncio.run(main())
