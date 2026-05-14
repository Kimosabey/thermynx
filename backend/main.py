from app.logging_setup import configure_logging

configure_logging()

import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.api.router import router
from app.config import settings
from app.db.session import pg_engine, Base
from app.log import get_logger

log = get_logger("app")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    from sqlalchemy import text as _sql

    # ── 1. Try to enable pgvector (own transaction — failure must not abort startup) ──
    _pgvector_ok = False
    try:
        async with pg_engine.begin() as conn:
            await conn.execute(_sql("CREATE EXTENSION IF NOT EXISTS vector"))
            _pgvector_ok = True
            log.info("pgvector_extension_ready")
    except Exception as e:
        log.warning(
            "pgvector_extension_unavailable — RAG disabled until Postgres image "
            "includes pgvector. Use image: pgvector/pgvector:pg16 in docker-compose. err=%s", e
        )

    # ── 2. Create all ORM tables (always runs, fresh transaction) ─────────────────────
    async with pg_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # ── 2b. Column-width migrations (idempotent ALTER TABLE statements) ───────────────
    # Required when the table already exists with narrower columns from an older boot.
    _migrations = [
        # analysis_audit.id was VARCHAR(26) — UUIDs are 36 chars
        "ALTER TABLE analysis_audit ALTER COLUMN id TYPE VARCHAR(36)",
        # request_id carries the full UUID from X-Request-Id header
        "ALTER TABLE analysis_audit ALTER COLUMN request_id TYPE VARCHAR(64)",
        # threads and messages ids
        "ALTER TABLE threads ALTER COLUMN id TYPE VARCHAR(36)",
        "ALTER TABLE messages ALTER COLUMN id TYPE VARCHAR(36)",
        "ALTER TABLE messages ALTER COLUMN thread_id TYPE VARCHAR(36)",
    ]
    for stmt in _migrations:
        try:
            async with pg_engine.begin() as conn:
                await conn.execute(_sql(stmt))
        except Exception:
            pass  # column already correct width or table doesn't exist yet

    log.info("postgres_metadata_ready")

    # ── 3. Create IVFFlat index (own transaction, only if pgvector is enabled) ────────
    if _pgvector_ok:
        try:
            async with pg_engine.begin() as conn:
                await conn.execute(_sql(
                    "CREATE INDEX IF NOT EXISTS idx_embeddings_vec "
                    "ON embeddings USING ivfflat (embedding vector_cosine_ops) "
                    "WITH (lists=50)"
                ))
        except Exception as e:
            log.warning("ivfflat_index_skipped err=%s", e)

    scheduler = AsyncIOScheduler()
    try:
        from app.jobs.anomaly_scan import run_scan_async

        scheduler.add_job(run_scan_async, "interval", minutes=5, id="anomaly_scan", max_instances=1)
        scheduler.start()
        log.info("Anomaly scan scheduler started (every 5 min)")
    except Exception as e:
        log.warning("Could not start anomaly scheduler: %s", e)

    yield

    scheduler.shutdown(wait=False)


app = FastAPI(
    title="THERMYNX AI Operations Intelligence",
    description="AI-powered HVAC operations platform for Unicharm facility",
    version="0.1.0",
    lifespan=lifespan,
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    rid = getattr(request.state, "request_id", None)
    log.exception(
        "unhandled_exception method=%s path=%s request_id=%s",
        request.method,
        request.url.path,
        rid,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "request_id": rid},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    start = time.time()
    response = await call_next(request)
    elapsed_ms = round((time.time() - start) * 1000)
    response.headers["X-Request-Id"] = request_id
    response.headers["X-Response-Time-Ms"] = str(elapsed_ms)

    if settings.LOG_ACCESS:
        access = get_logger("access")
        access.info(
            "%s %s -> %s %dms request_id=%s",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
            request_id,
        )

    return response


app.include_router(router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"service": "THERMYNX API", "version": "0.1.0", "status": "running"}


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
