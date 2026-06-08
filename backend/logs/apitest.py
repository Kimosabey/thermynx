"""Comprehensive API + feature test harness (scratch; logs/ is gitignored).
Exercises every endpoint + key multi-step flows. Classifies:
  GREEN  = expected 2xx
  AMBER  = reachable but needs a specific body/asset (4xx validation, not a crash)
  RED    = 5xx / timeout / connection error / wrong shape  (real problem)
"""
import json
import httpx

BASE = "http://localhost:8000"
EQ = "chiller_1"
TOWER = "cooling_tower_1"
c = httpx.Client(timeout=60.0)

rows = []  # (group, method, path, code, verdict, note)
def add(group, method, path, code, verdict, note=""):
    rows.append((group, method, path, str(code), verdict, str(note)[:70]))

def classify(code, expect=(200,)):
    if code in expect: return "GREEN"
    if isinstance(code, int) and 400 <= code < 500: return "AMBER"
    return "RED"

def g(group, path, expect=(200,), **params):
    try:
        r = c.get(BASE+path, params=params or None)
        v = classify(r.status_code, expect)
        note = ""
        try:
            j = r.json()
            note = ("keys="+",".join(list(j)[:4])) if isinstance(j, dict) else (f"{len(j)} items" if isinstance(j, list) else "")
        except Exception:
            note = r.text[:40]
        add(group, "GET", path, r.status_code, v, note)
        return r
    except Exception as e:
        add(group, "GET", path, "ERR", "RED", repr(e)); return None

def p(group, path, body=None, expect=(200,)):
    try:
        r = c.post(BASE+path, json=body if body is not None else {})
        v = classify(r.status_code, expect)
        note = "" if v == "GREEN" else r.text[:60]
        add(group, "POST", path, r.status_code, v, note)
        return r
    except Exception as e:
        add(group, "POST", path, "ERR", "RED", repr(e)); return None

def sse(group, path, body, need=()):
    try:
        types = {}
        with c.stream("POST", BASE+path, json=body) as r:
            for line in r.iter_lines():
                if line.startswith("data:"):
                    try: d = json.loads(line[5:].strip())
                    except Exception: continue
                    t = d.get("type"); types[t] = types.get(t, 0)+1
        has_err = "error" in types
        ok = (not has_err) and all(t in types for t in need)
        add(group, "SSE", path, "stream", "GREEN" if ok else "RED", json.dumps(types))
        return types
    except Exception as e:
        add(group, "SSE", path, "ERR", "RED", repr(e)); return {}

# ── Health / meta ─────────────────────────────────────────────────────────────
g("Meta", "/")
g("Meta", "/healthz")
g("Meta", "/metrics")
g("Meta", "/api/v1/health")
g("Meta", "/api/v1/capabilities")

# ── Equipment / telemetry ─────────────────────────────────────────────────────
g("Equipment", "/api/v1/equipment")
g("Equipment", "/api/v1/equipment/summary")
g("Equipment", f"/api/v1/equipment/{EQ}/timeseries", hours=6)
g("Equipment", "/api/v1/topology")

# ── Analytics ─────────────────────────────────────────────────────────────────
g("Analytics", "/api/v1/efficiency", hours=24)
g("Analytics", f"/api/v1/efficiency/{EQ}", hours=24)
g("Analytics", "/api/v1/compare", a="chiller_1", b="chiller_2", hours=24)
g("Analytics", "/api/v1/cost", hours=24)
g("Analytics", f"/api/v1/forecast/{EQ}", hours=24)
g("Analytics", "/api/v1/maintenance")
g("Analytics", f"/api/v1/maintenance/{EQ}")
g("Analytics", f"/api/v1/cooling-tower/{TOWER}/optimize")
g("Analytics", "/api/v1/optimizer/staging")
g("Analytics", "/api/v1/predictive/degradation")

# ── Anomalies / alarms ────────────────────────────────────────────────────────
g("Anomalies", "/api/v1/anomalies/live", hours=24)
g("Anomalies", "/api/v1/anomalies/history", hours=168)
g("Anomalies", "/api/v1/alarms", hours=24)
g("Anomalies", "/api/v1/alarms/stats", hours=24)

# ── Audit ─────────────────────────────────────────────────────────────────────
g("Audit", "/api/v1/audit/stats", hours=24)
g("Audit", "/api/v1/audit/analyses", hours=24, limit=10)
g("Audit", "/api/v1/audit/agents", hours=24, limit=10)
g("Audit", "/api/v1/audit/quality", hours=24)

# ── RAG / knowledge / digest ──────────────────────────────────────────────────
g("RAG", "/api/v1/rag/status")
g("RAG", "/api/v1/rag/search", q="chiller efficiency", top_k=5)
g("Knowledge", "/api/v1/knowledge/incidents")
g("Digest", "/api/v1/digest")
g("Digest", "/api/v1/digest/latest")

# ── Work orders / technicians ─────────────────────────────────────────────────
g("WorkOrders", "/api/v1/work-orders")
g("WorkOrders", "/api/v1/work-orders/stats")
g("Technicians", "/api/v1/technicians")

# ── Agent / threads / slack ───────────────────────────────────────────────────
g("Agent", "/api/v1/agent/history", limit=10)
g("Threads", "/api/v1/threads")
g("Slack", "/api/v1/slack/health")

# ── POST (non-SSE) ────────────────────────────────────────────────────────────
p("NLQuery", "/api/v1/nl-query", {"question": "average kW/TR for chiller 1 over last 24 hours"})
p("Reports", "/api/v1/reports/daily?hours=24")
p("Knowledge", "/api/v1/knowledge/search", {"query": "high kW/TR chiller"})
p("Predictive", "/api/v1/predictive/run")
p("Digest", "/api/v1/digest/run")
# Bodies below may be strict — AMBER (4xx) acceptable, RED (5xx) not:
p("Causal", "/api/v1/causal/explain", {"equipment_id": EQ, "hours": 24})
p("Technicians", "/api/v1/technicians/suggest", {"equipment_id": EQ, "skills": ["chiller"]})
p("Knowledge", "/api/v1/knowledge/capture", {"title": "test", "summary": "test", "equipment_id": EQ})
# Slack inbound: 503 = intentionally not configured (correct); 401/403 = signature gate:
p("Slack", "/api/v1/slack/commands", {"command": "/thermynx", "text": "status"}, expect=(200, 401, 403, 503))
# Vision needs an image → 422 expected (AMBER):
p("Vision", "/api/v1/vision/describe", {}, expect=(200, 422))
p("Vision", "/api/v1/vision/compare", {}, expect=(200, 422))

# ── SSE endpoints ─────────────────────────────────────────────────────────────
sse("Analyzer", "/api/v1/analyze", {"question": "Is chiller 1 efficient?", "equipment_id": EQ, "hours": 6, "verify": False}, need=["token", "done"])
sse("Agent", "/api/v1/agent/run", {"mode": "brief", "goal": "Give a shift brief"}, need=["tool_call", "done"])
sse("Agent", "/api/v1/agent/orchestrate", {"goal": "Compare chiller 1 and 2 efficiency"}, need=["plan", "done"])

# ════════════════════ FLOW TESTS ════════════════════
flows = []
def flow(name, ok, detail=""):
    flows.append((name, "PASS" if ok else "FAIL", detail))

# Flow 1: thread lifecycle
try:
    r = c.post(BASE+"/api/v1/threads", json={"title": "apitest thread"})
    tid = r.json().get("id") if r.status_code == 200 else None
    r2 = c.get(BASE+f"/api/v1/threads/{tid}") if tid else None
    r3 = c.get(BASE+f"/api/v1/threads/{tid}/messages") if tid else None
    r4 = c.delete(BASE+f"/api/v1/threads/{tid}") if tid else None
    ok = bool(tid) and r2.status_code==200 and r3.status_code==200 and r4.status_code in (200,204)
    flow("Thread create→get→messages→delete", ok, f"tid={tid}")
except Exception as e:
    flow("Thread lifecycle", False, repr(e)[:60])

# Flow 2: analyze → operator verdict
try:
    audit_id = None
    with c.stream("POST", BASE+"/api/v1/analyze", json={"question":"Is chiller 1 efficient?","equipment_id":EQ,"hours":6,"verify":False}) as r:
        for line in r.iter_lines():
            if line.startswith("data:"):
                try: d=json.loads(line[5:].strip())
                except: continue
                if d.get("type")=="done": audit_id=d.get("audit_id")
    vr = c.post(BASE+f"/api/v1/audit/{audit_id}/verdict", json={"verdict":"positive"}) if audit_id else None
    ok = bool(audit_id) and vr.status_code==200
    flow("Analyze→audit_id→verdict(positive)", ok, f"audit={audit_id} verdict={vr.status_code if vr else 'n/a'}")
except Exception as e:
    flow("Analyze→verdict", False, repr(e)[:60])

# Flow 3: work order create → get → comment → transition
try:
    wo = c.post(BASE+"/api/v1/work-orders", json={"equipment_id":EQ,"title":"apitest WO","description":"test","priority":"normal"})
    wid = wo.json().get("id") if wo.status_code==200 else None
    gg = c.get(BASE+f"/api/v1/work-orders/{wid}") if wid else None
    cm = c.post(BASE+f"/api/v1/work-orders/{wid}/comments", json={"actor":"apitest","notes":"test comment"}) if wid else None
    tr = c.post(BASE+f"/api/v1/work-orders/{wid}/transition", json={"to_state":"in_progress","actor":"apitest"}) if wid else None
    ok = bool(wid) and gg.status_code==200
    flow("WorkOrder create→get→comment→transition", ok, f"wid={wid} create={wo.status_code} comment={cm.status_code if cm else 'n/a'} transition={tr.status_code if tr else 'n/a'}")
except Exception as e:
    flow("WorkOrder lifecycle", False, repr(e)[:60])

# ════════════════════ REPORT ════════════════════
print("\n================ ENDPOINT CHECKLIST ================")
print(f"{'GRP':<11}{'M':<5}{'PATH':<46}{'CODE':<8}{'VERDICT':<7} NOTE")
counts = {"GREEN":0,"AMBER":0,"RED":0}
for grp,m,path,code,v,note in rows:
    counts[v]+=1
    mark = {"GREEN":"OK ","AMBER":"~  ","RED":"XX "}[v]
    print(f"{grp:<11}{m:<5}{path:<46}{code:<8}{mark}   {note}")
print("\n================ FLOW TESTS ================")
for name,st,det in flows:
    print(f"  [{st}] {name}  — {det}")
print("\n================ SUMMARY ================")
print(f"Endpoints: {len(rows)} tested | GREEN {counts['GREEN']} | AMBER {counts['AMBER']} | RED {counts['RED']}")
reds = [f"{m} {path} ({code}) {note}" for grp,m,path,code,v,note in rows if v=="RED"]
ambers = [f"{m} {path} ({code})" for grp,m,path,code,v,note in rows if v=="AMBER"]
if reds:   print("RED (investigate):\n  " + "\n  ".join(reds))
if ambers: print("AMBER (reachable, needs body/asset):\n  " + "\n  ".join(ambers))
flow_fail = [n for n,st,_ in flows if st=="FAIL"]
print(f"Flows: {len(flows)-len(flow_fail)}/{len(flows)} passed" + (f" | FAILED: {flow_fail}" if flow_fail else ""))
