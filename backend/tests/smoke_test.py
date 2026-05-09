"""
Phase 1 smoke test -- run against a live backend before tagging a release.

Usage:
    cd backend
    python tests/smoke_test.py [--base http://localhost:8000]
"""
import sys
import json
import time
import argparse
import urllib.request
import urllib.error

GREEN  = "\033[32m"
RED    = "\033[31m"
YELLOW = "\033[33m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

passed = 0
failed = 0


def ok(msg):
    global passed
    passed += 1
    print(f"  {GREEN}[OK]{RESET}  {msg}")


def fail(msg, detail=""):
    global failed
    failed += 1
    extra = f" - {YELLOW}{detail}{RESET}" if detail else ""
    print(f"  {RED}[FAIL]{RESET}  {msg}{extra}")


def get(url, timeout=10):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, {}
    except Exception as e:
        return 0, {"error": str(e)}


def post(url, body, timeout=60):
    data = json.dumps(body).encode()
    req  = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            ct = r.headers.get("Content-Type", "")
            raw = r.read().decode()
            if "event-stream" in ct:
                return r.status, raw   # raw SSE text
            return r.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        return e.code, {}
    except Exception as e:
        return 0, {"error": str(e)}


def section(title):
    print(f"\n{BOLD}{title}{RESET}")


def run(base: str):
    section("1. Liveness")
    code, body = get(f"{base}/healthz")
    if code == 200 and body.get("status") == "ok":
        ok("GET /healthz -> 200 ok")
    else:
        fail("GET /healthz", f"{code} {body}")

    section("2. Health (DB + Ollama)")
    code, body = get(f"{base}/api/v1/health")
    if code == 200:
        ok(f"GET /api/v1/health -> 200")
        if body.get("db", {}).get("connected"):
            ok("MySQL unicharm connected")
        else:
            fail("MySQL unicharm NOT connected", str(body.get("db")))
        if body.get("ollama", {}).get("connected"):
            ok(f"Ollama connected  model={body['ollama'].get('default_model')}")
        else:
            fail("Ollama NOT connected -- streaming will fail", str(body.get("ollama")))
    else:
        fail("GET /api/v1/health", f"{code}")

    section("3. Equipment catalog")
    code, body = get(f"{base}/api/v1/equipment")
    if code == 200 and isinstance(body, list) and len(body) >= 6:
        ok(f"GET /api/v1/equipment -> {len(body)} entries")
        ids = [e["id"] for e in body]
        for expected in ["chiller_1", "chiller_2", "cooling_tower_1"]:
            if expected in ids:
                ok(f"  found {expected}")
            else:
                fail(f"  missing {expected}")
    else:
        fail("GET /api/v1/equipment", f"{code} body={body}")

    section("4. Equipment summary (Dashboard)")
    code, body = get(f"{base}/api/v1/equipment/summary?hours=24")
    if code == 200 and "summary" in body:
        s = body["summary"]
        ok("GET /api/v1/equipment/summary -> 200")
        for eq in ["chiller_1", "chiller_2"]:
            kw_per_tr = s.get(eq, {}).get("avg_kw_per_tr")
            if kw_per_tr is not None:
                band = "good" if kw_per_tr < 0.65 else "acceptable" if kw_per_tr < 0.85 else "poor"
                ok(f"  {eq}: kW/TR={kw_per_tr:.3f} ({band})")
            else:
                fail(f"  {eq}: no kW/TR data (equipment may be off)")
    else:
        fail("GET /api/v1/equipment/summary", f"{code}")

    section("5. Timeseries (chiller_1, 24h)")
    code, body = get(f"{base}/api/v1/equipment/chiller_1/timeseries?hours=24&resolution=15m")
    if code == 200 and "points" in body:
        n = body["count"]
        ok(f"GET /api/v1/equipment/chiller_1/timeseries -> {n} points")
        if n >= 10:
            ok("  sufficient data for analysis")
        else:
            fail(f"  only {n} points -- check DB connectivity or time range")
    else:
        fail("GET /api/v1/equipment/chiller_1/timeseries", f"{code}")

    section("6. SSE streaming /analyze (first-token latency)")
    t0 = time.time()
    code, raw = post(
        f"{base}/api/v1/analyze",
        {"question": "What is chiller 1 kW/TR right now?", "equipment_id": "chiller_1", "hours": 6},
        timeout=30,
    )
    elapsed = time.time() - t0

    if code == 200 and isinstance(raw, str) and "data:" in raw:
        ok(f"POST /api/v1/analyze -> SSE stream received  ({elapsed:.1f}s total)")
        # Check first-token latency by finding first data frame
        lines = raw.split("\n")
        got_token = any("\"type\": \"token\"" in l or '"type":"token"' in l for l in lines)
        got_done  = any("\"type\": \"done\""  in l or '"type":"done"'  in l for l in lines)
        if got_token:
            ok("  received token frames")
        else:
            fail("  no token frames in response")
        if got_done:
            ok(f"  stream completed (done frame present)")
        else:
            fail("  no done frame -- stream may have errored")
        if elapsed < 8:
            ok(f"  latency {elapsed:.1f}s < 8s target")
        else:
            fail(f"  latency {elapsed:.1f}s exceeds 8s target")
    else:
        fail(f"POST /api/v1/analyze", f"HTTP {code}")

    section("7. Predictive maintenance (Phase 3)")
    code, body = get(f"{base}/api/v1/maintenance?hours=24")
    if code == 200 and "assets" in body and len(body["assets"]) >= 1:
        ok(f"GET /api/v1/maintenance -> {len(body['assets'])} assets")
    else:
        fail("GET /api/v1/maintenance", f"{code}")

    section("8. Cost analytics (Phase 3)")
    code, body = get(f"{base}/api/v1/cost?hours=24")
    if code == 200 and "total_kwh" in body and "equipment" in body:
        ok(f"GET /api/v1/cost -> total_kwh={body['total_kwh']}")
    else:
        fail("GET /api/v1/cost", f"{code}")

    section("9. Threads API (Phase 3)")
    code, body = post(f"{base}/api/v1/threads", {})
    if code == 200 and body.get("id"):
        ok(f"POST /api/v1/threads -> id={body['id'][:8]}...")
        tid = body["id"]
        code2, body2 = get(f"{base}/api/v1/threads/{tid}/messages")
        if code2 == 200 and "messages" in body2:
            ok(f"GET /api/v1/threads/{{id}}/messages -> {len(body2['messages'])} msgs")
        else:
            fail("GET thread messages", f"{code2}")
    else:
        fail("POST /api/v1/threads", f"{code}")

    section("10. Cooling tower optimizer hint")
    code, body = get(f"{base}/api/v1/cooling-tower/cooling_tower_1/optimize?hours=24")
    if code == 200 and "staging_hint" in body:
        ok("GET /api/v1/cooling-tower/cooling_tower_1/optimize -> hint present")
    else:
        fail("GET cooling tower optimize", f"{code}")

    # Summary
    total = passed + failed
    print(f"\n{'-'*40}")
    print(f"  {BOLD}Results: {GREEN}{passed} passed{RESET}{BOLD}, {RED}{failed} failed{RESET}{BOLD} / {total} total{RESET}")
    print(f"{'-'*40}\n")

    if failed == 0:
        print(f"  {GREEN}{BOLD}All checks passed. Safe to tag v0.1.0-poc.{RESET}\n")
    else:
        print(f"  {RED}{BOLD}Fix the failing checks before tagging.{RESET}\n")

    return failed == 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:8000", help="Backend base URL")
    args = parser.parse_args()
    print(f"\n{BOLD}THERMYNX Phase 1+ Smoke Test{RESET}")
    print(f"Target: {args.base}\n")
    ok_result = run(args.base)
    sys.exit(0 if ok_result else 1)
