from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.db.telemetry import fetch_plant_latest_slot_time, check_data_freshness
from app.config import settings
from app.llm.ollama import check_ollama_health, circuit_state
from app.log import get_logger
from app.observability.metrics import telemetry_data_age_seconds, telemetry_freshness_check_total

router = APIRouter()
log = get_logger("api.health")


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    db_ok = False
    latest: datetime | None = None
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
        # Best-effort: also fetch the newest plant row for freshness reporting.
        try:
            latest = await fetch_plant_latest_slot_time(db)
        except Exception as e:
            log.warning("freshness_probe_failed err=%s", e)
    except Exception as e:
        log.warning("mysql_ping_failed host=%s port=%s err=%s", settings.DB_HOST, settings.DB_PORT, e)

    ollama_ok, models = await check_ollama_health()

    # Digest pin check — warn when a loaded model's digest doesn't match the pin.
    # Non-blocking: mismatches log a warning and appear in the response but don't
    # fail the health check. Operators can act on this signal manually.
    digest_warnings: list[str] = []
    pin_pairs = [
        (settings.OLLAMA_DEFAULT_MODEL, settings.OLLAMA_DIGEST_DEFAULT_MODEL),
        (settings.OLLAMA_MODEL_TOOL or settings.OLLAMA_DEFAULT_MODEL, settings.OLLAMA_DIGEST_TOOL_MODEL),
        (settings.OLLAMA_VISION_MODEL, settings.OLLAMA_DIGEST_VISION_MODEL),
    ]
    _model_data = {}
    if ollama_ok:
        try:
            import httpx as _httpx
            async with _httpx.AsyncClient(timeout=5.0) as _c:
                _r = await _c.get(f"{settings.OLLAMA_HOST}/api/tags")
                raw_models = _r.json().get("models") or []
                _model_digests = {m["name"]: m.get("digest", "") for m in raw_models}
                for m in raw_models:
                    size = m.get("size", 0)
                    sz = f"{size / 1024**3:.1f} GB" if size > 1024**3 else (f"{size / 1024**2:.1f} MB" if size > 0 else "")
                    _model_data[m["name"]] = {"param_size": m.get("details", {}).get("parameter_size", ""), "size": sz}
            for model_name, expected_digest in pin_pairs:
                if not expected_digest:
                    continue
                actual = _model_digests.get(model_name, "")
                if actual and not actual.startswith(expected_digest[:12]):
                    msg = f"Digest mismatch for {model_name}: expected …{expected_digest[:12]}, got …{actual[:12]}"
                    log.warning("model_digest_mismatch %s", msg)
                    digest_warnings.append(msg)
        except Exception as _e:
            log.debug("digest_check_failed err=%s", _e)

    _text_model = settings.OLLAMA_MODEL_TEXT or settings.OLLAMA_DEFAULT_MODEL
    model_roles = [
        {"role": "Narration",      "model": _text_model,
         "purpose": "Final analyzer answer + summaries", "origin": "Microsoft"},
        {"role": "Executor / Tools", "model": settings.OLLAMA_MODEL_TOOL or settings.OLLAMA_DEFAULT_MODEL,
         "purpose": "Agent ReAct tool selection", "origin": "Mistral (FR)"},
        {"role": "NL→SQL",         "model": settings.OLLAMA_MODEL_SQL or settings.OLLAMA_DEFAULT_MODEL,
         "purpose": "Natural language → SQL query", "origin": "Mistral (FR)"},
        {"role": "Planner",        "model": settings.OLLAMA_MODEL_PLANNER or settings.OLLAMA_DEFAULT_MODEL,
         "purpose": "Multi-agent task decomposition", "origin": "Mistral (FR)"},
        {"role": "Validator",      "model": settings.OLLAMA_AUDITOR_MODEL or settings.OLLAMA_DEFAULT_MODEL,
         "purpose": "Self-critique / fact-check", "origin": "Microsoft"},
        {"role": "RAG answer",     "model": settings.OLLAMA_MODEL_RAG or _text_model,
         "purpose": "Manual-grounded answers", "origin": "Microsoft"},
        {"role": "Vision",         "model": settings.OLLAMA_VISION_MODEL,
         "purpose": "Image / scene analysis", "origin": "Meta"},
        {"role": "Embeddings",     "model": "nomic-embed-text",
         "purpose": "RAG vector search", "origin": "Nomic (US)"},
    ]
    
    # Attach size metadata to roles
    for r in model_roles:
        target = r["model"]
        # Exact match or colon suffix (e.g. "phi4" matches "phi4:latest")
        match = _model_data.get(target)
        if not match:
            for k, v in _model_data.items():
                if k == target or k.startswith(f"{target}:"):
                    match = v
                    break
        r["param_size"] = match["param_size"] if match else ""
        r["size"] = match["size"] if match else ""

    # Data-freshness signal — populates the Prometheus gauge for alerting +
    # surfaces a human-readable warning in the response when wall_clock mode is
    # in use. Stays None / 0 in historical-dump (latest_in_db) mode.
    freshness_warning = check_data_freshness(latest)
    age_seconds: float | None = None
    if latest is not None and settings.TELEMETRY_TIME_ANCHOR == "wall_clock":
        age_seconds = max(0.0, (datetime.utcnow() - latest).total_seconds())
        telemetry_data_age_seconds.set(age_seconds)
        telemetry_freshness_check_total.labels(
            status="stale" if freshness_warning else "ok"
        ).inc()
    elif latest is None:
        telemetry_freshness_check_total.labels(status="no_data").inc()
    else:
        telemetry_freshness_check_total.labels(status="skipped").inc()

    return {
        "status": "ok" if (db_ok and ollama_ok) else "degraded",
        "db": {"connected": db_ok, "host": settings.DB_HOST, "port": settings.DB_PORT},
        "ollama": {
            "connected": ollama_ok,
            "host": settings.OLLAMA_HOST,
            "default_model": settings.OLLAMA_DEFAULT_MODEL,
            "available_models": models,
            "model_roles": model_roles,
            "circuit": circuit_state(),
            "digest_warnings": digest_warnings,
        },
        "telemetry": {
            "anchor": settings.TELEMETRY_TIME_ANCHOR,
            "latest_slot_time": latest.isoformat() if latest else None,
            "age_seconds": age_seconds,
            "freshness_warning": freshness_warning,
        },
    }
