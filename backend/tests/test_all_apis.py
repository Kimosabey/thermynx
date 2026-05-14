"""
Graylinx - Full API Test Suite
Tests every endpoint across all phases.

Usage:
    cd backend
    python tests/test_all_apis.py [--base http://localhost:8000] [--verbose]

Exit code: 0 = all pass, 1 = one or more failed.
"""
import sys
import json
import time
import argparse
import urllib.request
import urllib.error

# ── Terminal colours (stripped automatically if not a TTY) ───────────────────
if sys.stdout.isatty():
    GRN = "\033[32m"; RED = "\033[31m"; YEL = "\033[33m"
    CYN = "\033[36m"; BLD = "\033[1m";  RST = "\033[0m"
else:
    GRN = RED = YEL = CYN = BLD = RST = ""

passed = failed = skipped = 0
VERBOSE = False


def ok(msg):
    global passed
    passed += 1
    print(f"  {GRN}PASS{RST}  {msg}")


def fail(msg, detail=""):
    global failed
    failed += 1
    d = f"  {YEL}{detail}{RST}" if detail else ""
    print(f"  {RED}FAIL{RST}  {msg}{d}")


def skip(msg, reason=""):
    global skipped
    skipped += 1
    print(f"  {YEL}SKIP{RST}  {msg}  [{reason}]")


def section(title):
    print(f"\n{BLD}{CYN}{'='*50}{RST}")
    print(f"{BLD}{CYN}  {title}{RST}")
    print(f"{BLD}{CYN}{'='*50}{RST}")


def get(url, timeout=15):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status, json.loads(r.read()), {}
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read())
        except Exception:
            body = {}
        return e.code, body, {}
    except Exception as e:
        return 0, {}, {"error": str(e)}


def post(url, body, timeout=60):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            status = r.status
            ct     = r.headers.get("Content-Type", "")
            raw    = r.read().decode("utf-8", errors="replace")
            if "event-stream" in ct:
                return status, raw, {}          # return raw SSE text
            try:
                return status, json.loads(raw), {}
            except Exception:
                return status, raw, {}          # return raw text if not JSON
    except urllib.error.HTTPError as e:
        try:
            err_body = json.loads(e.read())
        except Exception:
            err_body = {}
        return e.code, err_body, {}
    except Exception as e:
        return 0, {}, {"error": str(e)}


# ───────────────────────────────────────────────────────────────────────────────

def run(base: str):
    global passed, failed, skipped

    # ── Phase 0/1: Core ──────────────────────────────────────────────────────
    section("Phase 0/1 - Core Endpoints")

    code, body, _ = get(f"{base}/healthz")
    if code == 200 and body.get("status") == "ok":
        ok("GET /healthz -> 200")
    else:
        fail("GET /healthz", f"HTTP {code}")

    code, body, _ = get(f"{base}/api/v1/health")
    if code == 200:
        ok(f"GET /api/v1/health -> status={body.get('status')}")
        db_ok = body.get("db", {}).get("connected")
        ollama_ok = body.get("ollama", {}).get("connected")
        if db_ok:
            ok(f"  DB connected (host={body['db'].get('host')}:{body['db'].get('port')})")
        else:
            fail("  MySQL NOT connected", str(body.get("db")))
        if ollama_ok:
            ok(f"  Ollama connected (model={body['ollama'].get('default_model')})")
        else:
            fail("  Ollama NOT connected -- LLM features will fail")
        models = body.get("ollama", {}).get("available_models", [])
        if models:
            ok(f"  Models available: {', '.join(models[:3])}{'...' if len(models) > 3 else ''}")
    else:
        fail("GET /api/v1/health", f"HTTP {code}")

    code, body, _ = get(f"{base}/api/v1/equipment")
    if code == 200 and isinstance(body, list):
        ok(f"GET /api/v1/equipment -> {len(body)} entries")
        for expected in ["chiller_1", "chiller_2", "cooling_tower_1", "cooling_tower_2"]:
            if any(e["id"] == expected for e in body):
                ok(f"  found {expected}")
            else:
                fail(f"  missing {expected}")
    else:
        fail("GET /api/v1/equipment", f"HTTP {code}")

    code, body, _ = get(f"{base}/api/v1/equipment/summary?hours=24")
    if code == 200 and "summary" in body:
        s = body["summary"]
        ok(f"GET /api/v1/equipment/summary -> {len(s)} equipment")
        tw = body.get("telemetry_window", {})
        if tw:
            ok(f"  anchor={tw.get('anchor')} until={tw.get('until_utc','?')[:16]}")
        for eq in ["chiller_1", "chiller_2"]:
            kpt = s.get(eq, {}).get("avg_kw_per_tr")
            if kpt is not None:
                band = "good" if kpt < 0.65 else "fair" if kpt < 0.85 else "poor"
                ok(f"  {eq}: kW/TR={kpt:.3f} ({band})")
            else:
                fail(f"  {eq}: no kW/TR -- equipment may be off during window")
    else:
        fail("GET /api/v1/equipment/summary", f"HTTP {code}")

    # ── Timeseries ────────────────────────────────────────────────────────────
    section("Phase 1 - Timeseries")

    for eq_id in ["chiller_1", "chiller_2", "cooling_tower_1", "condenser_pump_1"]:
        code, body, err = get(f"{base}/api/v1/equipment/{eq_id}/timeseries?hours=24&resolution=15m")
        if code == 200 and "points" in body:
            n = body["count"]
            status = f"{n} pts | {body.get('from','?')[:10]} -> {body.get('to','?')[:10]}"
            if n > 0:
                ok(f"GET /timeseries?eq={eq_id} -> {status}")
            else:
                fail(f"GET /timeseries?eq={eq_id} -> 0 points", "no data in window")
        else:
            fail(f"GET /timeseries?eq={eq_id}", f"HTTP {code} {err}")

    # Resolution variants
    for res in ["5m", "1h"]:
        code, body, _ = get(f"{base}/api/v1/equipment/chiller_1/timeseries?hours=24&resolution={res}")
        if code == 200:
            ok(f"GET /timeseries?resolution={res} -> {body.get('count',0)} pts")
        else:
            fail(f"GET /timeseries?resolution={res}", f"HTTP {code}")

    # ── Analyze (SSE) ─────────────────────────────────────────────────────────
    section("Phase 1 - AI Analyzer (SSE streaming)")

    t0 = time.time()
    code, raw, err = post(
        f"{base}/api/v1/analyze",
        {"question": "What is the current kW/TR efficiency of Chiller 1?",
         "equipment_id": "chiller_1", "hours": 24},
        timeout=30,
    )
    elapsed = time.time() - t0
    if code == 200 and isinstance(raw, str) and ("data:" in raw or "token" in raw):
        lines = raw.split("\n")
        has_token = any('"type":"token"' in l or '"type": "token"' in l for l in lines)
        has_done  = any('"type":"done"'  in l or '"type": "done"'  in l for l in lines)
        ok(f"POST /analyze -> SSE received ({elapsed:.1f}s)")
        if has_token: ok("  token frames present")
        else: fail("  no token frames")
        if has_done:  ok("  done frame present")
        else: fail("  no done frame")
        if elapsed < 8: ok(f"  latency {elapsed:.1f}s < 8s")
        else: fail(f"  latency {elapsed:.1f}s > 8s target")
    else:
        preview = str(raw)[:120] if raw else "(empty)"
        fail("POST /analyze", f"HTTP {code} | body preview: {preview}")

    # ── Phase 2: Intelligence ─────────────────────────────────────────────────
    section("Phase 2 - Efficiency Benchmarker")

    code, body, _ = get(f"{base}/api/v1/efficiency?hours=24")
    if code == 200 and "results" in body:
        ok(f"GET /efficiency -> {len(body['results'])} chiller results")
        for r in body["results"]:
            band = r.get("band", "?")
            kpt  = r.get("kw_per_tr_avg")
            kpt_str = f"{kpt:.3f}" if kpt is not None else "N/A"
            ok(f"  {r['name']}: band={band} kW/TR={kpt_str}")
            if r.get("loss_drivers"):
                ok(f"    loss drivers: {len(r['loss_drivers'])} identified")
    else:
        fail("GET /efficiency", f"HTTP {code}")

    code, body, _ = get(f"{base}/api/v1/efficiency/chiller_1?hours=24")
    if code == 200 and "band" in body:
        ok(f"GET /efficiency/chiller_1 -> band={body['band']} delta={body.get('delta_pct','?')}%")
    else:
        fail("GET /efficiency/chiller_1", f"HTTP {code}")

    section("Phase 2 - Anomaly Detector")

    code, body, _ = get(f"{base}/api/v1/anomalies/live?hours=1")
    if code == 200 and "anomalies" in body:
        n = body.get("total", 0)
        ok(f"GET /anomalies/live -> {n} anomaly events")
        for a in body["anomalies"][:3]:
            ok(f"  {a.get('equipment_id','?')} {a.get('metric','?')} z={a.get('z_score','?'):.1f} [{a.get('severity','?')}]")
    else:
        fail("GET /anomalies/live", f"HTTP {code}")

    code, body, _ = get(f"{base}/api/v1/anomalies/history?limit=5")
    if code == 200 and "anomalies" in body:
        ok(f"GET /anomalies/history -> {body.get('total',0)} persisted events")
    else:
        fail("GET /anomalies/history", f"HTTP {code}")

    section("Phase 2 - Energy Forecaster")

    for metric in ["kw_per_tr", "kw"]:
        code, body, _ = get(f"{base}/api/v1/forecast/chiller_1?metric={metric}&horizon=24&history_days=7")
        if code == 200 and "points" in body:
            n = len(body.get("points", []))
            ok(f"GET /forecast/chiller_1?metric={metric} -> {n} forecast points")
            if VERBOSE and body.get("note"):
                print(f"    note: {body['note']}")
        else:
            fail(f"GET /forecast?metric={metric}", f"HTTP {code}")

    section("Phase 2 - Comparison View")

    code, body, _ = get(f"{base}/api/v1/compare?a=chiller_1&b=chiller_2&hours=24")
    if code == 200 and "a" in body and "b" in body:
        a_kpt = body["a"].get("summary", {}).get("avg_kw_per_tr")
        b_kpt = body["b"].get("summary", {}).get("avg_kw_per_tr")
        better = body.get("better_efficiency", "?")
        ok(f"GET /compare?a=chiller_1&b=chiller_2")
        a_str = f"{a_kpt:.3f}" if a_kpt is not None else "N/A"
        b_str = f"{b_kpt:.3f}" if b_kpt is not None else "N/A"
        ok(f"  chiller_1 kW/TR={a_str}, chiller_2={b_str}")
        ok(f"  better={better}")
    else:
        fail("GET /compare", f"HTTP {code}")

    # ── Phase 3: Advanced Features ────────────────────────────────────────────
    section("Phase 3 - Predictive Maintenance")

    code, body, _ = get(f"{base}/api/v1/maintenance?hours=168")
    if code == 200 and "assets" in body:
        ok(f"GET /maintenance -> {len(body['assets'])} assets scored")
        for a in body["assets"][:3]:
            sc = a.get("score")
            sc_str = f"{sc:.0f}" if sc is not None else "?"
            ok(f"  {a.get('name','?')}: score={sc_str} grade={a.get('grade','?')}")
    else:
        fail("GET /maintenance", f"HTTP {code}")

    section("Phase 3 - Cost Analytics")

    code, body, _ = get(f"{base}/api/v1/cost?hours=24")
    if code == 200 and "total_kwh" in body:
        inr = body.get("total_inr")
        inr_str = f"{inr:.1f}" if inr is not None else "?"
        ok(f"GET /cost -> total_kwh={body['total_kwh']:.1f} total_inr={inr_str}")
        ok(f"  {len(body.get('equipment', []))} equipment breakdown entries")
    else:
        fail("GET /cost", f"HTTP {code}")

    section("Phase 3 - Cooling Tower Optimizer")

    code, body, _ = get(f"{base}/api/v1/cooling-tower/cooling_tower_1/optimize?hours=24")
    if code == 200 and "staging_hint" in body:
        ok(f"GET /cooling-tower/.../optimize -> hint='{body['staging_hint']}'")
        ok(f"  duty={body.get('current_duty_pct','?')}% saving_kwh={body.get('estimated_saving_kwh','?')}")
    else:
        fail("GET /cooling-tower/.../optimize", f"HTTP {code}")

    section("Phase 3 - Report Builder")

    t0 = time.time()
    code, raw, err = post(f"{base}/api/v1/reports/daily", {"hours": 24}, timeout=40)
    elapsed = time.time() - t0
    if code == 200 and isinstance(raw, str) and "data:" in raw:
        has_token = any('"type":"token"' in l or '"type": "token"' in l for l in raw.split("\n"))
        ok(f"POST /reports/daily -> SSE ({elapsed:.1f}s)")
        if has_token: ok("  LLM summary streaming OK")
        else: fail("  no LLM tokens in report stream")
    else:
        fail("POST /reports/daily", f"HTTP {code} {err}")

    section("Phase 3 - Conversational Threads")

    code, body, _ = post(f"{base}/api/v1/threads", {})
    thread_id = None
    if code == 200 and body.get("id"):
        thread_id = body["id"]
        ok(f"POST /threads -> id={thread_id[:8]}...")
        code2, body2, _ = get(f"{base}/api/v1/threads")
        if code2 == 200:
            ok(f"GET /threads -> {len(body2.get('threads', []))} threads")
        code3, body3, _ = get(f"{base}/api/v1/threads/{thread_id}/messages")
        if code3 == 200 and "messages" in body3:
            ok(f"GET /threads/{{id}}/messages -> {len(body3['messages'])} msgs")
        else:
            fail("GET /threads/{id}/messages", f"HTTP {code3}")
    else:
        fail("POST /threads", f"HTTP {code}")

    section("Phase 3 - AI Agents")

    code, body, _ = get(f"{base}/api/v1/agent/history?limit=5")
    if code == 200 and "runs" in body:
        ok(f"GET /agent/history -> {body.get('total',0)} runs logged")
    else:
        fail("GET /agent/history", f"HTTP {code}")

    print("\n  [Agent run test -- brief optimizer goal, may take 10-30s]")
    t0 = time.time()
    code, raw, err = post(
        f"{base}/api/v1/agent/run",
        {"mode": "brief",
         "goal": "Give a one-sentence plant status. Be extremely brief.",
         "context": None},
        timeout=45,
    )
    elapsed = time.time() - t0
    if code == 200 and isinstance(raw, str) and "data:" in raw:
        lines = raw.split("\n")
        has_token = any('"type":"token"' in l or '"type": "token"' in l for l in lines)
        has_done  = any('"type":"done"'  in l or '"type": "done"'  in l for l in lines)
        steps = 0
        for l in lines:
            if '"type":"done"' in l or '"type": "done"' in l:
                try: steps = json.loads(l[6:]).get("steps", 0)
                except: pass
        ok(f"POST /agent/run (brief) -> SSE ({elapsed:.1f}s, {steps} steps)")
        if has_token: ok("  agent produced output tokens")
        else: fail("  no output tokens from agent")
        if has_done:  ok("  agent run completed")
        else: fail("  agent did not complete")
    else:
        fail("POST /agent/run", f"HTTP {code} {err}")

    section("Phase 4 - RAG Knowledge Base")

    code, body, _ = get(f"{base}/api/v1/rag/status")
    if code == 200:
        ready = body.get("ready", False)
        total = body.get("total_chunks", 0)
        ok(f"GET /rag/status -> ready={ready} total_chunks={total}")
        if not ready:
            skip("GET /rag/search", "no documents ingested yet -- run scripts/ingest_docs.py")
        else:
            code2, body2, _ = get(f"{base}/api/v1/rag/search?q=maintenance+interval&top_k=3")
            if code2 == 200 and "results" in body2:
                ok(f"GET /rag/search -> {body2.get('total',0)} results")
            else:
                fail("GET /rag/search", f"HTTP {code2}")
    else:
        fail("GET /rag/status", f"HTTP {code}")

    # ── Summary ───────────────────────────────────────────────────────────────
    total = passed + failed + skipped
    sep = "-" * 50
    print(f"\n{sep}")
    print(f"  {BLD}RESULTS: {GRN}{passed} passed{RST}{BLD}  {RED}{failed} failed{RST}{BLD}  {YEL}{skipped} skipped{RST}{BLD}  / {total} total{RST}")
    print(f"{sep}")
    if failed == 0:
        print(f"  {GRN}{BLD}All checks passed.{RST}\n")
    else:
        print(f"  {RED}{BLD}{failed} check(s) failed -- see FAIL lines above.{RST}\n")
    return failed == 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Graylinx Full API Test")
    parser.add_argument("--base", default="http://localhost:8000", help="Backend URL")
    parser.add_argument("--verbose", action="store_true", help="Show extra detail")
    args = parser.parse_args()
    VERBOSE = args.verbose
    print(f"\n{BLD}Graylinx Full API Test Suite{RST}")
    print(f"Target: {args.base}\n")
    ok_result = run(args.base)
    sys.exit(0 if ok_result else 1)
