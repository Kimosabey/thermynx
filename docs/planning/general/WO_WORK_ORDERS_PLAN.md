# Work Order & Task Management — phased plan

**Context:** the platform already detects (anomalies), diagnoses
(causal explanations), and recommends (maintenance + agent answers).
A work-order layer closes the loop by turning those into trackable,
assignable, auditable units of work. This file scopes that addition
honestly — what fits today, what is aspirational, what depends on
external systems we don't yet have.

## Does it fit the product context?

**Yes — strongly.** Three reasons:

1. The existing data model (`analysis_audit`, `agent_runs`,
   `anomalies`) already has lifecycle patterns we can reuse for WOs.
2. The agent + causal services already produce the *content* of a
   work order (diagnosis, root cause, recommended checks). They just
   don't persist it as an actionable item.
3. Postgres `thermynx_app` is the natural home — same database, same
   migrations, same audit conventions.

## Honest gap-analysis of the proposed features

| Feature | Fit | What we have | What is missing |
|---|---|---|---|
| WO lifecycle (open → closed) | ✅ shippable now | Postgres app db, alembic | New `work_orders` + `work_order_events` tables |
| Twin-triggered WOs | ⚠️ partial | Causal service, maintenance score | "Twin" and RUL are not built — we have heuristics, not a twin |
| Agent-generated WOs | ✅ shippable now | Tool-calling ReAct agent | New `create_work_order` tool + human-approval gate |
| Smart technician assignment | ⚠️ partial | LLM ranker | No `technicians` table; no skill / load data |
| Mobile WO UI | ✅ shippable | Chakra responsive primitives | Tablet-tuned layout + photo upload reuse from Vision |
| WO analytics | ✅ shippable now | ECharts + audit-style aggregates | New aggregation endpoints |
| PM scheduling | ✅ shippable | arq cron, maintenance health | PM template table |
| RUL-driven PM | ❌ blocked | — | Needs real RUL model (Phase 8, queued) |
| CMMS sync (Maximo / ServiceNow / UpKeep) | ⚠️ depends on customer | HTTP client patterns | Customer credentials + adapter per vendor |
| Parts inventory link | ⚠️ depends on customer | — | No inventory system reachable yet |

**Bottom line:** the *core* (lifecycle, agent-generated, manual,
analytics, basic PM) is fully buildable today inside this product.
External integrations (CMMS, parts) need customer-side access. RUL-driven
PM needs a real model that doesn't exist yet — we'd ship calendar-PM
first and tighten with RUL when it lands.

## Phased plan

### Phase WO-01 — Core lifecycle (1–2 days)
**Goal:** every operator can create, view, transition, and close
work orders, with every state change logged.

- `work_orders` table: id, equipment_id, title, description, priority
  (low/normal/high/critical), state (open/assigned/in_progress/resolved/closed),
  created_by, assigned_to, due_at, resolved_at, source ("manual" / "agent" /
  "anomaly" / "pm"), source_ref (links to anomaly_id or agent_run_id).
- `work_order_events` table: id, wo_id, from_state, to_state, actor,
  notes, created_at. Single source of truth for audit.
- Endpoints: `POST /work-orders`, `GET /work-orders` (filterable),
  `GET /work-orders/{id}`, `PATCH /work-orders/{id}` (state transitions),
  `POST /work-orders/{id}/comments`.
- Frontend: new "Work Orders" menu under Advanced. List page with
  state-column kanban-lite, detail page with timeline.

### Phase WO-02 — Agent-generated WOs (1 day, depends on WO-01)
**Goal:** when the agent finishes investigating an anomaly, it can
propose a work order pre-filled with the diagnosis.

- New tool `propose_work_order(equipment_id, title, severity, body)`
  in the agent toolset.
- Tool DOES NOT auto-create. It returns a payload that the agent
  surfaces in the chat with a "Create work order" button.
- Click → frontend POSTs to `/work-orders` with the agent's payload +
  `source="agent"` and `source_ref=agent_run_id`.
- "Explain why" panel on Anomaly cards gets the same button.

### Phase WO-03 — Technician model + assignment (2 days)
**Goal:** assign each WO to a person; the model suggests the best
technician.

- `technicians` table: id, name, skills (text[]), location,
  active_assignments, success_rate.
- Seed with whatever Unicharm provides (or 3 placeholder rows).
- `/technicians/suggest?work_order_id=…` returns ranked candidates
  with a one-sentence "why" from the LLM.
- Operator can accept or override.

### Phase WO-04 — Preventive maintenance scheduling (2 days)
**Goal:** recurring WOs auto-created from templates.

- `pm_templates` table: id, equipment_type, name, description,
  interval_days, default_priority.
- Seed from `HVAC_MAINTENANCE_PLAYBOOK.md` (daily / weekly / monthly /
  quarterly / annual rows already exist in that doc).
- arq cron job (daily 02:00) iterates equipment × templates, creates
  WOs that aren't already open.
- **RUL-aware skip rule (lightweight):** if maintenance health score
  > 90 and the template is "minor cleaning", defer by 30 days. This is
  the cheap proxy for "twin says RUL is far" — until a real RUL model
  ships, this is the honest interim.

### Phase WO-05 — Work Order Analytics (1 day)
**Goal:** answer "are we getting better?" with numbers.

- `/work-orders/stats`: counts by state, mean time-to-resolve,
  SLA compliance (configurable per priority), repeat-issue rate (same
  equipment + same metric within 30 days).
- Frontend tab on the WO list page.

### Phase WO-06 — Mobile / tablet UI (3–4 days)
- Responsive WO detail page tuned for tablet width.
- Photo upload (reuses the Vision upload widget).
- Operator notes inline.
- Offline-tolerant via service worker (later — out of scope for v0).

### Phase WO-07 — CMMS bi-directional sync (1–2 weeks per vendor)
**Customer dependency.**
- Adapter pattern: `adapters/cmms/maximo.py`, `…/servicenow.py`, `…/upkeep.py`.
- Mode flag per deployment: `graylinx_master` (we push) vs `cmms_master` (we pull).
- Polling worker + webhook receiver (when vendor supports it).
- Reconciliation report when both sides have diverged.

### Phase WO-08 — Parts inventory link (~1 week)
**Customer dependency.**
- `parts_catalog` table (or external API).
- WO can reference `required_parts: [{part_id, qty}]`.
- Availability check before transition `assigned → in_progress`.
- Surface stock-out as a separate WO blocker.

## What we ship in the first session (WO-01 + WO-02)

- `work_orders` + `work_order_events` migrations
- 5 endpoints (`create`, `list`, `get`, `transition`, `comment`)
- Sidebar entry: **Advanced → Work Orders** with `ClipboardList` icon
- Frontend: list + detail pages
- Agent tool `propose_work_order` + UI button on anomaly cards
- Smoke-test: create from anomaly, transition through states, close

## Acceptance criteria (for WO-01 + WO-02)

1. An operator can manually create a WO from the UI and assign a
   priority + equipment.
2. The agent can produce a `propose_work_order` JSON during an
   investigation; the UI renders a one-click confirm.
3. Every state transition is logged in `work_order_events` with the
   actor name (or "system" / "agent" when no human).
4. Each anomaly card has an inline "Create work order" button that
   pre-fills title + description from the anomaly.
5. The WO list page supports filtering by state, priority, equipment.

## Non-goals (explicit, to stay honest)

- No CMMS sync, no parts inventory, no RUL-driven PM in v0.
- No technician *table* in WO-01 — that arrives in WO-03.
- No service-worker offline support in v0.
- We will not claim "Twin diagnosis" anywhere in the UI until a real
  twin exists. The first v0 says "Agent diagnosis" because that's
  what's actually backing the recommendation.
