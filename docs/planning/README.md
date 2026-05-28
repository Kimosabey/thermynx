# Planning docs — index

This folder holds **forward-looking** plans, audits, and roadmaps. Architecture
references live in [`../architecture/`](../architecture/); operational runbooks
live in [`../operations/`](../operations/).

**Last updated:** 2026-05-28

---

## AI platform excellence (curated doc set)

Detailed plans for every dimension of operating the LLM-powered features in
production. All 9 docs live under [`./ai/`](./ai/) — start there:

| Entry point | Purpose |
|---|---|
| **[`./ai/README.md`](./ai/README.md)** | Master index — standards landscape, principles, top-of-funnel summary |
| [`./ai/HALLUCINATION_GUARDRAILS.md`](./ai/HALLUCINATION_GUARDRAILS.md) | Truthfulness defenses overview |
| [`./ai/HALLUCINATION_CASES.md`](./ai/HALLUCINATION_CASES.md) | Catalog of 40+ failure modes |
| [`./ai/HALLUCINATION_DEFENSES.md`](./ai/HALLUCINATION_DEFENSES.md) | 4-layer defense architecture |
| [`./ai/HALLUCINATION_ROADMAP.md`](./ai/HALLUCINATION_ROADMAP.md) | Tier 1/2/3 prioritized backlog |
| [`./ai/PERFORMANCE_PLAN.md`](./ai/PERFORMANCE_PLAN.md) | Latency targets, model right-sizing |
| [`./ai/RELIABILITY_PLAN.md`](./ai/RELIABILITY_PLAN.md) | Failure modes + DR runbook |
| [`./ai/SECURITY_PLAN.md`](./ai/SECURITY_PLAN.md) | OWASP LLM Top 10 mapping |
| [`./ai/EVALUATION_PLAN.md`](./ai/EVALUATION_PLAN.md) | Golden dataset + regression harness |

## Adjacent AI planning (top-level + phases)

| Doc | What |
|---|---|
| [`AI_ROADMAP_AND_BACKLOG.md`](./AI_ROADMAP_AND_BACKLOG.md) | Broader AI feature roadmap (analyzer, agent, RAG) — what's shipped, what's next |
| [`phases/PHASE_10A_CITATIONS.md`](./phases/PHASE_10A_CITATIONS.md) | RAG citations feature plan |
| [`phases/PHASE_10B_HALLUCINATION_DASHBOARD.md`](./phases/PHASE_10B_HALLUCINATION_DASHBOARD.md) | Observability dashboard for hallucination scoring |

## Data & telemetry — [`data/`](./data/)

| Doc | What |
|---|---|
| [`data/DATA_01_KNOWLEDGE_INGEST.md`](./data/DATA_01_KNOWLEDGE_INGEST.md) | Knowledge-base ingest pipeline plan |
| [`data/DATA_02_TELEMETRY_FRESHNESS.md`](./data/DATA_02_TELEMETRY_FRESHNESS.md) | Telemetry freshness handling |
| [`data/DATA_03_TOPOLOGY_FROM_DATA.md`](./data/DATA_03_TOPOLOGY_FROM_DATA.md) | Topology inference from data |
| [`data/HONEST_DATA_AUDIT.md`](./data/HONEST_DATA_AUDIT.md) | Honest audit of what data we actually have |

## Feature phases — [`phases/`](./phases/)

| Doc | What |
|---|---|
| [`phases/PHASE_8A_FOUNDATION_FORECAST.md`](./phases/PHASE_8A_FOUNDATION_FORECAST.md) | Forecast backend (Holt-Winters) |
| [`phases/PHASE_9A_SLACK_BOT.md`](./phases/PHASE_9A_SLACK_BOT.md) | Slack bot integration |
| [`phases/PHASE_10A_CITATIONS.md`](./phases/PHASE_10A_CITATIONS.md) | RAG citations |
| [`phases/PHASE_10B_HALLUCINATION_DASHBOARD.md`](./phases/PHASE_10B_HALLUCINATION_DASHBOARD.md) | Hallucination observability dashboard |

## UI & polish — [`ui/`](./ui/)

| Doc | What |
|---|---|
| [`ui/UI_UX_IMPROVEMENT_PLAN.md`](./ui/UI_UX_IMPROVEMENT_PLAN.md) | UI/UX improvements |
| [`ui/POLISH_BUNDLE_SPLIT.md`](./ui/POLISH_BUNDLE_SPLIT.md) | Frontend bundle splitting |

## Cross-cutting — [`general/`](./general/)

| Doc | What |
|---|---|
| [`general/FLAWS_AND_IMPROVEMENT_PLAN.md`](./general/FLAWS_AND_IMPROVEMENT_PLAN.md) | Severity-ranked platform issues |
| [`general/REMAINING_ROADMAP.md`](./general/REMAINING_ROADMAP.md) | Cross-cutting remaining work |
| [`general/SESSION_STATUS_2026-05-21.md`](./general/SESSION_STATUS_2026-05-21.md) | Session status snapshot |
| [`general/WO_WORK_ORDERS_PLAN.md`](./general/WO_WORK_ORDERS_PLAN.md) | Work orders feature plan |

---

## Conventions

- **UPPERCASE_FILENAMES.md** for individual planning docs
- **Subfolder + README.md** for curated multi-doc sets (e.g. [`ai/`](./ai/))
- Each doc opens with: `**Audience:**`, `**Last updated:**`, sibling-doc links
- Status icons: 🟢 done · 🟡 partial · 🔴 open · ⏳ planned · 🌱 nice-to-have
- Effort estimates are engineering-hours for the implementer

## Folder map at a glance

```
docs/planning/
├── README.md          ← you are here
├── AI_ROADMAP_AND_BACKLOG.md
├── ai/                ← AI platform excellence (9 docs, NEW)
├── data/              ← data & telemetry plans
├── phases/            ← phase-by-phase feature plans
├── ui/                ← UI/UX + polish
└── general/           ← cross-cutting plans + session notes
```
