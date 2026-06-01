# THERMYNX — Live Demo Script

**Audience:** Anyone presenting the AI platform to a non-engineering audience (prospects, internal stakeholders, friendly customers).
**Duration:** 12-15 minutes of live clicking + 5 min Q&A.
**Last updated:** 2026-06-01 · Verified against backend commit `59cd4b7`.

---

## Pre-flight (15 minutes before demo)

> Do this even if you "just ran it yesterday." Skipping = embarrassment.

1. **Verify all services are green** — open these tabs:
   - http://localhost:8000/api/v1/health → JSON shows `"status":"ok"`, `db.connected:true`, `ollama.connected:true`, `circuit.open:false`
   - http://localhost:5173 → frontend loads
   - http://localhost:3030 → Grafana login screen
   - http://localhost:9292/targets → Prometheus shows all targets UP

2. **Warm the LLM** — open `/ai`, ask "Is chiller 1 running efficiently?" with `chiller_1` selected, hours=6. Wait for full response. This loads the model into VRAM so the first real demo call is fast.

3. **Disable Windows notifications** + close anything that could pop up over the browser.

4. **Have this doc open on a second monitor / phone** — for the Q&A cheat sheet.

5. **Test sound off** on your machine. (No system beeps mid-pitch.)

---

## The Demo Flow (12 min)

> The whole arc: **"It's intelligent" → "It's safe" → "It's grounded" → "It's production-shaped."**

### Act 1 — Foundation (1 min)
- Open http://localhost:5173 → **System** page.
- "Here's the live status of every service in the platform. Backend, MySQL telemetry, Postgres app DB, Redis cache, Ollama (our on-prem LLM with 12 models loaded), and the full observability stack (Prometheus, Loki, Grafana). All green."
- Cycle through Grafana briefly to show dashboards exist.

### Act 2 — Quick Ask (2-3 min)
- Navigate **AI Analyzer** (`/ai`).
- Select `Chiller 1` from the dropdown, hours `6`.
- Ask: **"Is chiller 1 running efficiently?"**
- Wait ~15-20 s. Show:
  - Structured markdown with **Findings / Likely Causes / Recommendations**
  - Real kW/TR values from telemetry
  - **Citations panel** below the answer — sources from the HVAC knowledge base
  - **Fact-check panel** ("clean") — our post-generation audit

- Talk track: "Every answer is grounded in real plant telemetry. It cites the playbooks where its recommendations come from. And every numeric claim is automatically checked against the source data — we'll show you the panel that fires when something doesn't match in a minute."

### Act 3 — Safety story (2 min — biggest wow factor)
Three quick questions, all on the same Analyzer page:

1. **"Tell me about chiller 3"** → instant refusal (~2 s, no LLM call).
   - Talk track: "It refused in under a second. There is no chiller 3 in this plant. The system blocks unknown equipment *before* the LLM even sees the question. No chance of fabricating an answer."

2. **"Shut down chiller 1 now"** → instant refusal.
   - Talk track: "Same speed, different refusal. This is a read-only platform by design. The LLM can't be tricked into claiming it took an action it can't actually take. This is enforced at three levels — regex preflight, prompt rules, and code-side guards."

3. **"Why did energy consumption spike between 2 PM and 4 PM on April 22nd?"** → it checks the data, finds no spike, says so.
   - Talk track: "This one's subtle — the question assumes something happened that didn't. The system *checks* before agreeing. No false-alarm work orders for problems that don't exist."

### Act 4 — Autonomous Agents (3 min)
- Switch to **Autonomous Agents** tab (`/ai?mode=agent`).
- Select mode = **investigator**.
- Goal: **"Investigate chiller 1 efficiency over the last 6 hours"** with `chiller_1` + 6h.
- Watch the trace appear in real time: `get_equipment_list` → `compute_efficiency` → `get_timeseries_summary` → final answer.
- Talk track: "The agent decides which tools to call. It pulled efficiency data, checked the timeseries, and gave a structured recommendation. Every step is logged. This is the difference between a chatbot and a system that does work."

If time, switch to **maintenance** mode + same equipment: "Build a maintenance plan." Show the priority 1/2/routine structure.

### Act 5 — NL Query (1-2 min)
- Navigate **NL Query** (`/nl-query`).
- Ask: **"Show 5 latest kW readings for chiller 1"**.
- Show generated SQL + rows returned + auto-chart.
- Talk track: "Operators don't need to know SQL. Same safety rails apply — we'll refuse to write anything that isn't a read query against the telemetry tables. Try asking it to DROP something."
- Optional: actually demo `DROP TABLE chiller_1_normalized` → 422 refusal.

### Act 6 — Vision (1 min)
- Navigate **Vision** page.
- Upload any plant photo (have one ready). Click **Describe**.
- ~8 s response: JSON with `description`, `findings`, `severity`.
- Talk track: "On-prem vision model for plant audits — gauge reads, dirty coils, leaks. Works against a reference photo too for change detection."

### Act 7 — Production-shape (1 min, optional)
- Show **Grafana** dashboard if time allows.
- Show **Audit log** page (`/audit`) — every AI call has a row, hashable, replayable.
- Talk track: "Everything's auditable. Every AI call, every refusal, every numeric claim that didn't match its source — Prometheus counters, Loki logs, Postgres audit rows."

---

## Q&A Cheat Sheet

| Question | One-line answer |
|---|---|
| **"How do you stop hallucinations?"** | Three layers: preflight regex blocks bad inputs before the LLM, prompt rules force grounding to the data, post-gen audit flags any number/equipment/citation not found in the source. |
| **"Is it secure?"** | Read-only by design. No tool can control equipment. Mapped to OWASP LLM Top 10 — see [`docs/planning/ai/SECURITY_PLAN.md`](../../planning/ai/SECURITY_PLAN.md). |
| **"How fast?"** | Analyzer 15-25 s, agent 10-30 s, simple SQL query 1-2 s. Model is qwen2.5:14b on Tailscale GPU. Model right-sizing planned to cut agent 2-3×. |
| **"What if the LLM is down?"** | Circuit breaker opens after 3 failures, refuses gracefully for 60 s. UI shows a "degraded" banner. Analytics/dashboards still work. |
| **"What model?"** | qwen2.5:14b for text, llama3.2-vision for images, nomic-embed-text for RAG. All on-prem. Zero data leaves the facility. |
| **"How do you test it?"** | 19-case pytest regression suite runs in 90 s. Manual test plan covers 80+ UI scenarios. See [`AI_MANUAL_TEST_PLAN.md`](./AI_MANUAL_TEST_PLAN.md). |
| **"Can it learn from operator feedback?"** | Architecture supports it. Audit log captures every Q&A. Operator-feedback loop is on the next-sprint roadmap. |
| **"Why 14B and not 70B?"** | 14B sits in single-GPU VRAM, runs ~30 tok/sec. 70B needs 2× the hardware for ~10% answer-quality bump. Wrong trade-off for facility-scale. |
| **"What about fine-tuning?"** | Not yet — prompt engineering hits 19/19 evals. Fine-tune when we have 6 months of operator-labeled data + a specific failure prompts can't fix. See `FINE_TUNING_POLICY` (TBD). |
| **"What if I deploy to a different plant?"** | EQUIPMENT_CATALOG is a single source of truth. Swap it + re-ingest knowledge base docs. Prompt rules are plant-agnostic. |
| **"How much does it cost to run?"** | One GPU box for LLM + standard server stack. No per-query API fees. ROI vs SaaS LLMs flips around month 3 of usage. |
| **"Multi-tenant?"** | Single-tenant POC by design. Multi-tenant partitioning is roadmapped, not POC-blocking. |

---

## Things to NOT do mid-demo

| Don't | Why | Workaround |
|---|---|---|
| Ask about "today" or "now" | Telemetry window ends 2026-04-22 | Say "let's look at April 22nd" or use specific dates |
| Run the orchestrator with vague goals | 60-90 s latency feels broken | Use focused multi-step goals only |
| Restart the backend mid-demo | Windows TCP zombies are real | Pre-warm in pre-flight, leave alone |
| Open browser DevTools "for fun" | If anything's noisy, console shows red | Stay in the app UI |
| Show backend logs | Tracebacks from old sessions linger | Only show Grafana / audit log UI |
| Promise the agent has a confirm-button for work orders | We have the proposal output, no UI for confirm yet | Say "operator approval UI is the next polish item" |
| Ask the agent to talk to chiller_2 raw averages | Now safe (0.541 excellent) — but be aware | If you want to be safe, demo chiller_1 |

---

## If something breaks live

| Symptom | Fast recovery |
|---|---|
| Backend returns 500 | Refresh, wait 5 s. If persists, say "let me switch to a different example" and use a known-good case. Don't debug live. |
| LLM takes >30 s | "Our on-prem model loads on-demand. Let me show you something else while it warms" — switch to System Status or Grafana. |
| Refusal text differs slightly from script | Don't read the script aloud — paraphrase. The system is honestly variable across runs. |
| Frontend shows "AI features unavailable" banner | Ollama tunnel might have hiccuped. Cut to System Status / Grafana while it recovers. |
| Audit panel doesn't appear | Check that the question went to /analyze (not /agent). Agent UI audit panel is on the roadmap. |
| Nothing works | Restart backend off-camera: `Stop-Process` python, `uvicorn main:app --port 8000`. Use the time to walk through this doc with the audience. |

---

## After the demo

1. Write down which questions came up. They feed our roadmap.
2. Note any glitches the audience saw — those become eval cases.
3. If a prospect, follow up with [`docs/operations/runbooks/RUNBOOK.md`](./RUNBOOK.md) for the deployment story.

---

## One-line value props (for the closing)

> "Every answer is grounded in the actual plant data. The system refuses to make claims it can't back up. The model never leaves the facility. And every call is auditable from question to citation."

> "This isn't a chatbot. It's a read-only co-pilot that uses tools, cites sources, and audits its own answers before showing them to you."
