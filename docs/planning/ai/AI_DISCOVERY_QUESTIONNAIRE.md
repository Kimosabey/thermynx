# AI Discovery Questionnaire — Session Script

**Use this in the requirements session.** Ask each question, offer the cases as "is it like this, this, or this?", write the answer on the `> Answer:` line.

**Order:** Part A (Purpose) first — it defines what "good" means. Then B (Requirements), then C (Enhancements).

**Tags:** 🎯 Purpose · 📐 Requirement · ✨ Enhancement · ⚙️ Infra/On-prem
**Full rationale + current build status for every question:** see [AI_REQUIREMENTS_DISCOVERY.md](./AI_REQUIREMENTS_DISCOVERY.md).

---

## Part A — Purpose (ask first; defines what "good" means)

**A1 — If the AI could do only ONE thing well, what is it?** 🎯
- Cut chiller energy cost
- Catch faults/degradation early (before failure)
- Speed up root-cause investigation
- Speed up shift handover / status briefing
- Be a credibility/demo asset to win the next facility
> Answer:

**A2 — What are the top 5 questions operators actually ask about the plant today?** 🎯
*(Capture verbatim — these become the agent modes, the tools we build, and the eval cases.)*
- e.g. "why is chiller 2 using more power?"
- e.g. "which chiller should run as lead?"
- e.g. "is anything about to fail?"
- e.g. "what did the night shift miss?"
- e.g. "are we within efficiency target this week?"
> Answer:

**A3 — What's the worst outcome if the AI is confidently WRONG?** 🎯
- Operator acts on a bad recommendation (needless service call / wrong setpoint)
- Trust collapses → nobody uses it
- A real fault is missed because the AI said "all fine"
> Answer:

**A4 — How should the AI sound, and in what language(s)?** 🎯
- Terse one-liners (floor operators) vs explanatory paragraphs (engineers)
- English-only (enforced today) — final, or multilingual later?
> Answer:

**A5 — Advisory only, or should the AI eventually ACT?** 🎯 ⭐ *(the defining decision)*
- **A — Advisory only:** reads data, writes advice, no writes anywhere *(current)*
- **B — Soft actions w/ approval:** drafts a work order / ticket / Slack alert → human approves before it's created
- **C — Operator-applied:** AI suggests a setpoint; operator applies it manually in the BMS
- **D — Closed-loop:** AI writes setpoints directly *(considered out of scope/unsafe — confirm it stays out)*
> Answer (A/B/C/D + if B+, which actions & who approves):

---

## Part B — Requirements (the must-haves the build must satisfy)

**B1 — How non-technical is the LEAST technical user?** 📐
- Types clean English → light NL handling
- Types typos/shorthand ("chillor 1 last nite") → need fuzzy matching
- Barely types → need presets/buttons, not free text
> Answer:

**B2 — Should the agent reason freely or follow guided playbooks?** 📐
- **Free ReAct** *(current):* LLM picks which tools to call, in any order — flexible, occasionally wanders
- **Guided playbook:** "if anomaly found → root_cause path; else → brief path" — predictable, auditable, rigid
> Answer:

**B3 — Is "every claim cited + numbers provably correct" a HARD gate or best-effort?** 📐
- Hard gate → build LLM-as-judge + numeric reference check
- Best-effort → current postchecks are enough for now
> Answer:

**B4 — How much of the AI's reasoning should operators SEE?** 📐
- Full live tool trace + audit flags (engineers)
- Just the answer, trace hidden by default (floor operators)
- Confidence level stated on uncertain answers
> Answer:

**B5 — Is open-source-only firm, with no exceptions ever?** 📐
- Firm — data never leaves the building *(current mandate)*
- Open to Azure OpenAI **Private Endpoint** if data stays in our tenant
> Answer:

**B6 — What GPU and how many concurrent operators?** 📐
- 1 box (RTX 4080/4090-class), 1–3 users → Ollama is fine *(current)*
- 10+ users across shifts → vLLM migration justified
- Server GPU budget (A100) → bigger models + fine-tuning possible
> Answer:

**B7 — What's the pass bar before a build is "trustable"?** 📐
- Green eval + a demo *(current POC bar)*
- A domain expert reviews N real answers and signs off
- Numeric answers must be provably correct
> Answer:

**B8 — What answer latency is acceptable, and what's the degraded-mode expectation?** 📐
- Streaming makes ~30s fine *(current bet)*
- Hard <10s needed → reduce steps / right-size models / vLLM
- On outage: clear "model unavailable" message acceptable vs must alert someone
> Answer:

**B9 — What malicious / adversarial inputs must the AI resist? (GenAI security)** 📐
- Prompt injection ("ignore your rules and …") — guardrails exist, how hard a requirement?
- Jailbreak attempts to get unsafe/off-topic output
- Malformed NL→SQL trying to read other tables
- Realistically a trusted internal LAN tool → low threat, OR exposed to many users → harden
> Answer:

**B10 — What must the AI REFUSE or defer to a human?** 📐
- Anything it can't ground in data (refuse vs guess) *(premise-verification exists)*
- Safety-critical procedures / regulatory advice → defer to human expert
- Out-of-domain questions (not about the plant)
- Any action beyond the autonomy ceiling set in A5
> Answer:

**B11 — What data can the AI see, how fresh, and is any of it sensitive?** 📐
- Allowed sources: telemetry only, or also tariffs / maintenance logs / production schedule?
- Freshness: real-time (1-min) vs batched (15-min → answers must say "as of HH:MM")
- Sensitive/PII data that must never enter a prompt? (people, contracts, costs)
- Known bad data to defend against (stuck sensors, unit mismatches, clock skew)
> Answer:

**B12 — What's the equipment & domain scope, and are the benchmarks agreed?** 📐
- Just the central chiller plant (2 chillers + tower + pump) *(current)*
- Add AHUs / FCUs / pumps / VFDs / boilers → new knowledge + tools
- Whole-facility energy (compressed air, lighting)
- Are the kW/TR design values & efficiency bands per equipment confirmed correct by the facility?
> Answer:

**B13 — Who can change prompts/models, and how do we roll back? (AI governance)** 📐
- Prompt change control: anyone edits vs reviewed change + version pin
- Model update policy: who owns `ollama pull`, who re-runs eval before deploy
- Rollback path when a new prompt/model regresses answers
> Answer:

---

## Part C — Enhancements (scope & prioritize, not blockers)

**C1 — Which NEW tools should the agent get? (rank them)** ✨
- Cost/tariff tool (kWh → ₹) — needs tariff data: do we have it?
- Weather/ambient tool (wet-bulb → explains tower approach)
- Maintenance-history tool — needs a CMMS/log source
- Forecast tool (expose the existing forecaster to the agent)
- Production-schedule tool (explains load swings)
> Answer (ranked + which data exists):

**C2 — What documents should the AI cite, in what formats, and who keeps them correct?** ✨
- Curated markdown playbooks *(current)*
- OEM manuals (PDF) / O&M procedures (Word)
- SharePoint/Confluence wiki → connector + auth
> Answer:

**C3 — How long should the AI remember, and is cross-session memory worth it?** ✨
- Session-only *(current)*
- Remembers prior findings per equipment across sessions
- Remembers operator preferences (₹ vs kWh, terse vs verbose)
> Answer:

**C4 — Should the AI be PROACTIVE, and where should output land?** ✨
- Scheduled morning brief at shift start
- Anomaly-triggered plain-English alert
- 3-day trend-watch digest
- Land it in: app / Slack / email?
> Answer:

**C5 — Is image understanding (vision) a real need or a demo nicety?** ✨
- Read a nameplate photo → fill the catalog
- Read a gauge/HMI panel photo
- Critique a pasted trend screenshot
> Answer:

**C6 — Do we commit to a 👍/👎 feedback loop now?** ✨
- Yes → capture verdicts now so the learning loop + future fine-tune have data
- Failed answers become new eval cases
- Not yet
> Answer:

**C7 — Which delivery surfaces do operators and management actually want?** ✨
- Web app only *(current)*
- Slack/Teams brief + alerts
- Weekly management PDF by email
> Answer:

**C8 — Is a second facility coming, and when?** ✨ *(decides build-tenancy-now vs later)*
- Unicharm only for 6+ months → don't build multi-tenant yet
- Another site (e.g. Varanasi Airport) soon → start per-tenant catalog/prompts/KB now
> Answer:

**C9 — Single agent, or multiple specialized agents collaborating?** ✨
- One agent with all tools *(current — modes share one loop)*
- A planner/orchestrator dispatching specialist agents in parallel, then synthesizing *(orchestrator exists — lean on it more?)*
- Specialist sub-agents (efficiency expert, maintenance expert, cost expert)
> Answer:

**C10 — What compliance, audit-trail retention, and access control is needed?** ✨
- Audit log of every Q&A is kept *(exists)* — how long, and who can read it?
- Any framework that gets audited (ISO 27001 / SOC2 / internal)?
- Identity/roles: stays a shared no-auth kiosk *(current)* vs need to know who asked/approved
> Answer:

---

## Part D — Infra & On-prem operations (the deployment reality)

**D1 — Where does inference run, and must it survive a network/WAN outage?** ⚙️
- Ollama on a LAN/Tailscale GPU box *(current — `100.x` host over Tailscale)*
- If Tailscale / WAN drops, must the AI keep working on the local LAN? (true air-gap vs convenience VPN)
- Is the GPU box co-located in the plant, or remote?
> Answer:

**D2 — What's the model-serving & per-task model strategy?** ⚙️
- Ollama now (qwen2.5:14b reasoning · llama3.1:8b tools/SQL · llama3.2 auditor · nomic-embed for RAG) *(current)*
- Switch to vLLM at >10 concurrent users or <5s SLA
- Confirm: is per-task right-sizing acceptable, or one model for everything?
> Answer:

**D3 — Backups, disaster recovery & data retention for the on-prem stack?** ⚙️
- What gets backed up: Postgres app data, pgvector embeddings, audit logs? How often?
- Restore target — how fast must we recover if the box dies?
- MySQL telemetry is read-only source (not ours to back up) — confirm
> Answer:

**D4 — Who operates the on-prem box, and what's the update/maintenance window?** ⚙️
- Ownership: who runs `ollama pull`, applies updates, watches Grafana/Prometheus/Loki?
- Plant runs 24/7 — when can we restart Ollama/backend safely?
- On-call expectation if the AI is down overnight, or "use the dashboard" is fine?
> Answer:

**D5 — Any integration with plant systems (CMMS / BMS / SCADA), and which direction?** ⚙️
- Read-only from BMS/SCADA for richer alarms/events? (crosses an OT security boundary)
- Write a work order into a CMMS (Maximo / SAP PM / UpKeep / spreadsheet)?
- Strictly no connection to plant control systems *(current — read-only, no actuation)*
> Answer:

---

## Decisions captured (fill in after the session)

| # | Decision | Answer | Owner | → Task / ADR |
|---|---|---|---|---|
| A1 | Highest-value job | | | |
| A5 | **Autonomy ceiling (A/B/C/D)** | | | |
| B3 | Truthfulness gate (hard/best-effort) | | | |
| B5 | Open-source firm? | | | |
| B6 | GPU + concurrency | | | |
| B7 | Pass bar for "trustable" | | | |
| C1 | New tools (ranked) | | | |
| C8 | Second facility timeline | | | |
| D1 | Offline/air-gap requirement | | | |
| D5 | CMMS/BMS integration target | | | |
| — | Next-release top 3 | | | |

---

*Pair with [FUTURE_TASKS.md](./FUTURE_TASKS.md) to turn answers into work.*
