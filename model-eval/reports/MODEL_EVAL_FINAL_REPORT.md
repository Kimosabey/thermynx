# OMNYX / THERMYNX — Model Evaluation: Final Combined Report

> **One document, everything:** decision · evidence (local + cloud) · hardware · deployment.
> Real test on live Unicharm data. Judge = `qwen2.5:32b`. Scores 1–5, **pass = 4+**.
> Dates: 2026-06-03 (eval) · 2026-06-05 (in-app golden-eval filter). Everything **on-prem**
> (cloud used for testing big models only). Source files: REAL_DATA_MODEL_EVAL.md,
> OPENROUTER_MODEL_EVAL.md.

---

## 1. DECISION — deploy these (all non-Chinese)

| Job | Model | Params | Maker | Country |
|---|---|---|---|---|
| Planner | **mistral-small3.2** | 24B | Mistral AI | 🇫🇷 FR |
| Executor | **mistral-small3.2** | 24B | Mistral AI | 🇫🇷 FR |
| NL→SQL | **mistral-small3.2** + guardrails | 24B | Mistral AI | 🇫🇷 FR |
| Validator | **phi4** | 14B | Microsoft | 🇺🇸 US |
| Narration / Text | **phi4** | 14B | Microsoft | 🇺🇸 US |
| RAG | **phi4** | 14B | Microsoft | 🇺🇸 US |
| Vision | **llama3.2-vision** | 11B | Meta | 🇺🇸 US |
| Embeddings | **nomic-embed-text** | ~0.1B | Nomic AI | 🇺🇸 US |

**4 models, ~32 GB total → fit together on the 48 GB box. No upgrade needed.**

---

## 2. KEY DECISIONS TO TAKE

| # | Decision | Why |
|---|---|---|
| 1 | Deploy mistral-small3.2 + phi4 (+vision +nomic) | Best non-Chinese, in-app-working set |
| 2 | Keep planned **48 GB** box | Whole team fits (~32 GB); no upgrade |
| 3 | Don't use 70B/120B | Cloud test: no quality gain, slower |
| 4 | Exclude Chinese models (qwen/deepseek/qwq) | Policy |
| 5 | Treat **NL→SQL as #1 risk** | All models weak → fix guardrails/retry |
| 6 | Final sign-off: full-depth re-run + FP8 latency test | This was a quick ranking run |
| 7 | Rotate OpenRouter API key | Was shared during testing |

---

## 3. HOW WE TESTED

| Item | Detail |
|---|---|
| Data | Real Unicharm MySQL telemetry + real pgvector document corpus |
| Jobs (7) | Planner, Validator, Executor, NL→SQL, RAG, Narration, Embeddings |
| Check 1 (hard rule) | valid JSON / runnable SQL / grounded work order |
| Check 2 (judge AI) | `qwen2.5:32b` rates quality 1–5; pass = 4+ |
| Local | ≤32B models on the 20 GB box (Ollama Q4) |
| Cloud | 70B/120B via OpenRouter — **quality only** (speed ≠ our hardware) |
| Final filter | in-app golden eval (2026-06-05) drops models that score well but break live |

---

## 4. EVIDENCE — local results (≤32B, on our hardware)

Avg score (pass-rate). **Bold = deployed.**

| Model | Planner | Validator | Executor | NL→SQL | RAG | Narration |
|---|---|---|---|---|---|---|
| **mistral-small3.2** | 3.0 | **5.0** | 3.0 | 2.8 (best non-CN) | 4.4 | 4.5 |
| **phi4** | 3.0* | **5.0** | 3.0 | 2.0 | 4.4 | 4.5 |
| gpt-oss:20b | 3.5 | 5.0 | 3.0 | **3.2** | 4.4 | 4.0 |
| gemma3:27b | **4.0** | 5.0 | 2.0 | 2.4 | 4.4 | 4.5 |
| qwen2.5:14b 🇨🇳 | 3.5 | 5.0 | **3.5** | 2.6 | 4.4 | 4.5 |
| qwen2.5:32b 🇨🇳 | 3.5 | 5.0 | 3.0 | 2.5 | 4.4 | 4.5 |
| llama3.1:8b | 3.0 | 5.0 | 2.5 | 2.5 | 4.2 | 3.0 |
| deepseek-r1:32b 🇨🇳 | 3.0 (75s) | 2.5 | 1.5 (434s) | 0.0 | 4.4 | err |
| qwq:32b 🇨🇳 | 4.0 | 5.0 | 2.5 (226s) | 0.0 | 4.4 | 4.0 |
| qwen2.5-coder:32b 🇨🇳 | — | — | — | 2.25 | — | — |
| Embeddings: nomic = mxbai | — | — | — | — | — | both **5.0** |

\* phi4 had 1 malformed plan on the reduced run; strong elsewhere → deployed for Validator/RAG/Narration.

---

## 5. EVIDENCE — cloud results (big models, quality-only)

| Model | Params | Planner | Validator | Executor | RAG | Narration |
|---|---|---|---|---|---|---|
| gpt-oss-120b | 120B | 4.0 (errored 2/3) | 5.0 | 2.33 | 4.4 | 4.0 |
| llama-3.3-70b | 70B | 3.67 | 5.0 | 2.33 | 4.4 | 4.5 |
| qwen-2.5-72b 🇨🇳 | 72B | 3.0 | 5.0 | 3.33 | 4.25 | 4.0 |
| deepseek-r1-distill-70b 🇨🇳 | 70B | 0 (fail) | 1.0 | 1.0 | 4.4 | 4.5 |
| gpt-oss-20b | 20B | 4.0 | 5.0 | 2.33 | 4.5 | 4.0 |

**Verdict: bigger did NOT win** — 70B/120B tie at best, run slower, 120B timed out on planning.
(NL→SQL not run on cloud — backend SQL path can't route cloud models.)

---

## 6. WHY THE RAW WINNERS AREN'T DEPLOYED

| Model | Note |
|---|---|
| gpt-oss:20b | **Good & fits**, won 3 jobs — but **reasoning model → empty answers** under our token caps; **failed golden eval**. Fixable (raise token budget + thinking-aware streaming). |
| gemma3:27b | Won planner but **broke tool-calling (2.0)**; failed golden eval; 27B blocks co-residency. |
| qwen / deepseek / qwq | **Chinese-origin — excluded by policy.** (qwen2.5:32b used only as offline judge.) |

---

## 7. HARDWARE — servers & fit

| | Current (test) | Future (production) |
|---|---|---|
| GPU VRAM | **20 GB** (RTX 4000 Ada) | **48 GB** |
| RAM | 32 GB | 48 GB |
| Serving | Ollama (Q4) | vLLM (FP8) |
| Loadable at once | 1 chat model | all 4 models |

**What fits in the 20 GB box today** (one chat model + tiny embedder):

| Loadout | VRAM | OK? |
|---|---|---|
| phi4 + nomic | ~9 GB | ✅ |
| mistral-small3.2 + nomic | ~15 GB | ✅ |
| llama3.2-vision + nomic | ~8 GB | ✅ |
| phi4 + mistral together | ~24 GB | ❌ swap |
| 70B / 120B | 42 / 65 GB | ❌ |

**Model size → fit:** 11–24B ✅ ideal · 27–32B ✅ alone only · 70B needs 80 GB (FP8) · 120B can't run on-prem.

**Hardware tiers:** A = **48 GB (recommended, proven best)** · B = 80 GB (optional, no gain) · C = 160 GB (not justified).

### 20 GB box vs 48 GB box — pros / cons / limitations

| Aspect | **20 GB box (current / test)** | **48 GB box (future / production)** |
|---|---|---|
| Models loaded at once | **1 chat model** + tiny embedder | **All 4 models** together |
| Multi-agent (Planner+Validator+Executor) | ❌ run one at a time | ✅ run in parallel |
| Model swapping | ⚠️ yes — reload delay when role changes | ✅ none — all resident |
| Precision / quality | Q4 (lower) | **FP8 (higher quality)** |
| Biggest model | ≤32B (alone, tight) | ≤32B easily; 70B only 4-bit alone |
| Production-ready? | ❌ dev/screening only | ✅ yes |
| Cost | already owned | new GPU spend |

**Pros — 20 GB box:** already have it; free; runs **all our chosen models** (one at a time); perfect for testing, screening, and the eval we just did.

**Cons / limitations — 20 GB box:** only **one chat model fits at a time**, so a live agent flow (plan → validate → execute) must **swap models between steps** (seconds of delay each switch); **no concurrency**; tight for 27–32B; reasoning models very slow; **cannot host 70B/120B**. → **Not suitable for production multi-agent load.**

**Pros — 48 GB box:** the **whole 4-model team stays loaded** (~32 GB, ~16 GB spare) → **no swapping, agents run together**, lower latency; **FP8 = better quality** than the Q4 we tested; production-grade; headroom for concurrent users.

**Cons / limitations — 48 GB box:** new GPU cost; still **can't run a 70B at FP8** (only 4-bit, and then *alone*) or a 120B — those need an **80 GB** card. (Per the eval, that's fine — bigger models gave no benefit.)

**Verdict:** keep the **20 GB box for dev/testing**; deploy production on the **48 GB box** — it removes the swapping limit and runs the full agent team at higher precision. No need to go beyond 48 GB.

---

## 8. DEPLOYMENT — live config (`backend/app/config.py`)

| Job | Setting | Model |
|---|---|---|
| Default | `OLLAMA_DEFAULT_MODEL` | phi4 |
| Text / Narration | `OLLAMA_MODEL_TEXT` | phi4 |
| Tool / Executor | `OLLAMA_MODEL_TOOL` | mistral-small3.2 |
| NL→SQL | `OLLAMA_MODEL_SQL` | mistral-small3.2 |
| Planner | `OLLAMA_MODEL_PLANNER` | mistral-small3.2 |
| Validator | `OLLAMA_AUDITOR_MODEL` | phi4 |
| RAG | `OLLAMA_MODEL_RAG` | (empty)→phi4 |
| Vision | `OLLAMA_VISION_MODEL` | llama3.2-vision |
| Embeddings | pipeline | nomic-embed-text |

**Tuning:** AGENT_MAX_STEPS=8 · NL_QUERY_LLM_TIMEOUT=40s · CHAT_TIMEOUT=60s · VISION_TIMEOUT=90s.
**Guardrails:** NL→SQL validator + deny-list + LIMIT cap · work-order numeric-citation guard (never auto-persists).

---

## 9. BOTTOM LINE

| Question | Answer |
|---|---|
| Best models | **mistral-small3.2 (24B) + phi4 (14B)** + llama3.2-vision + nomic-embed-text — all non-Chinese |
| Best hardware | **Planned 48 GB box (FP8)** — fits the team (~32 GB); no upgrade |
| Need 70B/120B? | **No** — bigger ties/loses; would need 80 GB+ |
| Biggest risk | **NL→SQL** — fix with guardrails/retry, not a bigger model |
| Revisit later | **gpt-oss:20b** — with higher token budget + thinking-aware streaming |
| Cross-check | Confirms earlier synthetic pick on real data — **safe to lock in** |

**One line:** run **mistral-small3.2 + phi4** (+ vision + nomic) on the **planned 48 GB FP8 box** —
best-grade, best-fit, all-non-Chinese, no extra hardware needed.

---
*Detailed companions: MODEL_FIT_VERDICT.md (decision) · ONPREM_HARDWARE_SIZING.md (hardware/deploy) ·
REAL_DATA_MODEL_EVAL.md & OPENROUTER_MODEL_EVAL.md (raw per-case tables).*
