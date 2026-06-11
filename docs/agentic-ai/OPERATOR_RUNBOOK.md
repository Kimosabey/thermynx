# Agentic AI — Operator Runbook

How to run, flip, watch, and recover the THERMYNX agentic AI (the LangGraph pipeline).
Companion to [FRAMEWORK_REWRITE_PLAN.md](./FRAMEWORK_REWRITE_PLAN.md) and
[HANDOFF.md](./HANDOFF.md). For the GPU/VRAM issue see
[../operations/GPU_VRAM_CONTENTION.md](../operations/GPU_VRAM_CONTENTION.md).

## 1. Start / stop

**Ollama (the model server, separate GPU box):** run `scripts/ollama_all.bat` on the box —
(re)starts Ollama tuned, pre-warms phi4 + gemma4 + nomic, opens the VRAM + client monitors.
- Quick check: `scripts\ollama_ps.ps1` (loaded models) · `ollama ps` on the box.
- Intruder cleanup: `scripts\ollama_kick.bat` (unload gpt-oss/mxbai, re-pin phi4).

**Backend (FastAPI on :8000):**
```bash
cd backend
../.venv/Scripts/uvicorn main:app --port 8000        # add --reload for dev
```
Health: `GET /api/v1/health` (reports Ollama status, circuit-breaker, per-role models).

## 2. The graph flip (cutover) — default OFF, instantly reversible

Three flags route the **live** endpoints through the LangGraph pipeline instead of the old
inline code. They live in `backend/app/config.py` (default `False`); override in `backend/.env`:

| Flag | Surface it flips | Model |
|------|------------------|-------|
| `USE_GRAPH_ANALYZER`   | `POST /api/v1/analyze`          | phi4 (single — safe on 20 GB) |
| `USE_GRAPH_AGENT`      | `POST /api/v1/agent/run`        | devstral |
| `USE_GRAPH_ORCHESTRATE`| `POST /api/v1/agent/orchestrate`| gemma4→devstral→phi4 (**48 GB box** — thrashes on 20 GB) |

**To flip a surface on:** set the flag `=true` in `backend/.env`, restart the backend.
**To revert:** unset it (or `=false`), restart. The OFF path is byte-identical (early-return).
**Order:** analyze → agent → (orchestrate, on 48 GB). Soak each before the next.
**Preview without flipping:** the always-graph endpoints `POST /api/v1/agentic/{analyze,agent,orchestrate}`.

## 3. Soak — what to watch after a flip

- **Prometheus alerts** (already wired): `HallucinationFlagsHigh`, `AgentErrorRate`.
- **Latency:** `analysis_audit.total_ms` + the Prometheus histograms vs the targets in
  `PERFORMANCE_PLAN.md` (`/analyze` <15 s, `/agent` <10 s P50).
- **Audit flags:** the `audit` SSE frame `flag_count` (see §5). Should stay ≤ the OFF-path baseline.
- **Langfuse traces** (§4) for per-node timing/errors.
- **Eval gate:** `make eval` (golden suite, 50 cases) — must stay green (the lone orchestrate case
  flakes on 20 GB cold-loads; passes on retry — not a regression).

Promote to the next surface only when error/flag rate ≤ baseline and latency is within target.

## 4. Reading a Langfuse trace

> **Status (2026-06-11):** the Langfuse **server is currently DISABLED** in `docker-compose.yml`
> (Langfuse v3 needs ClickHouse+Redis+S3 — deferred to the 48 GB box; see the restore note in the
> compose file). Tracing is a safe no-op until it's restored. The rest of this section applies once a
> server is stood up and `LANGFUSE_HOST` + keys are set.

Langfuse runs self-hosted in `docker compose` (obs profile). With `LANGFUSE_HOST` + keys set,
every graph run emits per-node / per-LLM spans (`graph_callbacks()` in `app/ai/graph/tracing.py`).
- Open the Langfuse UI → find the run by `thread_id` / time.
- Each node (`preflight`, `context`, `rag`, `llm`, `tools`, `postcheck`, `critique`, `planner`,
  `synthesis`) is a span — check duration + I/O to locate a slow/failed step.
- No Langfuse configured → tracing is a no-op (safe); spans simply don't appear.

## 5. What the audit flags mean

The `postcheck` node emits an `audit` SSE frame:
- **numeric_flags** — a number in the answer not supported by the telemetry/summary (possible
  hallucinated value). The most important signal.
- **equipment_flags** — equipment named that isn't in the catalog (fabricated unit).
- **citation_flags** — a `[source: …]` citation with no matching retrieved chunk.
- `flag_count` = total. `status: skipped` = preflight refusal (not an error).
A non-zero count is a *flag for review*, not an auto-fail — the answer still streams.

## 6. Prompt rollback (when a prompt change regresses)

Prompts currently live in code (`app/ai/prompts/`). To roll back: `git revert` the prompt commit,
restart. (Langfuse prompt-registry versioning is the planned F1.12 upgrade — once in, roll back by
pinning the previous version in the Langfuse UI, no redeploy.)

## 7. Common issues

| Symptom | Cause / fix |
|---------|-------------|
| "⚠ Skipped: LLM timeout" / slow | VRAM contention — another project (OMNYX) loaded models on the shared GPU. Run `ollama_ps.ps1`; if gpt-oss/mxbai are resident, `ollama_kick.bat`. See GPU_VRAM_CONTENTION.md. |
| Empty `**` answers | `num_ctx` too low for a new model — the router sets it via `_num_ctx_for` in `app/llm/ollama.py`; keep it set on any new model. |
| Orchestrate ~2 min / flaky on 20 GB | Expected — 3 model cold-loads. Resolves on the 48 GB box. |
| Push blocked by pre-push eval gate | Only bypass for the documented codestral/orchestrate cold-load transient: `git push --no-verify`. Any other red is a real regression — fix it. |
| Backend can't reach Ollama | Check the Tailscale host + that no firewall rule blocks the backend's IP (see GPU_VRAM_CONTENTION.md — don't block your own backend host). |
