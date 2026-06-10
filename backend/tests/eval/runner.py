"""Eval runner — calls the backend with each case body, collects the response,
and applies S1 deterministic checks.

Two endpoint shapes:
  - JSON (POST /nl-query): regular HTTP POST + JSON body parse
  - SSE  (POST /analyze, /agent/run): collect `data: {...}` frames into a
    single text blob + last `audit` frame for postcheck assertions

Returns a CaseResult that the pytest layer turns into pass/fail.
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any

import httpx


@dataclass
class CaseResult:
    case_id:        str
    passed:         bool
    status:         int | None
    latency_ms:     int
    response_text:  str
    audit:          dict[str, Any] | None
    failures:       list[str] = field(default_factory=list)
    skipped:        bool = False
    skip_reason:    str = ""
    s2_verdict:     dict[str, Any] | None = None
    deepeval:       dict[str, Any] | None = None


def _collect_sse(url: str, body: dict, timeout: float) -> dict[str, Any]:
    """POST to an SSE endpoint and join all 'token' chunks into a single string.
    Also captures the most recent 'audit' frame, if any.
    """
    tokens: list[str] = []
    audit: dict[str, Any] | None = None
    context_summary: dict[str, Any] | None = None
    status_code: int | None = None

    # X-Eval-Context asks the analyzer to emit the telemetry summary it grounded
    # the answer in, so S2/DeepEval judge faithfulness against REAL data (not the
    # answer-as-its-own-context proxy). Header-gated → no effect on prod traffic.
    with httpx.Client(timeout=timeout) as client:
        with client.stream("POST", url, json=body,
                           headers={"Accept": "text/event-stream", "X-Eval-Context": "1"}) as r:
            status_code = r.status_code
            if r.status_code != 200:
                return {"status": status_code, "text": r.read().decode("utf-8", errors="replace"), "audit": None}
            for line in r.iter_lines():
                if not line.startswith("data: "):
                    continue
                try:
                    frame = json.loads(line[6:])
                except json.JSONDecodeError:
                    continue
                t = frame.get("type")
                if t in ("token", "synthesis_token", "delegate_token"):
                    tokens.append(frame.get("content", ""))
                elif t == "audit":
                    audit = frame.get("audit")
                elif t == "context_summary":
                    context_summary = frame.get("summary")

    return {"status": status_code, "text": "".join(tokens), "audit": audit,
            "context_summary": context_summary}


def _collect_json(url: str, body: dict, timeout: float) -> dict[str, Any]:
    """POST to a JSON endpoint and return the parsed response."""
    with httpx.Client(timeout=timeout) as client:
        r = client.post(url, json=body)
        return {
            "status": r.status_code,
            # Convert the JSON body to its string form so contains_any checks
            # can match against any field (sql, rows, detail, etc.) uniformly.
            "text":   r.text,
            "audit":  None,
        }


def run_case(case: dict, base_url: str = "http://localhost:8000") -> CaseResult:
    case_id   = case["id"]
    endpoint  = case["endpoint"]
    body      = case.get("body", {})
    expect    = case.get("expect", {})
    url       = base_url.rstrip("/") + endpoint

    # Tight timeout for refusal/preflight cases; loose for happy paths.
    timeout_s = (expect.get("max_latency_ms", 60_000) / 1000.0) + 5.0
    timeout_s = max(5.0, min(timeout_s, 180.0))

    is_sse = endpoint.endswith("/analyze") or endpoint.endswith("/agent/run") or endpoint.endswith("/agent/orchestrate")

    started = time.monotonic()
    try:
        resp = _collect_sse(url, body, timeout_s) if is_sse else _collect_json(url, body, timeout_s)
    except httpx.ConnectError as exc:
        return CaseResult(
            case_id=case_id, passed=False, status=None, latency_ms=0,
            response_text="", audit=None, skipped=True,
            skip_reason=f"backend unreachable: {exc}",
        )
    except httpx.TimeoutException:
        return CaseResult(
            case_id=case_id, passed=False, status=None,
            latency_ms=int((time.monotonic() - started) * 1000),
            response_text="", audit=None,
            failures=[f"timeout after {timeout_s:.0f}s"],
        )
    except Exception as exc:
        return CaseResult(
            case_id=case_id, passed=False, status=None,
            latency_ms=int((time.monotonic() - started) * 1000),
            response_text="", audit=None,
            failures=[f"transport error: {type(exc).__name__}: {exc}"],
        )

    latency_ms = int((time.monotonic() - started) * 1000)
    text = resp["text"] or ""
    status = resp["status"]
    audit = resp.get("audit")

    failures: list[str] = []

    # ── S1 deterministic checks ─────────────────────────────────────────────
    if "status" in expect and status != expect["status"]:
        failures.append(f"status: expected {expect['status']}, got {status}")

    if "contains_any" in expect:
        needles = expect["contains_any"]
        if not any(n.lower() in text.lower() for n in needles):
            preview = text[:200].replace("\n", " ")
            failures.append(
                f"contains_any: none of {needles} found in response. preview: {preview!r}"
            )

    if "contains_all" in expect:
        missing = [n for n in expect["contains_all"] if n.lower() not in text.lower()]
        if missing:
            failures.append(f"contains_all: missing {missing}")

    if "not_contains" in expect:
        bad = [n for n in expect["not_contains"] if n.lower() in text.lower()]
        if bad:
            preview = text[:200].replace("\n", " ")
            failures.append(f"not_contains: forbidden {bad} found. preview: {preview!r}")

    if "max_latency_ms" in expect and latency_ms > expect["max_latency_ms"]:
        failures.append(f"latency: {latency_ms}ms exceeds max {expect['max_latency_ms']}ms")

    if "min_latency_ms" in expect and latency_ms < expect["min_latency_ms"]:
        failures.append(f"latency: {latency_ms}ms below min {expect['min_latency_ms']}ms (suspiciously fast — preflight may have been bypassed)")

    if "audit_flag_count_min" in expect or "audit_flag_count_max" in expect:
        flag_count = (audit or {}).get("flag_count", 0)
        lo = expect.get("audit_flag_count_min", 0)
        hi = expect.get("audit_flag_count_max", 10_000)
        if not (lo <= flag_count <= hi):
            failures.append(
                f"audit_flag_count: {flag_count} not in [{lo}, {hi}]"
            )

    # ── S2 LLM-as-judge + DeepEval (optional; judged against REAL context) ───
    # The analyzer (sent X-Eval-Context) emits the telemetry summary it grounded
    # on; judge faithfulness against THAT, not the answer-as-its-own-context
    # proxy. Falls back to the proxy when the frame is absent (non-analyze
    # endpoints, or a backend without the eval frame).
    ctx_obj = resp.get("context_summary")
    judge_context = json.dumps(ctx_obj, default=str)[:3000] if ctx_obj else text[:1000]

    s2_verdict: dict[str, Any] | None = None
    if expect.get("s2_judge") and text and not failures:
        try:
            from tests.eval.judge import judge_answer
            s2_verdict = judge_answer(text, judge_context)
            if expect.get("s2_grounded") and s2_verdict.get("grounded") is False:
                failures.append(
                    f"s2_judge: answer not grounded in telemetry — issues: {s2_verdict.get('issues', [])[:3]}"
                )
        except Exception as exc:
            s2_verdict = {"grounded": None, "issues": [f"judge error: {exc}"]}

    # DeepEval faithfulness — a SECOND grounding signal, never a gate. Only when
    # opted-in (expect.deepeval_faithfulness) and real context was captured.
    deepeval_res: dict[str, Any] | None = None
    if expect.get("deepeval_faithfulness") and text and ctx_obj:
        try:
            from tests.eval.deepeval_metric import faithfulness_score
            deepeval_res = faithfulness_score(body.get("question", ""), text, [judge_context])
        except Exception as exc:
            deepeval_res = {"score": None, "reason": f"deepeval error: {exc}"}

    return CaseResult(
        case_id=case_id,
        passed=not failures,
        status=status,
        latency_ms=latency_ms,
        response_text=text[:500],
        audit=audit,
        failures=failures,
        s2_verdict=s2_verdict,
        deepeval=deepeval_res,
    )


def backend_reachable(base_url: str = "http://localhost:8000", timeout: float = 3.0) -> bool:
    """Quick health-check used by pytest to skip the suite cleanly."""
    try:
        r = httpx.get(f"{base_url}/api/v1/health", timeout=timeout)
        return r.status_code == 200
    except Exception:
        return False
