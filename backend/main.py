import time
import uuid
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from app.api.router import router
from app.db.session import pg_engine, Base

log = logging.getLogger("thermynx")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Create thermynx_app tables
    async with pg_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Start background anomaly scan every 5 minutes
    scheduler = BackgroundScheduler()
    try:
        from app.jobs.anomaly_scan import run_scan
        scheduler.add_job(run_scan, "interval", minutes=5, id="anomaly_scan", max_instances=1)
        scheduler.start()
        log.info("Anomaly scan scheduler started (every 5 min)")
    except Exception as e:
        log.warning(f"Could not start anomaly scheduler: {e}")

    yield

    scheduler.shutdown(wait=False)


app = FastAPI(
    title="THERMYNX AI Operations Intelligence",
    description="AI-powered HVAC operations platform for Unicharm facility",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
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
    response.headers["X-Request-Id"] = request_id
    response.headers["X-Response-Time-Ms"] = str(round((time.time() - start) * 1000))
    return response


app.include_router(router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"service": "THERMYNX API", "version": "0.1.0", "status": "running"}


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
