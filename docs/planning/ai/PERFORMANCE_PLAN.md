# AI performance plan

**Audience:** Engineers working on latency/throughput of the AI paths.

Sibling docs: [AI_PLATFORM_EXCELLENCE.md](./README.md) · [AI_RELIABILITY_PLAN.md](./RELIABILITY_PLAN.md) · [AI_EVALUATION_PLAN.md](./EVALUATION_PLAN.md)

**Last updated:** 2026-05-28

---

## Why this matters

Operators check the analyzer 5–20 times per shift. A 48-second response feels broken; a 5-second response feels useful. Every second of latency saved is multiplied by usage frequency.

We also pay for latency in **operator trust** — slow systems get bypassed. AI features that aren't used can't add value.

---

## Latency targets (SLO-style)

| Path | P50 target | P95 target | Current P50 | Status |
|---|---|---|---|---|
| `/equipment`, `/efficiency`, analytics GETs | <250ms | <500ms | ~220ms | 🟢 Meeting |
| `/timeseries?hours=24` | <300ms | <800ms | ~250ms | 🟢 Meeting |
| `/nl-query` (simple SELECT) | <2s | <5s | ~1.5s | 🟢 Meeting |
| `/nl-query` (medium aggregate) | <3s | <6s | ~1.8s | 🟢 Meeting |
| `/agent/run` (investigator, 1-tool) | <10s | <20s | ~27s | 🔴 Over |
| `/analyze` (RAG + 24h context) | <15s | <30s | ~48s | 🔴 Over |
| Vision describe (single image) | <8s | <15s | ~5–10s | 🟢 Meeting |
| RAG embed (single query) | <0.2s | <0.5s | ~0.02s | 🟢 Meeting |

Numbers measured 2026-05-28 against qwen2.5:14b on Tailscale.

---

## Cost-of-latency breakdown

Where time *actually* goes on the slow paths:

### `/analyze` 48s = …
- Pre-LLM (RAG embed + parallel context fetch): **~0.5s** ✅ already optimized
- Ollama TTFT (time to first token, model loading + prompt eval): **~3–8s**
- Token generation (qwen2.5:14b ~30 tok/s × ~500–1000 tokens): **~17–35s**
- Tailscale RTT per chunk: **~10–20 chunks × 50ms = ~0.5–1s**
- Self-critique pass (sync): **~3–5s**

### `/agent/run` 27s = …
- ReAct iteration 1 (Ollama chat with tools + tool selection): **~5–8s**
- Tool execution (DB query): **~0.2s**
- ReAct iteration 2 (with tool result in history): **~5–8s**
- Possibly iteration 3: **~5–8s**
- Final answer generation: **~5–10s**

**Conclusion:** ~80% of slow-path time is **token generation inside the LLM**, not platform overhead.

---

## Optimization layers

### Layer A — Reduce work (most impact)

#### A1 · Right-size the model per task
**Status:** 🟢 Done (commit `4d2b0c9`) · **Impact:** 🔥 Huge — 2–3× speedup

Use the smallest model that meets quality. Current monoculture (qwen2.5:14b everywhere) is wasteful.

| Task | Current | Proposed | Rationale |
|---|---|---|---|
| NL→SQL generation | qwen2.5:14b | `qwen2.5-coder:7b` or `qwen2.5:7b` | SQL is structurally simple, doesn't need 14B reasoning |
| Agent tool selection | qwen2.5:14b | `llama3.1:8b` | Tool routing is a classifier task |
| Final answer narration | qwen2.5:14b | keep | Quality matters here |
| Self-critique | qwen2.5:14b | `llama3.2:3b` | Pass/fail classification, fast model fine |
| Planner (multi-agent) | qwen2.5:14b | `llama3.1:8b` | JSON output, deterministic temperature |
| Vision | llama3.2-vision | keep | Vision-specific, no smaller alternative |
| Embeddings | nomic-embed-text | keep | Already optimal |

Implementation: add `OLLAMA_MODEL_FOR_<TASK>` env vars to `config.py`, plumb through. Acceptance: P50 latency on `/agent/run` < 15s.

#### A2 · Cap response length per endpoint
**Status:** 🟢 Done (commit `4d2b0c9`) · **Impact:** 🔥 Huge — directly cuts inference time

Operators read once. Long markdown is wasted tokens.

| Endpoint | Current avg | Proposed cap | Mechanism |
|---|---|---|---|
| `/analyze` | 500–1000 tokens | 250 tokens | Prompt: "Maximum 200 words. Use bullet points, not paragraphs." + Ollama `num_predict: 350` |
| `/agent/run` final | 300–600 tokens | 200 tokens | Same |
| Report summary | already capped at 180 words | keep | — |
| Self-critique | varies | 80 tokens | Already bounded with json format |

Acceptance: P50 `/analyze` < 20s after this + A1.

#### A3 · Cache identical queries
**Status:** ⏳ Planned · **Impact:** ⚡ Medium (hit rate-dependent)

For repeated questions with the same context, the answer is identical. Cache key: `sha256(question + equipment_id + hours + telemetry_window_end)`. Store the streamed-then-joined response in Redis with 60s TTL.

When cache hit, replay tokens to the SSE stream client-side with a small delay to preserve streaming UX. Acceptance: hit rate >20% on typical operator usage, cached responses <100ms.

### Layer B — Run faster (medium impact)

#### B1 · Local Ollama if GPU available
**Status:** ⏳ Planned (env-dependent) · **Impact:** ⚡ Medium — 0.5–1s per call

Tailscale adds 50–150ms RTT to every Ollama request. If the host running the backend has a GPU, run Ollama locally and set `OLLAMA_HOST=http://localhost:11434`.

For deployments without local GPU, this is moot.

#### B2 · Prompt compression
**Status:** 🌱 Nice-to-have · **Impact:** 🟢 Small — 0.5–2s

The analyzer prompt currently includes:
- Full conversation history (capped at messages <4000 chars)
- All-equipment context (chillers + towers + pumps for 24h)
- RAG chunks
- System prompt + rules

Some can be compressed:
- Summary blocks instead of full row tables (we already have summary; cut row tables when no specific equipment selected)
- Hash + omit messages older than the last 4 turns
- Drop equipment sections with no data

Acceptance: prompt-eval-duration metric drops 20%+.

#### B3 · Stream-first prompt design
**Status:** 🌱 Nice-to-have · **Impact:** 🟢 Small — TTFT improvement

Move expensive context (RAG chunks, equipment tables) to the **end** of the prompt. The model can start producing tokens before fully consuming the entire context. Improves time-to-first-token.

### Layer C — Avoid redundant work (already done)

✅ **Parallel DB fetches** — `fetch_all_hvac_context` uses `asyncio.gather` (was sequential).
✅ **Connection pooling** — MySQL + Postgres engines configured with pool_size=10, max_overflow=5.
✅ **Token batching on frontend** — `useAgentStream` debounces token state updates at 40ms.
✅ **Stable markdown components** — `useMemo` prevents tree rebuild per token.
✅ **Tool payload bound** — 12k char cap on tool results in agent loop.
✅ **RAG threshold** — raised 0.4 → 0.55 (less context noise = less prompt-eval time).
✅ **Vite chunk split** — echarts split into core + react wrapper.

---

## Profiling & measurement

### Where the timing data lives

| Source | What | Where |
|---|---|---|
| `analyzer_requests_total` (Prometheus) | Request counts by status | `/metrics` |
| `analyzer_request_duration_seconds` | Per-request histograms | `/metrics` |
| `analysis_audit.total_ms` (Postgres) | Per-request wall-clock time | Audit log |
| Ollama response `total_duration` / `eval_duration` | Inside-LLM breakdown | Logged at DEBUG level in `app.llm.ollama` |
| Backend access log | HTTP request timing | `logs/backend-uvicorn.log` |

### Manual profile commands

```bash
# Full latency walk-through
curl -w "%{time_total}" --max-time 60 -X POST http://localhost:8000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"question":"Is chiller 1 efficient?","hours":6}'

# Ollama eval rate
curl -X POST http://100.125.103.28:11434/api/generate \
  -d '{"model":"qwen2.5:14b","prompt":"...","stream":false,"options":{"num_predict":200}}' \
  | jq '.eval_count / (.eval_duration / 1e9)'  # tokens/sec
```

---

## Roadmap

| Tier | Item | Effort | Impact | Status |
|---|---|---|---|---|
| 🔥 | A1 — right-size model per task | 3 hours | 2–3× speedup | 🟢 Done (`4d2b0c9`) |
| 🔥 | A2 — cap response length | 1 hour | ~30% speedup on /analyze | 🟢 Done (`4d2b0c9`) |
| ⚡ | A3 — Redis response cache | 4 hours | High hit rate cuts to ~100ms | ⏳ Planned |
| ⚡ | B1 — local Ollama (if hardware) | 1 hour | 0.5–1s saved per call | ⏳ Env-dependent |
| 🌱 | B2 — prompt compression | 2 hours | 20% prompt-eval speedup | 🌱 Later |
| 🌱 | B3 — stream-first prompt | 1 hour | Better TTFT | 🌱 Later |

**Aggregate impact of Tier 1 (A1 + A2):** /analyze 48s → ~15s; /agent/run 27s → ~10s.

---

## Acceptance criteria for "Tier 1 done"

- [ ] `OLLAMA_MODEL_FOR_SQL`, `OLLAMA_MODEL_FOR_AGENT_TOOL`, `OLLAMA_MODEL_FOR_CRITIQUE` configurable via env
- [ ] `/analyze` response capped at 250 tokens (Ollama `num_predict` + prompt rule)
- [ ] `/agent/run` final answer capped at 200 tokens
- [ ] P50 latency on `/analyze` < 20s on representative workload
- [ ] P50 latency on `/agent/run` (1-tool) < 15s
- [ ] No regression on existing quality metrics (self-critique pass rate)

---

## Anti-patterns to avoid

1. **Doing all optimization in code while the model is the bottleneck.** Profile first; ~80% of time is in the LLM. Right-size before micro-optimizing Python.
2. **Caching responses across telemetry windows.** The cache key MUST include the data window end timestamp — stale data is worse than slow responses.
3. **Reducing quality silently.** Any prompt change that affects answer length / structure must be evaluated against the regression suite (see [AI_EVALUATION_PLAN.md](./EVALUATION_PLAN.md)).
4. **Increasing parallelism without bound.** Async chat to Ollama is throttled by GPU memory. Hitting Ollama with 20 concurrent requests will queue or OOM, not speed up.
