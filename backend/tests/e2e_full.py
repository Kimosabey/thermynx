"""
THERMYNX -- Full End-to-End Test Suite
Covers every feature, module, and API across all 4 POC phases.

Usage:
    cd backend
    python tests/e2e_full.py [--base http://localhost:8000] [--quick]

--quick  skips long LLM calls (analyze, agent, reports)

Exit: 0 = all pass, 1 = any failure.
"""
import sys
import json
import time
import argparse
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

BASE    = "http://localhost:8000"
QUICK   = False

# ── Colour helpers ────────────────────────────────────────────────────────────
if sys.stdout.isatty():
    G="\033[32m"; R="\033[31m"; Y="\033[33m"; C="\033[36m"; B="\033[1m"; X="\033[0m"
else:
    G=R=Y=C=B=X=""

passed = failed = skipped = 0
_results: list[tuple[str, str, str]] = []   # (status, section, message)


def ok(msg, section=""):
    global passed
    passed += 1
    _results.append(("PASS", section, msg))
    print(f"  {G}PASS{X}  {msg}")


def fail(msg, detail="", section=""):
    global failed
    failed += 1
    _results.append(("FAIL", section, f"{msg} | {detail}" if detail else msg))
    d = f"  {Y}{detail}{X}" if detail else ""
    print(f"  {R}FAIL{X}  {msg}{d}")


def skip(msg, reason="", section=""):
    global skipped
    skipped += 1
    _results.append(("SKIP", section, msg))
    print(f"  {Y}SKIP{X}  {msg}  [{reason}]")


def section(title):
    print(f"\n{B}{C}{'='*56}{X}\n{B}{C}  {title}{X}\n{B}{C}{'='*56}{X}")


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def get(path, timeout=15):
    url = f"{BASE}{path}"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            body = r.read().decode("utf-8", errors="replace")
            try:
                return r.status, json.loads(body)
            except Exception:
                return r.status, body
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}
    except Exception as e:
        return 0, {"_conn_error": str(e)}


def post(path, body=None, timeout=60):
    url  = f"{BASE}{path}"
    data = json.dumps(body or {}).encode()
    req  = urllib.request.Request(url, data=data,
                                   headers={"Content-Type": "application/json"},
                                   method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            status = r.status
            ct     = r.headers.get("Content-Type", "")
            raw    = r.read().decode("utf-8", errors="replace")
            if "event-stream" in ct:
                return status, raw          # raw SSE text
            try:
                return status, json.loads(raw)
            except Exception:
                return status, raw
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}
    except Exception as e:
        return 0, {"_conn_error": str(e)}


def delete(path, timeout=10):
    url = f"{BASE}{path}"
    req = urllib.request.Request(url, method="DELETE")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            try:
                return r.status, json.loads(r.read())
            except Exception:
                return r.status, {}
    except urllib.error.HTTPError as e:
        return e.code, {}
    except Exception as e:
        return 0, {"_conn_error": str(e)}


def sse_has(raw, event_type):
    return any(f'"type":"{event_type}"' in l or f'"type": "{event_type}"' in l
               for l in (raw or "").split("\n"))


def sse_value(raw, event_type, key):
    for l in (raw or "").split("\n"):
        if f'"type":"{event_type}"' in l or f'"type": "{event_type}"' in l:
            try:
                d = json.loads(l[6:])
                return d.get(key)
            except Exception:
                pass
    return None


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 0/1 -- Core
# ═════════════════════════════════════════════════════════════════════════════

def test_core():
    section("Phase 0/1 -- Core & Health")
    s = "Core"

    # Liveness
    code, body = get("/healthz")
    if code == 200 and (body == {"status":"ok"} or (isinstance(body,dict) and body.get("status")=="ok")):
        ok("GET /healthz -> 200 ok", s)
    else:
        fail("GET /healthz", f"HTTP {code}", s)

    # Full health
    code, body = get("/api/v1/health")
    if code == 200:
        ok(f"GET /api/v1/health -> status={body.get('status')}", s)
        if body.get("db", {}).get("connected"):
            ok(f"  MySQL connected ({body['db'].get('host')}:{body['db'].get('port')})", s)
        else:
            fail("  MySQL NOT connected", str(body.get("db", {})), s)
        if body.get("ollama", {}).get("connected"):
            ok(f"  Ollama connected model={body['ollama'].get('default_model')}", s)
            models = body["ollama"].get("available_models", [])
            ok(f"  Models: {', '.join(models[:4])}", s)
            if "qwen2.5:14b" in models:
                ok("  qwen2.5:14b available", s)
            else:
                fail("  qwen2.5:14b NOT in model list", str(models), s)
            if "nomic-embed-text:latest" in models:
                ok("  nomic-embed-text available (RAG ready)", s)
            else:
                skip("  nomic-embed-text not found", "RAG embeddings won't work", s)
        else:
            fail("  Ollama NOT connected -- all LLM features will fail", "", s)
    else:
        fail("GET /api/v1/health", f"HTTP {code}", s)

    # Root
    code, body = get("/")
    if code == 200 and isinstance(body, dict) and body.get("service"):
        ok(f"GET / -> service={body.get('service')} version={body.get('version')}", s)
    else:
        fail("GET /", f"HTTP {code}", s)


def test_equipment():
    section("Phase 1 -- Equipment Catalog")
    s = "Equipment"

    code, body = get("/api/v1/equipment")
    if code != 200 or not isinstance(body, list):
        fail("GET /api/v1/equipment", f"HTTP {code}", s)
        return None

    ok(f"GET /api/v1/equipment -> {len(body)} entries", s)

    expected = ["chiller_1","chiller_2","cooling_tower_1","cooling_tower_2",
                "condenser_pump_1","condenser_pump_3"]
    ids = [e["id"] for e in body]
    for eq_id in expected:
        if eq_id in ids:
            ok(f"  found {eq_id}", s)
        else:
            fail(f"  missing {eq_id}", "", s)

    # Types
    types = {e["id"]: e["type"] for e in body}
    for eq_id, expected_type in [("chiller_1","chiller"),("cooling_tower_1","cooling_tower"),("condenser_pump_1","pump")]:
        if types.get(eq_id) == expected_type:
            ok(f"  {eq_id} type={expected_type} correct", s)
        else:
            fail(f"  {eq_id} wrong type", f"got {types.get(eq_id)}", s)

    return ids


def test_summary():
    section("Phase 1 -- Equipment Summary (Dashboard data)")
    s = "Summary"

    code, body = get("/api/v1/equipment/summary?hours=24")
    if code != 200:
        fail("GET /equipment/summary", f"HTTP {code}", s)
        return

    ok(f"GET /equipment/summary -> {len(body.get('summary',{}))} equipment", s)

    tw = body.get("telemetry_window", {})
    if tw:
        ok(f"  anchor={tw.get('anchor')} until={str(tw.get('until_utc',''))[:16]}", s)
        if tw.get("anchor") == "latest_in_db":
            ok("  TELEMETRY_TIME_ANCHOR=latest_in_db (correct for historical DB)", s)
        else:
            fail("  TELEMETRY_TIME_ANCHOR is not latest_in_db", str(tw), s)

    s_ = body.get("summary", {})
    for eq in ["chiller_1", "chiller_2"]:
        kpt = s_.get(eq, {}).get("avg_kw_per_tr")
        run = s_.get(eq, {}).get("running_pct")
        if kpt is not None:
            band = "good" if kpt<0.65 else "fair" if kpt<0.85 else "poor"
            ok(f"  {eq}: kW/TR={kpt:.3f} ({band}) run={run}%", s)
        else:
            fail(f"  {eq}: no kW/TR (equipment off in window?)", "", s)


def test_timeseries():
    section("Phase 1 -- Timeseries")
    s = "Timeseries"

    cases = [
        ("chiller_1",       "15m", 24),
        ("chiller_2",       "15m", 24),
        ("cooling_tower_1", "15m", 24),
        ("condenser_pump_1","15m", 24),
        ("chiller_1",       "5m",  24),
        ("chiller_1",       "1h",  24),
        ("chiller_1",       "15m", 168),   # 7 days
    ]

    for eq_id, res, hours in cases:
        code, body = get(f"/api/v1/equipment/{eq_id}/timeseries?hours={hours}&resolution={res}")
        if code == 200 and "points" in body:
            n = body["count"]
            f_ = str(body.get("from",""))[:10]
            t_ = str(body.get("to",""))[:10]
            if n > 0:
                ok(f"  {eq_id} res={res} hours={hours} -> {n} pts ({f_} to {t_})", s)
            else:
                fail(f"  {eq_id} res={res} hours={hours} -> 0 pts", "no data in window", s)
        else:
            fail(f"  {eq_id} res={res} hours={hours}", f"HTTP {code}", s)

    # 404 for unknown equipment
    code, body = get("/api/v1/equipment/nonexistent/timeseries?hours=24")
    if code == 404:
        ok("  GET /timeseries?eq=nonexistent -> 404 (correct)", s)
    else:
        fail("  /timeseries?eq=nonexistent should be 404", f"got {code}", s)


def test_analyze():
    section("Phase 1 -- AI Analyzer (SSE streaming)")
    s = "Analyzer"

    if QUICK:
        skip("POST /analyze", "QUICK mode", s)
        return

    questions = [
        ("chiller_1", "What is the current kW/TR of Chiller 1?", 6),
        ("chiller_2", "Is Chiller 2 running efficiently?", 6),
    ]

    for eq_id, question, hours in questions:
        t0 = time.time()
        code, raw = post("/api/v1/analyze",
                         {"question": question, "equipment_id": eq_id, "hours": hours},
                         timeout=40)
        elapsed = time.time() - t0

        if code == 200 and isinstance(raw, str) and sse_has(raw, "token"):
            ok(f"  POST /analyze eq={eq_id} -> SSE ({elapsed:.1f}s)", s)
            if sse_has(raw, "done"):
                ok(f"    done frame received", s)
                if elapsed < 8:
                    ok(f"    latency {elapsed:.1f}s < 8s target", s)
                elif elapsed < 20:
                    ok(f"    latency {elapsed:.1f}s (>8s but <20s -- acceptable under load)", s)
                else:
                    fail(f"    latency {elapsed:.1f}s > 20s -- Ollama may be overloaded", "", s)
            else:
                fail("    no done frame", "", s)
        else:
            preview = str(raw)[:120] if raw else "(empty)"
            fail(f"  POST /analyze eq={eq_id}", f"HTTP {code} | {preview}", s)

    # Method not allowed on GET
    code, _ = get("/api/v1/analyze")
    if code == 405:
        ok("  GET /analyze -> 405 Method Not Allowed (correct)", s)
    else:
        fail("  GET /analyze should return 405", f"got {code}", s)


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 2 -- Intelligence
# ═════════════════════════════════════════════════════════════════════════════

def test_efficiency():
    section("Phase 2 -- Efficiency Benchmarker")
    s = "Efficiency"

    # All chillers
    code, body = get("/api/v1/efficiency?hours=24")
    if code == 200 and "results" in body:
        ok(f"GET /efficiency -> {len(body['results'])} results", s)
        for r in body["results"]:
            band = r.get("band","?")
            kpt  = r.get("kw_per_tr_avg")
            kpt_s = f"{kpt:.3f}" if kpt is not None else "N/A"
            ok(f"  {r.get('name','?')}: band={band} kW/TR={kpt_s}", s)
            if r.get("loss_drivers"):
                ok(f"    {len(r['loss_drivers'])} loss driver(s) identified", s)
            if r.get("observations"):
                ok(f"    {len(r['observations'])} observation(s)", s)
    else:
        fail("GET /efficiency", f"HTTP {code}", s)

    # Single chiller
    for eq_id in ["chiller_1", "chiller_2"]:
        code, body = get(f"/api/v1/efficiency/{eq_id}?hours=24")
        if code == 200 and "band" in body:
            ok(f"GET /efficiency/{eq_id} -> band={body['band']} delta={body.get('delta_pct','?')}%", s)
        else:
            fail(f"GET /efficiency/{eq_id}", f"HTTP {code}", s)

    # Non-chiller should return 400
    code, _ = get("/api/v1/efficiency/cooling_tower_1?hours=24")
    if code == 400:
        ok("GET /efficiency/cooling_tower_1 -> 400 (correct -- not a chiller)", s)
    else:
        fail("GET /efficiency/cooling_tower_1 should be 400", f"got {code}", s)

    # Unknown equipment
    code, _ = get("/api/v1/efficiency/bad_eq?hours=24")
    if code == 404:
        ok("GET /efficiency/bad_eq -> 404 (correct)", s)
    else:
        fail("GET /efficiency/bad_eq should be 404", f"got {code}", s)


def test_anomalies():
    section("Phase 2 -- Anomaly Detector")
    s = "Anomalies"

    for hours in [1, 6, 24]:
        code, body = get(f"/api/v1/anomalies/live?hours={hours}")
        if code == 200 and "anomalies" in body:
            n = body.get("total", 0)
            ok(f"GET /anomalies/live?hours={hours} -> {n} events", s)
            for a in body["anomalies"][:2]:
                z = a.get("z_score")
                z_s = f"{z:.2f}" if z is not None else "?"
                ok(f"  {a.get('equipment_id','?')} {a.get('metric','?')} z={z_s} [{a.get('severity','?')}]", s)
        else:
            fail(f"GET /anomalies/live?hours={hours}", f"HTTP {code}", s)

    code, body = get("/api/v1/anomalies/history?limit=10")
    if code == 200 and "anomalies" in body:
        ok(f"GET /anomalies/history -> {body.get('total',0)} persisted", s)
    else:
        fail("GET /anomalies/history", f"HTTP {code}", s)

    # Filter by equipment
    code, body = get("/api/v1/anomalies/history?equipment_id=chiller_1&limit=5")
    if code == 200:
        ok(f"GET /anomalies/history?equipment_id=chiller_1 -> {body.get('total',0)}", s)
    else:
        fail("GET /anomalies/history?equipment_id=chiller_1", f"HTTP {code}", s)


def test_forecast():
    section("Phase 2 -- Energy Forecaster")
    s = "Forecast"

    # Chiller metrics
    for metric in ["kw_per_tr", "kw", "chiller_load"]:
        code, body = get(f"/api/v1/forecast/chiller_1?metric={metric}&horizon=24&history_days=7")
        if code == 200 and "points" in body:
            n = len(body.get("points", []))
            ok(f"GET /forecast/chiller_1?metric={metric} -> {n} pts", s)
            if n > 0:
                pt = body["points"][0]
                ok(f"  first pt: predicted={pt.get('predicted','?')} CI=[{pt.get('lower','?')}, {pt.get('upper','?')}]", s)
        else:
            fail(f"GET /forecast/chiller_1?metric={metric}", f"HTTP {code}", s)

    # Non-chiller equipment
    code, body = get("/api/v1/forecast/cooling_tower_1?metric=kw&horizon=24")
    if code == 200:
        ok(f"GET /forecast/cooling_tower_1?metric=kw -> {len(body.get('points',[]))} pts", s)
    else:
        fail("GET /forecast/cooling_tower_1?metric=kw", f"HTTP {code}", s)

    # Bad metric
    code, _ = get("/api/v1/forecast/chiller_1?metric=invalid_metric")
    if code == 400:
        ok("GET /forecast?metric=invalid -> 400 (correct)", s)
    else:
        fail("GET /forecast?metric=invalid should be 400", f"got {code}", s)

    # Different horizons
    for h in [12, 48, 72]:
        code, body = get(f"/api/v1/forecast/chiller_1?metric=kw_per_tr&horizon={h}")
        if code == 200:
            ok(f"GET /forecast?horizon={h} -> {len(body.get('points',[]))} pts", s)
        else:
            fail(f"GET /forecast?horizon={h}", f"HTTP {code}", s)


def test_compare():
    section("Phase 2 -- Comparison View")
    s = "Compare"

    code, body = get("/api/v1/compare?a=chiller_1&b=chiller_2&hours=24")
    if code == 200 and "a" in body and "b" in body:
        ok("GET /compare?a=chiller_1&b=chiller_2 -> 200", s)
        a_kpt = body["a"].get("summary", {}).get("avg_kw_per_tr")
        b_kpt = body["b"].get("summary", {}).get("avg_kw_per_tr")
        a_s = f"{a_kpt:.3f}" if a_kpt is not None else "N/A"
        b_s = f"{b_kpt:.3f}" if b_kpt is not None else "N/A"
        ok(f"  chiller_1 kW/TR={a_s}, chiller_2={b_s}", s)
        ok(f"  better_efficiency={body.get('better_efficiency','?')}", s)
        # Check timeseries present
        a_ts = body["a"].get("timeseries", [])
        b_ts = body["b"].get("timeseries", [])
        ok(f"  chiller_1 timeseries pts={len(a_ts)}, chiller_2={len(b_ts)}", s)
    else:
        fail("GET /compare?a=chiller_1&b=chiller_2", f"HTTP {code}", s)

    # Different equipment types
    code, body = get("/api/v1/compare?a=chiller_1&b=cooling_tower_1&hours=24")
    if code == 200:
        ok("GET /compare mixed types (chiller + ct) -> 200", s)
    else:
        fail("GET /compare mixed types", f"HTTP {code}", s)

    # Unknown equipment
    code, _ = get("/api/v1/compare?a=chiller_1&b=bad_eq")
    if code == 404:
        ok("GET /compare with unknown eq -> 404 (correct)", s)
    else:
        fail("GET /compare with unknown eq should be 404", f"got {code}", s)


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 3 -- Advanced Features
# ═════════════════════════════════════════════════════════════════════════════

def test_maintenance():
    section("Phase 3 -- Predictive Maintenance")
    s = "Maintenance"

    for hours in [24, 168]:
        code, body = get(f"/api/v1/maintenance?hours={hours}")
        if code == 200 and "assets" in body:
            assets = body["assets"]
            ok(f"GET /maintenance?hours={hours} -> {len(assets)} assets", s)
            for a in assets[:3]:
                sc = a.get("score")
                sc_s = f"{sc:.0f}" if sc is not None else "?"
                ok(f"  {a.get('name','?')}: score={sc_s}/100 grade={a.get('grade','?')}", s)
                if a.get("flags"):
                    ok(f"    flags: {', '.join(a['flags'][:3])}", s)
                if a.get("recommendations"):
                    ok(f"    {len(a['recommendations'])} recommendation(s)", s)
        else:
            fail(f"GET /maintenance?hours={hours}", f"HTTP {code}", s)

    # Single equipment — field is health_score not score
    code, body = get("/api/v1/maintenance/chiller_1?hours=168")
    if code == 200 and "health_score" in body:
        hs = body.get("health_score","?")
        ok(f"GET /maintenance/chiller_1 -> health_score={hs} degradation={body.get('degradation_flag','?')}", s)
    else:
        fail("GET /maintenance/chiller_1", f"HTTP {code} keys={list(body.keys()) if isinstance(body,dict) else '?'}", s)


def test_cost():
    section("Phase 3 -- Cost Analytics")
    s = "Cost"

    for hours in [24, 168]:
        code, body = get(f"/api/v1/cost?hours={hours}")
        if code == 200 and "total_kwh" in body:
            kwh = body["total_kwh"]
            inr = body.get("total_inr")
            inr_s = f"{inr:.2f}" if inr is not None else "?"
            ok(f"GET /cost?hours={hours} -> total_kwh={kwh:.1f} total_inr=Rs{inr_s}", s)
            eq_list = body.get("equipment", [])
            ok(f"  {len(eq_list)} equipment entries in breakdown", s)
            for eq in eq_list[:3]:
                kwh_e = eq.get("kwh",0)
                pct   = eq.get("pct_of_plant",0)
                ok(f"  {eq.get('name','?')}: {kwh_e:.1f} kWh ({pct:.1f}%)", s)
        else:
            fail(f"GET /cost?hours={hours}", f"HTTP {code}", s)


def test_cooling_tower():
    section("Phase 3 -- Cooling Tower Optimizer")
    s = "CT Optimizer"

    for ct_id in ["cooling_tower_1", "cooling_tower_2"]:
        code, body = get(f"/api/v1/cooling-tower/{ct_id}/optimize?hours=24")
        if code == 200 and "staging_hint" in body:
            hint = body["staging_hint"]
            duty = body.get("current_duty_pct","?")
            saving = body.get("estimated_saving_kwh","?")
            ok(f"GET /cooling-tower/{ct_id}/optimize -> hint present", s)
            ok(f"  duty={duty}% saving={saving} kWh", s)
        else:
            fail(f"GET /cooling-tower/{ct_id}/optimize", f"HTTP {code}", s)

    # Wrong equipment type
    code, _ = get("/api/v1/cooling-tower/chiller_1/optimize?hours=24")
    if code in [400, 404]:
        ok("GET /cooling-tower/chiller_1/optimize -> 400/404 (correct -- not a CT)", s)
    else:
        fail("GET /cooling-tower/chiller_1/optimize should fail", f"got {code}", s)


def test_reports():
    section("Phase 3 -- Report Builder")
    s = "Reports"

    if QUICK:
        skip("POST /reports/daily", "QUICK mode", s)
        return

    t0 = time.time()
    code, raw = post("/api/v1/reports/daily", {"hours": 24}, timeout=60)
    elapsed = time.time() - t0

    if code == 200 and isinstance(raw, dict):
        ok(f"POST /reports/daily -> JSON ({elapsed:.1f}s)", s)
        ok(f"  period: {str(raw.get('period_from',''))[:10]} to {str(raw.get('period_to',''))[:10]}", s)
        ok(f"  total_kwh={raw.get('total_kwh','?')}", s)
        # report returns full markdown document in 'markdown' field
        md = raw.get("markdown", "")
        if md:
            ok(f"  markdown report present ({len(md)} chars)", s)
            for section_heading in ["What happened", "What it cost", "What to act on"]:
                if section_heading.lower() in md.lower():
                    ok(f"  contains '{section_heading}' section", s)
                else:
                    fail(f"  missing '{section_heading}' section", "", s)
        else:
            fail("  no markdown in response", str(list(raw.keys())), s)
        if raw.get("total_cost_inr") is not None:
            ok(f"  total_cost_inr=Rs{raw['total_cost_inr']:.2f}", s)
    else:
        preview = str(raw)[:120] if raw else "(empty)"
        fail("POST /reports/daily", f"HTTP {code} | {preview}", s)


def test_threads():
    section("Phase 3 -- Conversational Memory (Threads)")
    s = "Threads"

    # Create thread
    code, body = post("/api/v1/threads", {})
    if code != 200 or not body.get("id"):
        fail("POST /threads", f"HTTP {code}", s)
        return None
    thread_id = body["id"]
    ok(f"POST /threads -> id={thread_id[:8]}...", s)

    # List threads
    code, body = get("/api/v1/threads")
    if code == 200 and "threads" in body:
        ok(f"GET /threads -> {len(body['threads'])} thread(s)", s)
    else:
        fail("GET /threads", f"HTTP {code}", s)

    # Get single thread
    code, body = get(f"/api/v1/threads/{thread_id}")
    if code == 200 and body.get("id") == thread_id:
        ok(f"GET /threads/{thread_id[:8]}... -> 200", s)
    else:
        fail(f"GET /threads/{{id}}", f"HTTP {code}", s)

    # Get messages (empty at start)
    code, body = get(f"/api/v1/threads/{thread_id}/messages")
    if code == 200 and "messages" in body:
        ok(f"GET /threads/{{id}}/messages -> {len(body['messages'])} msg(s)", s)
    else:
        fail("GET /threads/{id}/messages", f"HTTP {code}", s)

    # Use thread in analyze (if not QUICK)
    if not QUICK:
        code, raw = post("/api/v1/analyze",
                         {"question": "What is Chiller 1 efficiency?",
                          "equipment_id": "chiller_1", "hours": 6,
                          "thread_id": thread_id}, timeout=35)
        if code == 200 and isinstance(raw, str) and sse_has(raw, "token"):
            ok("POST /analyze with thread_id -> SSE OK", s)
            # Check message was persisted
            time.sleep(1)
            code2, body2 = get(f"/api/v1/threads/{thread_id}/messages")
            if code2 == 200 and len(body2.get("messages", [])) >= 2:
                ok(f"  thread now has {len(body2['messages'])} messages (Q+A persisted)", s)
            else:
                fail("  messages not persisted after analyze", str(body2), s)
        else:
            fail("POST /analyze with thread_id", f"HTTP {code} | {str(raw)[:80]}", s)

    # Delete (soft)
    code, _ = delete(f"/api/v1/threads/{thread_id}")
    if code == 200:
        ok(f"DELETE /threads/{{id}} -> 200", s)
    else:
        fail(f"DELETE /threads/{{id}}", f"HTTP {code}", s)

    # Unknown thread
    code, _ = get("/api/v1/threads/00000000-0000-0000-0000-000000000000/messages")
    if code == 404:
        ok("GET /threads/unknown -> 404 (correct)", s)
    else:
        fail("GET /threads/unknown should be 404", f"got {code}", s)

    return thread_id


def test_agents():
    section("Phase 3 -- AI Agents (5 modes + tool-calling)")
    s = "Agents"

    # History endpoint
    code, body = get("/api/v1/agent/history?limit=10")
    if code == 200 and "runs" in body:
        ok(f"GET /agent/history -> {body.get('total',0)} run(s) logged", s)
    else:
        fail("GET /agent/history", f"HTTP {code}", s)

    if QUICK:
        skip("Agent mode runs (investigator, brief, root_cause)", "QUICK mode", s)
        return

    modes_to_test = [
        ("brief",       "One sentence: is the plant running normally?",         None),
        ("investigator","Check chiller_1 efficiency briefly.",                  {"equipment_id":"chiller_1","hours":6}),
        ("optimizer",   "Name one energy saving action.",                       None),
        ("root_cause",  "Why might chiller kW/TR be high? One sentence.",       None),
        ("maintenance", "Which equipment needs attention most? One sentence.",   None),
    ]

    for mode, goal, ctx in modes_to_test:
        t0 = time.time()
        code, raw = post("/api/v1/agent/run",
                         {"mode": mode, "goal": goal, "context": ctx},
                         timeout=50)
        elapsed = time.time() - t0

        if code == 200 and isinstance(raw, str) and sse_has(raw, "token"):
            steps = sse_value(raw, "done", "steps") or 0
            ok(f"POST /agent/run mode={mode} -> SSE ({elapsed:.1f}s, {steps} steps)", s)
            if sse_has(raw, "done"):
                ok(f"  done frame present", s)
            else:
                fail(f"  no done frame in {mode}", "", s)
            # Check tool calls appear in trace (for investigator/optimizer)
            if mode in ("investigator", "optimizer") and sse_has(raw, "tool_call"):
                ok(f"  tool_call frames present (agent used tools)", s)
        else:
            preview = str(raw)[:150] if raw else "(empty -- Decimal serialization bug?)"
            fail(f"POST /agent/run mode={mode}", f"HTTP {code} | {preview}", s)

    # Invalid mode
    code, raw = post("/api/v1/agent/run", {"mode": "invalid", "goal": "test"}, timeout=10)
    if code == 200 and isinstance(raw, str) and sse_has(raw, "error"):
        ok("POST /agent/run mode=invalid -> SSE error frame (correct)", s)
    else:
        fail("POST /agent/run mode=invalid should return error frame", f"got {code}", s)


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 4 -- RAG
# ═════════════════════════════════════════════════════════════════════════════

def test_rag():
    section("Phase 4 -- RAG / Knowledge Base")
    s = "RAG"

    code, body = get("/api/v1/rag/status")
    if code != 200:
        fail("GET /rag/status", f"HTTP {code}", s)
        return

    ready  = body.get("ready", False)
    chunks = body.get("total_chunks", 0)
    ok(f"GET /rag/status -> ready={ready} total_chunks={chunks}", s)

    if body.get("sources"):
        for src in body["sources"][:3]:
            ok(f"  source={src.get('source_id','?')} chunks={src.get('chunks',0)}", s)

    if not ready:
        skip("GET /rag/search", "corpus empty -- run scripts/ingest_docs.py first", s)
        skip("POST /analyze with RAG citations", "corpus empty", s)
        print(f"\n  {Y}To enable RAG:{X}")
        print(f"  1. Place PDF/TXT/MD in docs/manuals/")
        print(f"  2. cd backend && python scripts/ingest_docs.py --dir ../docs/manuals")
        return

    # Search
    for query in ["maintenance interval", "condenser cleaning", "chiller efficiency"]:
        code, body = get(f"/api/v1/rag/search?q={urllib.parse.quote(query)}&top_k=3")
        if code == 200 and "results" in body:
            n = body.get("total", 0)
            ok(f"GET /rag/search?q='{query}' -> {n} result(s)", s)
            for r in body["results"][:2]:
                ok(f"  [{r.get('score',0):.2f}] {r.get('source_id','?')} §{r.get('chunk_idx','?')}", s)
        else:
            fail(f"GET /rag/search?q='{query}'", f"HTTP {code}", s)

    # Embed test
    if not QUICK:
        code, raw = post("/api/v1/analyze",
                         {"question": "What does the manual say about condenser cleaning intervals?",
                          "equipment_id": "chiller_1", "hours": 6}, timeout=40)
        if code == 200 and isinstance(raw, str) and sse_has(raw, "token"):
            full_text = "".join(
                json.loads(l[6:]).get("content","")
                for l in raw.split("\n")
                if l.startswith("data:") and '"type":"token"' in l
            )
            if "[source:" in full_text.lower() or "source:" in full_text.lower():
                ok("POST /analyze cites RAG sources ([source: ...] present)", s)
            else:
                fail("POST /analyze did not cite RAG sources", "no [source: ...] in response", s)
        else:
            fail("POST /analyze with RAG", f"HTTP {code}", s)


# ═════════════════════════════════════════════════════════════════════════════
# Error handling checks
# ═════════════════════════════════════════════════════════════════════════════

def test_error_handling():
    section("Error Handling -- 4xx responses (not 500s)")
    s = "Errors"

    cases = [
        ("GET",  "/api/v1/equipment/unknown/timeseries?hours=24", 404, "unknown equipment"),
        ("GET",  "/api/v1/efficiency/cooling_tower_1?hours=24",   400, "non-chiller efficiency"),
        ("GET",  "/api/v1/compare?a=chiller_1&b=bad_eq",          404, "unknown compare eq"),
        ("GET",  "/api/v1/analyze",                               405, "GET on POST-only /analyze"),
        ("GET",  "/api/v1/agent/run",                             405, "GET on POST-only /agent/run"),
        ("GET",  "/api/v1/nonexistent",                           404, "nonexistent endpoint"),
    ]

    for method, path, expected_code, label in cases:
        code, _ = get(path) if method == "GET" else post(path, {})
        if code == expected_code:
            ok(f"  {method} {path} -> {expected_code} ({label})", s)
        else:
            fail(f"  {method} {path} -> expected {expected_code}", f"got {code}", s)

    # POST /analyze with missing question
    code, body = post("/api/v1/analyze", {"equipment_id": "chiller_1", "hours": 24})
    if code == 422:
        ok("  POST /analyze missing question -> 422 Unprocessable", s)
    else:
        fail("  POST /analyze missing question should be 422", f"got {code}", s)


# ═════════════════════════════════════════════════════════════════════════════
# Summary
# ═════════════════════════════════════════════════════════════════════════════

def print_summary():
    total = passed + failed + skipped
    sep = "-" * 56
    print(f"\n{sep}")
    print(f"  {B}RESULTS: {G}{passed} passed{X}{B}  {R}{failed} failed{X}{B}  {Y}{skipped} skipped{X}{B}  / {total}{X}")
    print(f"{sep}")

    if failed > 0:
        print(f"\n{R}{B}Failed checks:{X}")
        for status, sec, msg in _results:
            if status == "FAIL":
                print(f"  {R}[{sec}]{X} {msg}")

    if failed == 0:
        print(f"\n  {G}{B}All checks passed -- THERMYNX is working end-to-end.{X}\n")
    else:
        print(f"\n  {R}{B}{failed} check(s) failed -- see details above.{X}\n")


# ═════════════════════════════════════════════════════════════════════════════
# Main
# ═════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="THERMYNX End-to-End Test Suite")
    parser.add_argument("--base",  default="http://localhost:8000")
    parser.add_argument("--quick", action="store_true",
                        help="Skip long LLM calls (analyze, agent, reports)")
    args = parser.parse_args()

    BASE  = args.base
    QUICK = args.quick

    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n{B}THERMYNX End-to-End Test Suite{X}")
    print(f"Target : {BASE}")
    print(f"Started: {ts}")
    if QUICK:
        print(f"Mode   : QUICK (LLM streaming tests skipped)\n")
    else:
        print(f"Mode   : FULL (all tests including LLM streaming)\n")

    # Run all test groups
    test_core()
    test_equipment()
    test_summary()
    test_timeseries()
    test_analyze()

    test_efficiency()
    test_anomalies()
    test_forecast()
    test_compare()

    test_maintenance()
    test_cost()
    test_cooling_tower()
    test_reports()
    test_threads()
    test_agents()

    test_rag()
    test_error_handling()

    print_summary()
    sys.exit(0 if failed == 0 else 1)
