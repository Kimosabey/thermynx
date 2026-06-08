"""Per-mode runners. Each returns a flat list of result rows:
  {mode, model, case, ok, latency_s, score(0-5), passed(bool), reason, detail, error?}
Read-only against the real DBs. NL->SQL reuses the app's validated query path;
embeddings compare in memory (no DB writes).
"""
import json
import math

from sqlalchemy import text

import config as cfg
import datasets
import judge as judging
import llm
from app.db.session import MySQLSession, PGSession
from app.ai.tools import TOOL_SCHEMAS, TOOL_EXECUTORS, execute_tool  # moved from app.domain.tools
from app.ai import rag as rag_svc  # moved from app.services.rag
from app.ai.nl_to_sql import run_nl_query, NLQueryError  # moved from app.services.nl_to_sql

# ── system prompts (JSON-mode where structured) ──────────────────────────────
PLANNER_SYS = (
    "You are the OMNYX Planner for an HVAC chiller plant. Given a fault/efficiency "
    "event, decide the operations action. Use tier 3 only for critical/safety actions "
    "needing human approval; tier 2 for normal maintenance; tier 1 for routine. Typical "
    'step is create_work_order. Respond ONLY as JSON: {"rationale":"<one sentence>", '
    '"steps":["create_work_order"], "tier":2}. steps is an array of strings; tier is 1-3.'
)
VALIDATOR_SYS = (
    "You are the OMNYX Validator. Independently judge whether the executed action "
    "correctly and completely addresses the fault. Approve only if the execution truly "
    'resolved the planned action. Respond ONLY as JSON: {"verdict":"approved"|"rejected", '
    '"reason":"<one sentence>"}.'
)
EXECUTOR_SYS = (
    "You are the OMNYX Executor for an HVAC chiller plant. You ACT on a fault by USING "
    "THE PROVIDED TOOLS: first investigate (e.g. compute_efficiency, detect_anomalies, "
    "get_timeseries_summary, search_knowledge_base) to gather evidence, THEN finish by "
    "calling propose_work_order. The work order's diagnosis MUST cite at least one "
    "concrete telemetry number from your tool results (e.g. kW/TR, °C, %). Never fabricate "
    "numbers — use only values returned by tools. Investigate before you propose."
)
RAG_SYS = (
    "You are an HVAC operations assistant. Answer the question USING ONLY the provided "
    "documentation context. Cite the source filename in brackets like [source: file]. "
    "If the context does not contain the answer, say so — do not invent facts or numbers."
)
NARRATION_SYS = (
    "You are an HVAC operations analyst. Write a concise 2-3 sentence operator summary of "
    "the chiller's recent performance USING ONLY the numbers provided. Do NOT invent any "
    "value not given. Mention whether efficiency (kw_per_tr) is good (<0.65), acceptable "
    "(0.65-0.85), or poor (>0.85)."
)


# ── helpers ───────────────────────────────────────────────────────────────────
def _row(mode, model, case, ok, latency, score=0, passed=False, reason="", detail="", error=""):
    r = {"mode": mode, "model": model, "case": case, "ok": ok, "latency_s": latency,
         "score": score, "passed": passed, "reason": reason, "detail": detail}
    if error:
        r["error"] = error
    return r


# ── Planner ───────────────────────────────────────────────────────────────────
async def run_planner(models: list[str], db) -> list[dict]:
    cases = await datasets.fault_windows(db, cfg.N_FAULT_CASES)
    out = []
    for c in cases:
        for m in models:
            try:
                obj, dt = await llm.chat_json(m, PLANNER_SYS, f"Fault event:\n{c['summary']}\n\nProduce the plan.")
                steps = obj.get("steps")
                tier = obj.get("tier")
                valid = isinstance(steps, list) and len(steps) >= 1 and isinstance(tier, int) and 1 <= tier <= 3
                if not valid:
                    out.append(_row("planner", m, c["equipment"], False, dt,
                                    reason=f"malformed plan (steps={steps}, tier={tier})", detail=str(obj)[:200]))
                    continue
                j = await judging.judge("Is this a sound, safe, relevant action plan for the fault?",
                                        c["summary"], str(obj), context=c["summary"])
                out.append(_row("planner", m, c["equipment"], True, dt, j["score"], j["pass"],
                                j.get("reason", ""), detail=f"tier={tier} steps={steps}"))
            except Exception as exc:  # noqa: BLE001
                out.append(_row("planner", m, c["equipment"], False, 0, error=str(exc)[:160]))
    return out


# ── Validator (deterministic correctness: approve good, reject bad) ────────────
async def run_validator(models: list[str], db) -> list[dict]:
    cases = await datasets.fault_windows(db, 1)
    if not cases:
        return []
    fault = cases[0]["summary"]
    plan = '{"rationale":"open a work order to investigate efficiency","steps":["create_work_order"],"tier":2}'
    subcases = [
        ("good_exec", '{"work_order_id":"WO-1042","status":"created","tool":"create_work_order","http":200}', "approved"),
        ("bad_exec",  '{"error":"tool gateway returned HTTP 500; no work order created","http":500}', "rejected"),
    ]
    out = []
    for m in models:
        correct = 0
        details = []
        latency_sum = 0.0
        errored = False
        for name, execution, expected in subcases:
            try:
                user = f"Fault: {fault}\nPlan: {plan}\nExecution result: {execution}\n\nValidate."
                obj, dt = await llm.chat_json(m, VALIDATOR_SYS, user)
                latency_sum += dt
                verdict = str(obj.get("verdict", "")).lower()
                got = "approved" if verdict.startswith("approv") else "rejected" if verdict.startswith("reject") else "?"
                ok = (got == expected)
                correct += int(ok)
                details.append(f"{name}:{got}{'✓' if ok else '✗'}")
            except Exception as exc:  # noqa: BLE001
                errored = True
                details.append(f"{name}:ERR")
        score = correct * 2.5  # 0,2.5,5 over the two subcases (->1-5 scale)
        out.append(_row("validator", m, "good+bad", not errored, round(latency_sum, 1),
                        score=score if score else 1, passed=(correct == 2),
                        reason=f"{correct}/2 correct", detail=" ".join(details)))
    return out


# ── Executor (real tool-calling: native Ollama tools, JSON-mode fallback) ──────
# Reuses the app's real, read-only tool registry. propose_work_order does NOT
# persist (it validates + echoes a proposal), so the whole path is read-only.
_REQUIRED_ARGS = {
    s["function"]["name"]: list(s["function"]["parameters"].get("required", []))
    for s in TOOL_SCHEMAS
}


def _tools_menu() -> str:
    """Readable tool menu for the JSON-mode fallback prompt."""
    lines = []
    for s in TOOL_SCHEMAS:
        f = s["function"]
        req = _REQUIRED_ARGS[f["name"]]
        props = ", ".join(f["parameters"].get("properties", {}).keys()) or "—"
        lines.append(f"- {f['name']}(args: {props}; required: {req or 'none'}): "
                     f"{f['description'].split('.')[0]}.")
    return "\n".join(lines)


_FINAL_NUDGE = (
    "You have gathered enough evidence. Now call propose_work_order with a concise "
    "diagnosis that cites at least one concrete telemetry number (e.g. kW/TR, °C, %) "
    "from your tool results, plus a recommended action."
)


def _coerce_args(raw) -> dict:
    """Ollama usually returns arguments as a dict; some builds send a JSON string."""
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:  # noqa: BLE001
            return {}
    return dict(raw) if isinstance(raw, dict) else {}


async def _run_one_tool(name: str, args: dict, called: list, transcript: list) -> tuple[bool, str, dict]:
    """Validate a tool call, execute it once (read-only), record it.

    Returns (valid, wo_status, observation). The observation is reused by the
    caller for the next-turn message — the tool is never executed twice.
    """
    valid = name in TOOL_EXECUTORS and all(a in args for a in _REQUIRED_ARGS.get(name, []))
    called.append(name + ("" if valid else "✗"))
    if not valid:
        transcript.append(f"  → {name}({args}) INVALID (unknown tool or missing required args)")
        return False, "", {"error": "invalid tool call"}
    obs = await execute_tool(name, args)
    transcript.append(f"  → {name}({args}) = {str(obs)[:240]}")
    status = str(obs.get("status", "")) if isinstance(obs, dict) else ""
    return True, status, obs


async def _executor_native(model: str, scenario: str) -> dict:
    """Native Ollama tool-calling loop. Returns a run-state dict (tools_supported flag)."""
    messages = [{"role": "system", "content": EXECUTOR_SYS},
                {"role": "user", "content": scenario}]
    called, transcript = [], []
    latency, invalid, wo_status, tools_supported = 0.0, 0, "", False
    for step in range(cfg.EXEC_MAX_STEPS):
        try:
            message, calls, dt = await llm.chat_tools(model, messages, TOOL_SCHEMAS)
        except Exception:  # noqa: BLE001 — many models 400 on the tools= param
            if not tools_supported:
                # never tool-capable → signal caller to use the JSON-mode fallback
                return {"mech": "native", "tools_supported": False, "called": called,
                        "invalid": invalid, "wo_status": wo_status, "latency": latency,
                        "transcript": "\n".join(transcript)}
            break  # was working, then errored — keep partial results
        latency += dt
        if not calls:
            # Model answered in prose instead of calling a tool. If it hasn't proposed
            # yet and steps remain, nudge it to call propose_work_order; else stop.
            if wo_status != "proposed" and step < cfg.EXEC_MAX_STEPS - 1:
                messages.append({"role": "assistant", "content": message.get("content", "")})
                messages.append({"role": "user", "content": _FINAL_NUDGE})
                transcript.append("  (no tool call — nudged to propose)")
                continue
            break
        tools_supported = True
        messages.append(message)  # echo provider's assistant msg (with tool_calls) back
        for call in calls:
            ok, status, obs = await _run_one_tool(call["name"], call["args"], called, transcript)
            invalid += 0 if ok else 1
            if status:
                wo_status = status
            # tool_call_id is required by OpenAI/OpenRouter, harmless for Ollama
            messages.append({"role": "tool", "tool_call_id": call["id"],
                             "content": str(obs)[:1500]})
        if wo_status == "proposed":
            break
    return {"mech": "native", "tools_supported": tools_supported, "called": called,
            "invalid": invalid, "wo_status": wo_status, "latency": latency,
            "transcript": "\n".join(transcript)}


async def _executor_json(model: str, scenario: str) -> dict:
    """JSON-mode fallback for models without native tool support."""
    sys = (
        EXECUTOR_SYS + "\n\nYou cannot call functions directly. Instead, respond with ONLY "
        'JSON for the next action: {"tool":"<name>","args":{...}}. When your investigation '
        'is complete you MUST end with a propose_work_order action. Available tools:\n'
        + _tools_menu()
    )
    convo = f"Fault scenario:\n{scenario}\n\nChoose your first tool action."
    called, transcript = [], []
    latency, invalid, wo_status = 0.0, 0, ""
    nudge = _FINAL_NUDGE + ' Respond ONLY as JSON {"tool":"propose_work_order","args":{...}}.'
    for step in range(cfg.EXEC_MAX_STEPS):
        last = step == cfg.EXEC_MAX_STEPS - 1
        if last and wo_status != "proposed":
            convo = nudge
        obj, dt = await llm.chat_json(model, sys, convo)
        latency += dt
        name = str(obj.get("tool", ""))
        args = _coerce_args(obj.get("args", {}))
        if not name or name == "done":
            # Stopped without proposing — nudge to propose if budget remains, else stop.
            if wo_status != "proposed" and not last:
                convo = nudge
                continue
            break
        ok, status, obs = await _run_one_tool(name, args, called, transcript)
        invalid += 0 if ok else 1
        if status:
            wo_status = status
        if wo_status == "proposed":
            break
        convo = (f"Observation from {name}: {str(obs)[:600]}\n\n"
                 "Choose your next tool action (or propose_work_order if you have enough).")
    return {"mech": "json", "tools_supported": False, "called": called,
            "invalid": invalid, "wo_status": wo_status, "latency": latency,
            "transcript": "\n".join(transcript)}


async def run_executor(models: list[str], db) -> list[dict]:
    cases = await datasets.fault_windows(db, cfg.N_EXEC_CASES)
    out = []
    for c in cases:
        scenario = (f"{c['summary']}\n\nThe affected equipment id is '{c['equipment']}'. "
                    "Investigate with tools, then propose a grounded work order.")
        for m in models:
            try:
                st = await _executor_native(m, scenario)
                if not st["tools_supported"]:
                    st = await _executor_json(m, scenario)
                reached = st["wo_status"] == "proposed"
                any_valid = any(not t.endswith("✗") for t in st["called"])
                judged = await judging.judge(
                    "Did the executor investigate with the right tools and end with a correct, "
                    "grounded, actionable work order (diagnosis cites real telemetry numbers)?",
                    scenario,
                    f"Tools called: {st['called']}\nTrace:\n{st['transcript']}\n"
                    f"Work-order status: {st['wo_status']}",
                    context=c["summary"])
                passed = bool(judged["pass"]) and reached and st["invalid"] == 0 and any_valid
                out.append(_row("executor", m, c["equipment"], True, round(st["latency"], 1),
                                judged["score"], passed, judged.get("reason", ""),
                                detail=f"mech={st['mech']} tools_native={st['tools_supported']} "
                                       f"tools={st['called']} WO={st['wo_status']} invalid={st['invalid']}"))
            except Exception as exc:  # noqa: BLE001
                out.append(_row("executor", m, c["equipment"], False, 0, error=str(exc)[:160]))
    return out


# ── NL->SQL (reuses the app's validated, read-only query path) ─────────────────
async def run_nl_to_sql(models: list[str]) -> list[dict]:
    questions = datasets.nl_questions()[: cfg.N_NL_QUESTIONS]
    out = []
    async with MySQLSession() as db:
        for q in questions:
            for m in models:
                try:
                    res = await run_nl_query(q["q"], db, model=m)
                    ok = res.row_count > 0
                    j = await judging.judge(
                        "Does this SQL + result correctly answer the question over the HVAC schema?",
                        q["q"], f"SQL:\n{res.sql}\n\nRows (up to 3): {res.rows[:3]}")
                    out.append(_row("nl_to_sql", m, q["q"][:40], ok, round(res.elapsed_ms / 1000, 1),
                                    j["score"], j["pass"] and ok, j.get("reason", ""),
                                    detail=f"rows={res.row_count} sql={res.sql[:90]}"))
                except NLQueryError as exc:
                    out.append(_row("nl_to_sql", m, q["q"][:40], False, 0,
                                    reason="rejected/failed validation or exec", error=str(exc)[:140]))
                except Exception as exc:  # noqa: BLE001
                    out.append(_row("nl_to_sql", m, q["q"][:40], False, 0, error=str(exc)[:140]))
    return out


# ── RAG-QA (real pgvector corpus; SKIPs if PG/corpus unavailable) ──────────────
async def run_rag_qa(models: list[str]) -> list[dict]:
    out = []
    questions = datasets.rag_questions()[: cfg.N_RAG_QUESTIONS]
    async with PGSession() as pg:
        # corpus present?
        try:
            cnt = (await pg.execute(text("SELECT COUNT(*) FROM embeddings"))).scalar() or 0
        except Exception as exc:  # noqa: BLE001
            return [_row("rag_qa", "-", "ALL", False, 0, reason="pgvector unavailable", error=str(exc)[:120])]
        if not cnt:
            return [_row("rag_qa", "-", "ALL", False, 0, reason="embeddings corpus empty (ingest docs first)")]
        for q in questions:
            chunks = await rag_svc.retrieve(pg, q["q"], top_k=cfg.RAG_TOP_K)
            if not chunks:
                # no retrieval over threshold — record once, skip models for this q
                out.append(_row("rag_qa", "-", q["q"][:40], False, 0, reason="no chunk over 0.55 threshold"))
                continue
            context = rag_svc.format_rag_context(chunks)
            for m in models:
                try:
                    ans, dt = await llm.chat_text(m, RAG_SYS, f"Context:\n{context}\n\nQuestion: {q['q']}")
                    cited = "[source" in ans.lower() or "source:" in ans.lower()
                    j = await judging.judge(
                        "Is the answer grounded ONLY in the context, correct, and does it cite a source? Penalize hallucination.",
                        q["q"], ans, context=context)
                    out.append(_row("rag_qa", m, q["q"][:40], True, dt, j["score"],
                                    j["pass"] and cited, j.get("reason", ""),
                                    detail=f"cited={cited} topic={q.get('topic','')}"))
                except Exception as exc:  # noqa: BLE001
                    out.append(_row("rag_qa", m, q["q"][:40], False, 0, error=str(exc)[:140]))
    return out


# ── Narration ───────────────────────────────────────────────────────────────
async def run_narration(models: list[str], db) -> list[dict]:
    windows = await datasets.narration_windows(db, cfg.N_FAULT_CASES)
    out = []
    for w in windows:
        for m in models:
            try:
                ans, dt = await llm.chat_text(
                    m, NARRATION_SYS,
                    f"{w['equipment']} recent running averages (window ending {w['window_end']}): "
                    f"{w['facts_text']}\n\nWrite the operator summary.",
                    num_predict=cfg.NARRATION_MAX_TOKENS)
                ok = bool(ans.strip())
                j = await judging.judge(
                    "Is the summary clear, correct, and faithful to the numbers (no fabricated values)?",
                    f"Numbers: {w['facts_text']}", ans, context=w["facts_text"])
                out.append(_row("narration", m, w["equipment"], ok, dt, j["score"], j["pass"],
                                j.get("reason", ""), detail=ans[:120]))
            except Exception as exc:  # noqa: BLE001
                out.append(_row("narration", m, w["equipment"], False, 0, error=str(exc)[:160]))
    return out


# ── Embeddings (nomic-768 vs mxbai-1024) — in-memory, zero DB writes ──────────
def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)); nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


async def run_embeddings(models: list[str]) -> list[dict]:
    out = []
    async with PGSession() as pg:
        try:
            rows = (await pg.execute(text(
                "SELECT content, source_id, chunk_idx FROM embeddings "
                "WHERE length(content) > 80 ORDER BY id LIMIT :n"
            ), {"n": cfg.EMBED_SAMPLE})).mappings().all()
        except Exception as exc:  # noqa: BLE001
            return [_row("embeddings", "-", "ALL", False, 0, reason="pgvector unavailable", error=str(exc)[:120])]
    if len(rows) < 3:
        return [_row("embeddings", "-", "ALL", False, 0, reason="corpus too small / empty for retrieval test")]

    chunks = [dict(r) for r in rows]
    # one question per chunk, generated by the held-constant judge model
    qs = []
    for c in chunks:
        try:
            obj, _ = await llm.chat_json(
                cfg.JUDGE_MODEL,
                'Generate one specific question answerable ONLY by the passage. Respond ONLY as JSON: {"q":"..."}.',
                c["content"][:800])
            qs.append(obj.get("q", "")[:200])
        except Exception:  # noqa: BLE001
            qs.append(c["content"][:60])  # fallback: lead text

    for embed_model in models:
        try:
            cvecs = [await llm.embed(embed_model, c["content"][:1500]) for c in chunks]
            hit, rr_sum, n = 0, 0.0, 0
            for i, q in enumerate(qs):
                if not q:
                    continue
                qv = await llm.embed(embed_model, q)
                sims = sorted(((_cosine(qv, cvecs[j]), j) for j in range(len(chunks))), reverse=True)
                ranked = [j for _, j in sims]
                pos = ranked.index(i) + 1  # rank of the true source chunk
                if pos <= cfg.EMBED_TOP_K:
                    hit += 1
                rr_sum += 1.0 / pos
                n += 1
            hit_at_k = hit / n if n else 0
            mrr = rr_sum / n if n else 0
            score = round(1 + 4 * hit_at_k, 1)  # map hit@k 0..1 -> 1..5
            out.append(_row("embeddings", embed_model, f"hit@{cfg.EMBED_TOP_K}", True, 0, score,
                            hit_at_k >= 0.8, f"hit@{cfg.EMBED_TOP_K}={hit_at_k:.2f} MRR={mrr:.2f} (n={n})",
                            detail=f"dim={len(cvecs[0])}"))
        except Exception as exc:  # noqa: BLE001
            out.append(_row("embeddings", embed_model, "hit@k", False, 0, error=str(exc)[:160]))
    return out
