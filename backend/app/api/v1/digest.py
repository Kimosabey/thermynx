"""Morning digest API.

  GET  /digest/latest  — the most recent persisted digest (for the Digest page)
  GET  /digest         — recent digests (history feed)
  POST /digest/run     — build one on demand now (also used to demo the feature
                         without waiting for the 06:00 cron)
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db, get_pg
from app.log import get_logger
from app.services.digest import (
    build_digest,
    latest_digest,
    list_digests,
    post_digest_to_slack,
    serialize,
)

router = APIRouter()
log = get_logger("api.digest")


@router.get("/digest/latest")
async def get_latest_digest(pg: AsyncSession = Depends(get_pg)):
    row = await latest_digest(pg)
    return {"digest": serialize(row) if row else None}


@router.get("/digest")
async def get_digest_history(
    limit: int = Query(default=14, ge=1, le=90),
    pg: AsyncSession = Depends(get_pg),
):
    rows = await list_digests(pg, limit=limit)
    return {"digests": [serialize(r) for r in rows]}


@router.post("/digest/run")
async def run_digest_now(
    hours: int = Query(default=24, ge=1, le=168),
    mysql: AsyncSession = Depends(get_db),
    pg: AsyncSession = Depends(get_pg),
):
    digest = await build_digest(mysql, pg, hours=hours)
    try:
        digest["slack_posted"] = await post_digest_to_slack(digest)
    except Exception as exc:  # best-effort — building succeeded regardless
        log.warning("digest_run_slack_failed err=%s", exc)
        digest["slack_posted"] = False
    return {"digest": digest}
