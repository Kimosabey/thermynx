# THERMYNX — Documentation

All documentation for the THERMYNX HVAC AI Operations Intelligence Platform.
The product roadmap lives one level up: [`../BUILD_PLAN.md`](../BUILD_PLAN.md).

---

## Quick Navigation

| I want to… | Go to |
|------------|-------|
| Set up the project for the first time | [GETTING_STARTED.md](./GETTING_STARTED.md) |
| Look up an API endpoint | [API_REFERENCE.md](./API_REFERENCE.md) |
| Understand what an env var does | [ENV_REFERENCE.md](./ENV_REFERENCE.md) |
| Debug a production issue | [RUNBOOK.md](./RUNBOOK.md) |
| Understand the system architecture | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Understand the AI agent system | [AGENT_REFERENCE.md](./AGENT_REFERENCE.md) |
| Understand analytics formulas & thresholds | [ANALYTICS_REFERENCE.md](./ANALYTICS_REFERENCE.md) |
| Add a new frontend page or component | [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md) |
| Tweak an LLM prompt | [PROMPTS.md](./PROMPTS.md) |
| Query the telemetry database | [DATA_DICTIONARY.md](./DATA_DICTIONARY.md) |
| Understand the DB schema in depth | [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md) |
| Run the test suite end-to-end | [TESTING.md](./TESTING.md) |
| See what's broken and what to fix | [FLAWS_AND_IMPROVEMENT_PLAN.md](./FLAWS_AND_IMPROVEMENT_PLAN.md) |
| Check what changed in each version | [CHANGELOG.md](./CHANGELOG.md) |

---

## All Documents

### Getting Started & Operations

| Document | What it covers |
|----------|----------------|
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Clone, configure, and run the full stack locally in under 10 minutes |
| [RUNBOOK.md](./RUNBOOK.md) | Start/stop stack, inspect logs, reset DBs, re-pull LLM models, troubleshoot common failures |
| [TESTING.md](./TESTING.md) | End-to-end test checklist: infra, automated suite, DB verification, API checks, frontend, performance |
| [CHANGELOG.md](./CHANGELOG.md) | Version history — what was added, fixed, or changed in each release |

### Architecture & Design

| Document | What it covers |
|----------|----------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | C4 diagrams, system flows, deployment topology, data flow |
| [AI_ARCHITECTURE_REFERENCE.md](./AI_ARCHITECTURE_REFERENCE.md) | LLM integration, streaming design, embedding pipeline, ReAct loop internals |
| [AGENT_REFERENCE.md](./AGENT_REFERENCE.md) | 5 agent modes, 6 tool schemas, ReAct loop, how to add a new tool |
| [ANALYTICS_REFERENCE.md](./ANALYTICS_REFERENCE.md) | Efficiency bands, z-score anomaly detection, forecast method, cost calc, maintenance scoring |

### API & Configuration

| Document | What it covers |
|----------|----------------|
| [API_REFERENCE.md](./API_REFERENCE.md) | All 16 endpoints: request/response shapes, query params, curl examples, SSE frame format |
| [ENV_REFERENCE.md](./ENV_REFERENCE.md) | Every environment variable with type, default, and description |
| [PROMPTS.md](./PROMPTS.md) | Versioned LLM prompt catalogue with rationale and output contracts |

### Data

| Document | What it covers |
|----------|----------------|
| [DATA_DICTIONARY.md](./DATA_DICTIONARY.md) | What lives in `unicharm` MySQL — normalized tables, key columns, column meanings |
| [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md) | Full schema: both databases, all tables, column types, how the backend uses them |

### Frontend

| Document | What it covers |
|----------|----------------|
| [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md) | 11 pages, shared components, routing, theme tokens, SSE streaming pattern, how to add a page |

### Planning

| Document | What it covers |
|----------|----------------|
| [FLAWS_AND_IMPROVEMENT_PLAN.md](./FLAWS_AND_IMPROVEMENT_PLAN.md) | All known gaps: P0–P3 severity, root cause, fix description, sprint plan |
| [../BUILD_PLAN.md](../BUILD_PLAN.md) | Product vision, phases 0–6, architecture decisions, deployment, security roadmap |

### Source Data (Unicharm)

| Document | What it covers |
|----------|----------------|
| [../unicharm_db_analysis.md](../unicharm_db_analysis.md) | Analysis of the raw Unicharm database — table inventory, data quality, normalization notes |
| [../unicharm_db_ddl.md](../unicharm_db_ddl.md) | DDL statements for the normalized Unicharm tables |

---

## Docs Conventions

- Each document is the source of truth for its area — don't duplicate content; link instead
- Use relative links between docs (works on GitHub, locally, and in VSCode)
- Diagrams live as `.mmd` source files in `docs/diagrams/` — never commit a rendered PNG without its source
- When the architecture changes: update `diagrams/*.mmd` first, then regenerate inline blocks in `ARCHITECTURE.md`
- When a prompt changes: bump the version in `PROMPTS.md`, never edit in place
- When an endpoint changes: update `API_REFERENCE.md` in the same commit
