# THERMYNX — Local-LLM Feature Roadmap

Four features that exploit the fact that inference is now **free and on-prem**
(local Ollama). Sequenced so each one feeds the next:

```
1. Daily health digest   → surfaces WHAT is wrong / drifting each day
2. Tribal-knowledge loop  → captures HOW it was fixed, grounds future answers
3. Energy optimizer       → uses 1+2 to recommend savings, human-gated
4. Predictive maintenance → uses forecast+1 to act BEFORE failure
```

## Shared principles (apply to all four)

- **Stats decide "something is wrong", LLM explains/recommends.** Never move
  detection into the LLM.
- **Spend free inference on always-on generation**, not on re-running queries.
- **Every new write path is human-gated + structured + audited** — copy the
  `propose_work_order` pattern (regex numeric-grounding gate + approval card +
  `WorkOrderEvent` audit).
- **RAG-ground every recommendation**; cite the manual chunk or the past fix.
- **Model routing stays tiered** (`config.py`): 8B for extraction/JSON, 14B for
  narration. New jobs pick the cheapest model that passes eval.

---

## 1. Daily plant-health digest  *(effort: LOW — start here)*

**What:** Every morning, auto-draft a plain-English plant summary and post it to
Slack: 24h efficiency trend per chiller, anomalies fired, energy cost, the single
highest-impact recommendation.

**Why local matters:** A full-plant narrated report every day would be cost-noise
on a paid API; locally it's free.

**How it hooks in:**
- New scheduled job alongside the existing anomaly scan (the arq/cron path that
  runs `anomaly_scan`). Run once daily (e.g. 06:00).
- Pull from the endpoints/services that already exist: `efficiency`, `anomalies`,
  `cost`, `forecast`. **No new data plumbing** — just aggregate their outputs.
- Summarize the aggregate (NOT raw rows) → feed to the 14B text model with a
  "shift report" system prompt (reuse the grounding rules in `services/agent.py`).
- Post via the existing `slack_forwarder.py`.

**Output (structured, then rendered):**
```json
{
  "date": "...", "plant_kw_per_tr_avg": 0.71, "trend": "worsening",
  "anomalies": [{"equipment": "chiller_2", "metric": "kw_per_tr", "severity": "..."}],
  "energy_cost_24h": 12345, "top_recommendation": "..."
}
```

**Guardrails:** numeric postcheck (`postcheck.py`) before posting; if the model
invents a number not in the aggregate, drop the line. Log the digest to
`AnalysisAudit` for reproducibility.

**Done when:** a real digest lands in Slack each morning and every number in it
traces to a source endpoint.

---

## 2. Tribal-knowledge feedback loop  *(effort: MEDIUM — closes gap #6)*

**What:** When a technician resolves a work order, capture the fix in plain
language, embed it, and auto-retrieve it next time a similar fault appears
("Last time chiller 2 spiked kW/TR, replacing the fouled strainer fixed it").

**Why local matters:** Embeddings + retrieval run free and the fix history
(operational know-how) never leaves the facility.

**How it hooks in:**
- On work-order close, prompt for a short "resolution note" (you already capture
  `WorkOrderEvent` comments — extend the close transition to require one).
- Embed the resolution with `nomic-embed-text` (same model RAG already uses) and
  store in the `embeddings` table with `source_type="resolution"` +
  `equipment_tags` (reuse `services/rag.py` ingest path).
- In the agent's `search_knowledge_base` tool, retrieval now spans **manuals +
  past resolutions**, ranked together. No new tool needed — just more corpus.
- Surface retrieved past-fixes in the diagnosis with a distinct citation style.

**Bonus:** this is also your **eval-set grower** — confirmed good resolutions can
be promoted into golden cases.

**Guardrails:** resolutions are DATA-marked on retrieval (injection-safe, like
existing RAG chunks). Tag with outcome (worked / didn't) so bad advice can be
down-weighted.

**Done when:** closing a WO writes an embedded resolution, and a later similar
anomaly's diagnosis cites it.

---

## 3. Energy & cost optimization advisor  *(effort: MEDIUM — highest $ value)*

**What:** Two capabilities:
- **Chiller staging/sequencing** — given current/forecast load and per-chiller
  kW/TR, recommend which chiller(s) to run for lowest energy at required tonnage.
- **Setpoint what-if** — "what if CHW setpoint +1°C?" → estimate kW/comfort impact
  from historical response, *before* anyone changes the plant.

**Why local matters:** You can run the optimizer on every load change without
metering cost; the savings math stays private.

**How it hooks in:**
- New read-only analysis service that combines `efficiency` (kW/TR per chiller),
  `forecast` (next-N-hour load), and live load.
- The *math* (which combo meets tonnage at min kW) is **deterministic code** —
  LLM only narrates the recommendation and the trade-off, grounded in those
  numbers. Keep optimization out of the model.
- Expose as a new agent tool `recommend_staging` (read-only) + a what-if endpoint.
- Any actual setpoint/staging change → **human-gated work-order proposal**, never
  autonomous. Reuse the approval card + numeric-grounding gate.

**Guardrails:** hard safe-operating bounds in deterministic code (min/max CHW
setpoint, min run-time, anti-short-cycle) — reject out-of-band recommendations
before they reach the operator, independent of the LLM.

**Done when:** advisor proposes a staging plan with projected kW savings, every
number grounded, and the change requires approval.

---

## 4. Predictive maintenance  *(effort: MED-HIGH)*

**What:** Catch slow degradation (condenser fouling → rising approach temp,
declining kW/TR trend, bearing-related vibration proxies) and **auto-propose PM
work orders before failure**, with the manual procedure attached.

**Why local matters:** Continuously scoring every trend for degradation is free;
do it hourly/daily without thinking about cost.

**How it hooks in:**
- Extend the forecasting layer (`forecast_ml.py` Holt-Winters) to flag adverse
  *trends* (sustained drift), distinct from point anomalies.
- Fuse: trend signal + anomaly history + RAG manual → LLM drafts a PM diagnosis
  with the relevant procedure cited.
- Auto-create a **proposed** work order (source=`pm`) — surfaces in the existing
  approval UI; a human confirms before it's real.

**Guardrails:** same `propose_work_order` numeric-grounding gate — a PM proposal
must cite a concrete degrading metric + the threshold it's approaching, or it's
rejected.

**Done when:** a sustained efficiency drift produces a proposed PM work order
citing the trend and the manual step, awaiting human approval.

---

## Cross-cutting upgrades these enable later

- **Distill a small domain model** on your equipment vocabulary for the tool/SQL
  role — faster, more accurate routing (local-only capability).
- **LLM-as-judge always-on** — free continuous scoring of outputs to flag
  low-confidence answers and auto-expand the eval set.
- **Vision model (llava / qwen2-vl) locally** — nameplate OCR, gauge/thermal
  reading, P&ID Q&A.

## Suggested execution order

1 (quick win, visible) → 2 (grounds everything) → 3 (the business case) → 4
(proactive). Each is independently shippable.
