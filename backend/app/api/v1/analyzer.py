import hashlib
import json
import re
import time
import uuid
from datetime import datetime
from typing import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_pg, MySQLSession
from app.db.models import AnalysisAudit, Message, Thread
from app.db.telemetry import fetch_all_hvac_context, compute_summary, fetch_chiller_data
from app.domain.equipment import EQUIPMENT_CATALOG, get_by_id
from app.llm.ollama import stream_generate
from app.prompts.hvac_prompts import build_analyze_prompt
from app.services.rag import retrieve, format_rag_context
from app.services.critique import verify_answer
from app.limiter import limiter
from app.config import settings
from app.log import get_logger
from app.errors import OllamaUnavailableError, TelemetryUnavailableError
from app.observability.metrics import analyzer_requests_total

router = APIRouter()
log = get_logger("api.analyzer")


class AnalyzeRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000)
    equipment_id: str | None = None
    hours: int = Field(default=24, ge=1, le=8760)
    model: str | None = None
    thread_id: str | None = Field(default=None, max_length=36)
    verify: bool = Field(default=True, description="Run self-critique pass after answer is generated")


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


async def _sse_stream(
    request: Request,
    req: AnalyzeRequest,
    pg: AsyncSession,
) -> AsyncIterator[str]:
    audit_id = str(uuid.uuid4())
    model = req.model or settings.OLLAMA_MODEL_TEXT or settings.OLLAMA_DEFAULT_MODEL
    start_ms = int(time.time() * 1000)

    # Layer 1 — pre-flight: reject obvious bad input before any LLM/DB work.
    # Saves 30-60s per refused request and is 100% deterministic.
    from app.services.preflight import (
        check_action_request, check_equipment_mentions, topic_gate,
    )
    refusal = (
        check_action_request(req.question)
        or check_equipment_mentions(req.question)
        or topic_gate(req.question, equipment_id=req.equipment_id)
    )
    if refusal:
        log.info("analyze_preflight_refused audit_id=%s reason=%s", audit_id, refusal[:120])
        yield f"data: {json.dumps({'type': 'token', 'content': refusal})}\n\n"
        # Emit a skipped audit frame so the frontend can distinguish preflight
        # refusal from streaming error (both would otherwise leave auditResult=null)
        yield f"data: {json.dumps({'type': 'audit', 'audit': {'status': 'skipped', 'reason': 'preflight_refused', 'flag_count': 0}})}\n\n"
        total_ms = int(time.time() * 1000) - start_ms
        yield f"data: {json.dumps({'type': 'done', 'audit_id': audit_id, 'model': model, 'total_ms': total_ms, 'preflight_refused': True})}\n\n"
        return

    audit = AnalysisAudit(
        id=audit_id,
        equipment_id=req.equipment_id,
        time_range_hours=req.hours,
        question=req.question,
        model=model,
        status="streaming",
        request_id=getattr(request.state, "request_id", None),
    )
    pg.add(audit)
    await pg.commit()

    rid = getattr(request.state, "request_id", None)
    log.info(
        "analyze_stream_start audit_id=%s equipment=%s hours=%s thread_id=%s model=%s request_id=%s",
        audit_id,
        req.equipment_id,
        req.hours,
        req.thread_id,
        model,
        rid,
    )

    conversation_history: list[dict[str, str]] | None = None
    if req.thread_id:
        res = await pg.execute(
            select(Message)
            .where(Message.thread_id == req.thread_id)
            .order_by(Message.created_at.desc())
            .limit(24)
        )
        msgs = list(res.scalars())
        conversation_history = [{"role": m.role, "content": m.content} for m in reversed(msgs)]

        # NOTE: user message is persisted AFTER the stream completes (below),
        # together with the assistant response in a single transaction.
        # Persisting here would create an orphaned user message when the client
        # disconnects mid-stream — corrupting the conversation history.

    telemetry_failed = False
    summary: dict = {}
    context: dict = {}
    async with MySQLSession() as db:
        try:
            if req.equipment_id:
                eq = get_by_id(req.equipment_id)
                if eq and eq["type"] == "chiller":
                    rows = await fetch_chiller_data(db, eq["table"], hours=req.hours)
                    context = {req.equipment_id: rows}
                else:
                    context = await fetch_all_hvac_context(db, hours=req.hours)
            else:
                context = await fetch_all_hvac_context(db, hours=req.hours)
            summary = await compute_summary(context)
        except Exception:
            log.exception(
                "analyze_mysql_failed audit_id=%s request_id=%s",
                audit_id,
                getattr(request.state, "request_id", None),
            )
            telemetry_failed = True
            err = TelemetryUnavailableError()
            yield f"data: {json.dumps({'type': 'error', 'detail': err.detail, 'request_id': getattr(request.state, 'request_id', None)})}\n\n"

    if telemetry_failed:
        total_ms = int(time.time() * 1000) - start_ms
        yield f"data: {json.dumps({'type': 'done', 'audit_id': audit_id, 'model': model, 'total_ms': total_ms})}\n\n"
        audit.prompt_hash = None
        audit.response_hash = None
        audit.tokens_estimated = 0
        audit.total_ms = total_ms
        audit.status = "error"
        await pg.merge(audit)
        await pg.commit()
        analyzer_requests_total.labels(status="error").inc()
        return

    # RAG retrieval — inject relevant doc chunks before the prompt (graceful degradation)
    rag_chunks = await retrieve(pg, req.question, top_k=5, equipment_id=req.equipment_id)
    rag_context = format_rag_context(rag_chunks) if rag_chunks else ""

    # Emit a citations frame BEFORE the stream so the UI can render footnote
    # targets the moment the LLM mentions [source: ...]. Snippet is capped so
    # this frame stays small.
    if rag_chunks:
        citation_payload = [
            {
                "source_id":  c.source_id,
                "chunk_idx":  c.chunk_idx,
                "score":      c.score,
                "snippet":    (c.content[:480] + "…") if len(c.content) > 480 else c.content,
                "equipment_tags": c.equipment_tags,
            }
            for c in rag_chunks
        ]
        yield f"data: {json.dumps({'type': 'citations', 'chunks': citation_payload})}\n\n"

    # ── Response cache check (Redis, 60s TTL) ────────────────────────────────
    # Key includes the telemetry window_end so stale answers are never served
    # after new data arrives. Disabled when TTL=0 or Redis is unavailable.
    from app.services.answer_cache import get_cached_answer, set_cached_answer
    _window_end = context.get("fetched_at")  # set by fetch_all_hvac_context
    if settings.ANALYZER_CACHE_TTL_S > 0:
        _cached = await get_cached_answer(
            req.question, req.equipment_id, req.hours, _window_end
        )
        if _cached:
            # Replay cached answer as token frames — same streaming UX
            words = _cached.split(" ")
            for i, word in enumerate(words):
                token = (word + " ") if i < len(words) - 1 else word
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
            total_ms = int(time.time() * 1000) - start_ms
            yield f"data: {json.dumps({'type': 'done', 'audit_id': audit_id, 'model': model, 'total_ms': total_ms, 'cache_hit': True})}\n\n"
            log.info("analyze_cache_hit audit_id=%s ms=%s", audit_id, total_ms)
            return

    prompt = build_analyze_prompt(
        req.question, context, summary,
        conversation_history=conversation_history,
        rag_context=rag_context,
        available_equipment=[
            {"id": e["id"], "name": e["name"], "type": e["type"]}
            for e in EQUIPMENT_CATALOG
        ],
        focus_equipment_id=req.equipment_id,
        focus_hours=req.hours,
    )
    prompt_hash = _hash(prompt)

    full_response: list[str] = []
    status = "error"
    try:
        async for chunk in stream_generate(
            prompt,
            model=model,
            num_predict=settings.OLLAMA_MAX_TOKENS_ANALYZE,
        ):
            if await request.is_disconnected():
                status = "cancelled"
                break
            full_response.append(chunk)
            yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
        else:
            status = "ok"
    except OllamaUnavailableError as e:
        log.warning(
            "analyze_ollama_unavailable audit_id=%s request_id=%s",
            audit_id,
            getattr(request.state, "request_id", None),
        )
        yield f"data: {json.dumps({'type': 'error', 'detail': e.detail, 'request_id': getattr(request.state, 'request_id', None)})}\n\n"
        status = "error"
    except Exception:
        log.exception(
            "analyze_stream_error audit_id=%s request_id=%s",
            audit_id,
            getattr(request.state, "request_id", None),
        )
        yield f"data: {json.dumps({'type': 'error', 'detail': 'Analysis failed.', 'request_id': getattr(request.state, 'request_id', None)})}\n\n"
        status = "error"

    total_ms = int(time.time() * 1000) - start_ms
    response_text = "".join(full_response)
    yield f"data: {json.dumps({'type': 'done', 'audit_id': audit_id, 'model': model, 'total_ms': total_ms})}\n\n"

    # ── Write to answer cache on success ─────────────────────────────────────
    if status == "ok" and response_text.strip() and settings.ANALYZER_CACHE_TTL_S > 0:
        await set_cached_answer(
            req.question, req.equipment_id, req.hours, _window_end,
            response_text, ttl_s=settings.ANALYZER_CACHE_TTL_S,
        )

    # ── Post-generation audit (Tier 3 — regex-based, no LLM call) ──────────
    # Fast (<50ms) check for: orphan numeric claims, fabricated equipment names,
    # and unmatched citations. Increments Prometheus counters either way.
    if status == "ok" and response_text.strip():
        try:
            from app.services.postcheck import run_postcheck
            audit_result = run_postcheck(
                response_text,
                context=context,
                summary=summary,
                equipment_catalog=EQUIPMENT_CATALOG,
                retrieved_chunks=[
                    {"source_id": c.source_id, "chunk_idx": c.chunk_idx}
                    for c in (rag_chunks or [])
                ],
            )
            yield f"data: {json.dumps({'type': 'audit', 'audit': audit_result})}\n\n"
            if audit_result.get("flag_count", 0) > 0:
                log.warning(
                    "analyze_postcheck_flags audit_id=%s flags=%s n=%s e=%s c=%s",
                    audit_id,
                    audit_result["flag_count"],
                    len(audit_result.get("numeric_flags", [])),
                    len(audit_result.get("equipment_flags", [])),
                    len(audit_result.get("citation_flags", [])),
                )
        except Exception:
            log.exception("analyze_postcheck_failed audit_id=%s", audit_id)

    # ── Self-critique pass ─────────────────────────────────────────────────
    # Runs after the synthesised answer is complete. The auditor LLM checks
    # numeric claims against the summary we sent the synthesiser; any
    # mismatch surfaces in the UI as a fact-check panel. Never mutates the
    # answer, never raises — failures degrade to a "skipped" frame.
    if req.verify and status == "ok" and response_text.strip():
        critique_start = time.time()
        verdict = await verify_answer(response_text, summary, model=None)
        verdict["critique_ms"] = int((time.time() - critique_start) * 1000)
        yield f"data: {json.dumps({'type': 'verification', 'verdict': verdict})}\n\n"
        log.info(
            "analyze_critique_done audit_id=%s overall=%s critique_ms=%s",
            audit_id,
            verdict.get("overall") or verdict.get("status"),
            verdict["critique_ms"],
        )

    audit.prompt_hash = prompt_hash
    audit.response_hash = _hash(response_text) if response_text else None
    audit.tokens_estimated = len(response_text.split())
    audit.total_ms = total_ms
    audit.status = status
    try:
        await pg.merge(audit)
        await pg.commit()
    except Exception as _pg_err:
        # R2 — Postgres unreachable: buffer audit row to local NDJSON so data
        # isn't lost. A background job can drain this file when Postgres recovers.
        log.warning("audit_pg_write_failed audit_id=%s err=%s — buffering to NDJSON", audit_id, _pg_err)
        import json as _json, pathlib as _pl
        _buf_path = _pl.Path("logs/audit-buffer.ndjson")
        try:
            _buf_path.parent.mkdir(parents=True, exist_ok=True)
            with _buf_path.open("a", encoding="utf-8") as _f:
                _f.write(_json.dumps({
                    "id": audit_id, "equipment_id": req.equipment_id,
                    "question": req.question, "status": status,
                    "total_ms": total_ms, "model": model,
                }) + "\n")
        except Exception as _buf_err:
            log.error("audit_buffer_write_failed err=%s", _buf_err)

    # Custom metric — bucket terminal status as ok | error | aborted
    analyzer_requests_total.labels(
        status=("ok" if status == "ok" else "aborted" if status == "cancelled" else "error")
    ).inc()

    log.info(
        "analyze_stream_done audit_id=%s status=%s total_ms=%s request_id=%s",
        audit_id,
        status,
        total_ms,
        getattr(request.state, "request_id", None),
    )

    # Persist user + assistant messages together in one transaction.
    # Only write if the stream completed (status=ok) or got a partial answer —
    # skip entirely on a client disconnect with no content so history stays clean.
    if req.thread_id and response_text.strip() and status != "cancelled":
        pg.add(Message(
            id=str(uuid.uuid4()),
            thread_id=req.thread_id,
            role="user",
            content=req.question,
        ))
        pg.add(Message(
            id=str(uuid.uuid4()),
            thread_id=req.thread_id,
            role="assistant",
            content=response_text,
        ))
        thr = await pg.get(Thread, req.thread_id)
        if thr:
            thr.updated_at = datetime.utcnow()
            if thr.title in (None, "", "Conversation"):
                thr.title = re.sub(r"\s+", " ", req.question.strip())[:200]
        await pg.commit()


@router.post("/analyze")
@limiter.limit("20/minute")  # aligned with agent/run; 20/min handles demo + operator burst without flood risk
                              # 30/min still bounds accidental flood while allowing
                              # natural rapid-fire operator usage (3-5 ops sharing a tab).
async def analyze(
    request: Request,
    req: AnalyzeRequest,
    pg: AsyncSession = Depends(get_pg),
):
    if req.thread_id:
        thr = await pg.get(Thread, req.thread_id)
        if not thr:
            raise HTTPException(status_code=404, detail="Thread not found")

    return StreamingResponse(
        _sse_stream(request, req, pg),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
