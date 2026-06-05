"""End-to-end API smoke suite — exercises every endpoint + key flows.

Requires the backend running on :8000 (skips cleanly if not). Mirrors the
golden-eval pattern (backend must be live). Run:

    cd backend && ../.venv/Scripts/pytest tests/test_api_smoke.py -q

Verdict rules:
  * GET/most POST  -> assert 2xx (or the documented validation code).
  * SSE            -> assert required frame types present, no 'error' frame.
  * Flows          -> multi-step assertions (create -> read -> mutate).
  * Strict-body POSTs (causal/explain, technicians/suggest, knowledge/capture)
    assert 422 (validation), proving reachability without fabricating a body.
"""
import base64
import json

import httpx
import pytest

BASE = "http://localhost:8000"
EQ = "chiller_1"
TOWER = "cooling_tower_1"

# 1x1 transparent PNG — enough to exercise the vision route end-to-end.
_PNG_1x1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


def _backend_up() -> bool:
    try:
        return httpx.get(f"{BASE}/healthz", timeout=3.0).status_code < 500
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _backend_up(), reason="backend not running on :8000")


@pytest.fixture(scope="module")
def client():
    with httpx.Client(timeout=180.0) as c:
        yield c


# ── GET endpoints: (path, params, expected_codes) ────────────────────────────
GET_ENDPOINTS = [
    ("/", None, (200,)),
    ("/healthz", None, (200,)),
    ("/metrics", None, (200,)),
    ("/api/v1/health", None, (200,)),
    ("/api/v1/capabilities", None, (200,)),
    ("/api/v1/equipment", None, (200,)),
    ("/api/v1/equipment/summary", None, (200,)),
    (f"/api/v1/equipment/{EQ}/timeseries", {"hours": 6}, (200,)),
    ("/api/v1/topology", None, (200,)),
    ("/api/v1/efficiency", {"hours": 24}, (200,)),
    (f"/api/v1/efficiency/{EQ}", {"hours": 24}, (200,)),
    ("/api/v1/compare", {"a": "chiller_1", "b": "chiller_2", "hours": 24}, (200,)),
    ("/api/v1/cost", {"hours": 24}, (200,)),
    (f"/api/v1/forecast/{EQ}", {"hours": 24}, (200,)),
    ("/api/v1/maintenance", None, (200,)),
    (f"/api/v1/maintenance/{EQ}", None, (200,)),
    (f"/api/v1/cooling-tower/{TOWER}/optimize", None, (200,)),
    ("/api/v1/optimizer/staging", None, (200,)),
    ("/api/v1/predictive/degradation", None, (200,)),
    ("/api/v1/anomalies/live", {"hours": 24}, (200,)),
    ("/api/v1/anomalies/history", {"hours": 168}, (200,)),
    ("/api/v1/alarms", {"hours": 24}, (200,)),
    ("/api/v1/alarms/stats", {"hours": 24}, (200,)),
    ("/api/v1/audit/stats", {"hours": 24}, (200,)),
    ("/api/v1/audit/analyses", {"hours": 24, "limit": 10}, (200,)),
    ("/api/v1/audit/agents", {"hours": 24, "limit": 10}, (200,)),
    ("/api/v1/audit/quality", {"hours": 24}, (200,)),
    ("/api/v1/rag/status", None, (200,)),
    ("/api/v1/rag/search", {"q": "chiller efficiency", "top_k": 5}, (200,)),
    ("/api/v1/knowledge/incidents", None, (200,)),
    ("/api/v1/digest", None, (200,)),
    ("/api/v1/digest/latest", None, (200,)),
    ("/api/v1/work-orders", None, (200,)),
    ("/api/v1/work-orders/stats", None, (200,)),
    ("/api/v1/technicians", None, (200,)),
    ("/api/v1/agent/history", {"limit": 10}, (200,)),
    ("/api/v1/threads", None, (200,)),
    ("/api/v1/slack/health", None, (200,)),
]


@pytest.mark.parametrize("path,params,expected", GET_ENDPOINTS, ids=[e[0] for e in GET_ENDPOINTS])
def test_get_endpoint(client, path, params, expected):
    r = client.get(f"{BASE}{path}", params=params)
    assert r.status_code in expected, f"{path} -> {r.status_code}: {r.text[:160]}"


# ── POST endpoints: (path, body, expected_codes) ─────────────────────────────
POST_ENDPOINTS = [
    ("/api/v1/nl-query", {"question": "average kW/TR for chiller 1 over last 24 hours"}, (200,)),
    ("/api/v1/reports/daily?hours=24", {}, (200,)),
    ("/api/v1/knowledge/search", {"query": "high kW/TR chiller"}, (200,)),
    ("/api/v1/predictive/run", {}, (200,)),
    ("/api/v1/digest/run", {}, (200,)),
    # Strict-body endpoints: 422 proves reachable + validating (no fabricated body):
    ("/api/v1/causal/explain", {"equipment_id": EQ, "hours": 24}, (200, 422)),
    ("/api/v1/technicians/suggest", {"equipment_id": EQ}, (200, 422)),
    ("/api/v1/knowledge/capture", {"title": "t", "equipment_id": EQ}, (200, 422)),
    # Slack inbound: 503 (not configured, intentional) or 401/403 (signature gate):
    ("/api/v1/slack/commands", {"command": "/thermynx", "text": "status"}, (200, 401, 403, 503)),
]


@pytest.mark.parametrize("path,body,expected", POST_ENDPOINTS, ids=[e[0] for e in POST_ENDPOINTS])
def test_post_endpoint(client, path, body, expected):
    # The `expected` tuple is the contract: any code not listed (incl. unexpected
    # 5xx) fails. 503 from slack/commands is the documented "not configured" reply.
    r = client.post(f"{BASE}{path}", json=body)
    assert r.status_code in expected, f"{path} -> {r.status_code}: {r.text[:160]}"


# ── SSE streaming endpoints ──────────────────────────────────────────────────
def _stream_types(client, path, body):
    types: dict[str, int] = {}
    with client.stream("POST", f"{BASE}{path}", json=body) as r:
        for line in r.iter_lines():
            if line.startswith("data:"):
                try:
                    d = json.loads(line[5:].strip())
                except Exception:
                    continue
                t = d.get("type")
                types[t] = types.get(t, 0) + 1
    return types


def test_sse_analyze(client):
    types = _stream_types(client, "/api/v1/analyze",
                          {"question": "Is chiller 1 efficient?", "equipment_id": EQ, "hours": 6, "verify": False})
    assert "error" not in types, types
    assert types.get("token", 0) > 0 and types.get("done", 0) == 1, types


def test_sse_agent_run(client):
    types = _stream_types(client, "/api/v1/agent/run", {"mode": "brief", "goal": "Give a shift brief"})
    assert "error" not in types, types
    assert types.get("tool_call", 0) > 0 and types.get("done", 0) == 1, types


def test_sse_agent_orchestrate(client):
    types = _stream_types(client, "/api/v1/agent/orchestrate", {"goal": "Compare chiller 1 and 2 efficiency"})
    assert "error" not in types, types
    assert types.get("plan", 0) == 1 and types.get("done", 0) == 1, types
    assert types.get("delegate_error", 0) == 0, f"sub-agent failed: {types}"


# ── Multi-step flows ─────────────────────────────────────────────────────────
def test_flow_thread_lifecycle(client):
    r = client.post(f"{BASE}/api/v1/threads", json={"title": "smoke thread"})
    assert r.status_code == 200, r.text
    tid = r.json()["id"]
    assert client.get(f"{BASE}/api/v1/threads/{tid}").status_code == 200
    assert client.get(f"{BASE}/api/v1/threads/{tid}/messages").status_code == 200
    assert client.delete(f"{BASE}/api/v1/threads/{tid}").status_code in (200, 204)


def test_flow_analyze_then_verdict(client):
    audit_id = None
    with client.stream("POST", f"{BASE}/api/v1/analyze",
                       json={"question": "Is chiller 1 efficient?", "equipment_id": EQ, "hours": 6, "verify": False}) as r:
        for line in r.iter_lines():
            if line.startswith("data:"):
                try:
                    d = json.loads(line[5:].strip())
                except Exception:
                    continue
                if d.get("type") == "done":
                    audit_id = d.get("audit_id")
    assert audit_id, "no audit_id from analyze done frame"
    vr = client.post(f"{BASE}/api/v1/audit/{audit_id}/verdict", json={"verdict": "positive"})
    assert vr.status_code == 200, vr.text


def test_flow_workorder_lifecycle(client):
    wo = client.post(f"{BASE}/api/v1/work-orders",
                     json={"equipment_id": EQ, "title": "smoke WO", "description": "test", "priority": "normal"})
    assert wo.status_code == 200, wo.text
    wid = wo.json()["id"]
    assert client.get(f"{BASE}/api/v1/work-orders/{wid}").status_code == 200
    assert client.post(f"{BASE}/api/v1/work-orders/{wid}/comments",
                       json={"actor": "smoke", "notes": "test comment"}).status_code == 200
    assert client.post(f"{BASE}/api/v1/work-orders/{wid}/transition",
                       json={"to_state": "in_progress", "actor": "smoke"}).status_code == 200


# ── Previously-uncovered routes, now with fixtures (b) ───────────────────────
def test_workorder_assign(client):
    """POST /work-orders/{id}/assign — needs a real technician id (a 'person')."""
    techs = client.get(f"{BASE}/api/v1/technicians").json().get("technicians", [])
    assert techs, "no technicians (persons) seeded"
    tech_id = techs[0]["id"]
    wo = client.post(f"{BASE}/api/v1/work-orders",
                     json={"equipment_id": EQ, "title": "assign-test WO", "description": "t", "priority": "low"})
    wid = wo.json()["id"]
    r = client.post(f"{BASE}/api/v1/work-orders/{wid}/assign",
                    json={"technician_id": tech_id, "actor": "smoke"})
    assert r.status_code == 200, r.text


def test_rag_ingest_then_delete(client):
    """POST /rag/ingest (multipart) + DELETE /rag/sources/{id} — throwaway doc, self-cleaning."""
    fname = "smoke_test_doc.md"
    content = b"# Smoke Test Doc\nChiller 1 nominal efficiency target is 0.62 kW/TR.\n"
    r = client.post(
        f"{BASE}/api/v1/rag/ingest",
        files={"file": (fname, content, "text/markdown")},
        data={"equipment_tags": "chiller_1", "replace_existing": "true"},
    )
    assert r.status_code == 200, r.text
    # Clean up the throwaway source so real corpus is unchanged.
    d = client.delete(f"{BASE}/api/v1/rag/sources/{fname}")
    assert d.status_code in (200, 204), d.text


def test_vision_describe(client):
    """POST /vision/describe — base64 image (llama3.2-vision; may be slow)."""
    img = base64.b64encode(_PNG_1x1).decode()
    r = client.post(f"{BASE}/api/v1/vision/describe", json={"image": img})
    # 200 = described; 422 = model rejected the degenerate 1x1 — both prove the route works.
    assert r.status_code in (200, 422), r.text
    assert r.status_code < 500, r.text
