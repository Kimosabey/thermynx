# OMNYX / THERMYNX — On-Prem Hardware, Models & Deployment Guide

> **Purpose:** one complete reference — the **hardware** we run on, the **models** we picked
> (and tested), and the **live deployment config**. All tabular.
> **Dates:** 2026-06-03 (eval) · 2026-06-05 (in-app golden-eval filter).
> **Companion:** [MODEL_FIT_VERDICT.md](MODEL_FIT_VERDICT.md) (decision evidence) ·
> raw data: [REAL_DATA_MODEL_EVAL.md](REAL_DATA_MODEL_EVAL.md) (local) ·
> [OPENROUTER_MODEL_EVAL.md](OPENROUTER_MODEL_EVAL.md) (cloud). Everything runs **on-prem**
> (cloud was test-only).

---

# PART A — HARDWARE

## A1. Our on-prem servers

| | Current (test box) | Future (production) |
|---|---|---|
| GPU | RTX 4000 Ada | (planned) RTX 6000 Ada / L40S class |
| **GPU VRAM** | **20 GB** | **48 GB** |
| System RAM | 32 GB | 48 GB |
| Serving engine | Ollama (Q4 GGUF) | vLLM (FP8) |
| Models loadable at once | **1 chat model at a time** | **all 4 models together** |
| Role | screening / dev | production |

## A2. What fits in the 20 GB box TODAY (practical loadout)

Holds **one chat model at a time**; the tiny embedder can stay resident with it. Switching
chat models = a **model swap** (slow reload).

| Loadout in GPU at once | VRAM | Works on 20 GB? |
|---|---|---|
| phi4 (9) + nomic-embed (0.3) | ~9 GB | ✅ yes |
| mistral-small3.2 (15) + nomic-embed (0.3) | ~15 GB | ✅ yes |
| llama3.2-vision (8) + nomic-embed (0.3) | ~8 GB | ✅ yes |
| **phi4 + mistral together** (two chat models) | ~24 GB | ❌ they swap |
| single 27–32B (gemma3 / qwen) | ~17–19 GB | ✅ tight, alone |
| gpt-oss:20b | ~13 GB | ✅ fits (but breaks in-app — Part B) |
| 70B / 120B | ~42 / ~65 GB | ❌ no |

## A3. Model size → does it fit? (reference)

| Param size | VRAM (Q4) | 20 GB | 48 GB | Use? |
|---|---|---|---|---|
| 8B | ~5 GB | ✅ | ✅ | ⚠️ quality too low |
| **11–14B** | ~8–9 GB | ✅ | ✅ | ✅ **ideal** (phi4, vision) |
| **24B** | ~15 GB | ✅ alone | ✅ | ✅ **ideal** (mistral-small3.2) |
| 27–32B | ~17–19 GB | ✅ alone | ✅ | ❌ blocks co-residency, no gain |
| 70B | ~42 GB (Q4) / ~75 GB (FP8) | ❌ | alone-only / 80 GB | ❌ not worth it |
| 120B | ~65 GB+ | ❌ | ❌ | ❌ can't run on planned box |

## A4. Hardware tiers vs quality grade

| Tier | On-prem GPU | RAM | Precision | Runs | Grade (our tasks) | Verdict |
|---|---|---|---|---|---|---|
| **A — Planned** | **48 GB** | 48–64 GB | FP8 | Full 14–24B team resident (~32 GB) | **Production-grade, proven best** | ✅ **Recommended** |
| **B — Premium** | **80 GB** (A100/H100) | 128 GB | FP8 | One 70B + small validator | Highest single-model | ⚠️ Optional — no real gain |
| **C — Max** | **2× 80 GB** | 256 GB | FP8 | 120B / many big models | Frontier / headroom | ❌ Not justified |

## A5. What stays on-prem (production)

| Component | Location | Note |
|---|---|---|
| LLM models (phi4, mistral, vision, embed) | **On-prem GPU** | Ollama / vLLM |
| Plant data (MySQL telemetry) | **On-prem** | never leaves network |
| Document corpus (pgvector) | **On-prem** | never leaves network |
| Cloud (OpenRouter) | **Test-only** | NOT in production |

---

# PART B — MODELS

## B1. Deployed model team (4 models, all non-Chinese)

| Model | Params | Maker | Country | VRAM (Q4) | Jobs it does |
|---|---|---|---|---|---|
| **mistral-small3.2** | 24B | Mistral AI | 🇫🇷 FR | ~15 GB | Planner, Executor, NL→SQL |
| **phi4** | 14B | Microsoft | 🇺🇸 US | ~9 GB | Validator, Text, Narration, RAG |
| **llama3.2-vision** | 11B | Meta | 🇺🇸 US | ~8 GB | Vision |
| **nomic-embed-text** | ~0.1B | Nomic AI | 🇺🇸 US | ~0.3 GB | Embeddings |

**Total ≈ 32 GB** → all fit together on the 48 GB box (~16 GB spare); each runs alone on 20 GB.

## B2. All models tested — local / on-prem candidates

| Model | Params | Maker | Country | Outcome |
|---|---|---|---|---|
| gpt-oss:20b | 20B | OpenAI | 🇺🇸 US | Good + fits, but **failed in-app golden eval** (reasoning→empty) → not used (fixable) |
| **phi4** | 14B | Microsoft | 🇺🇸 US | ✅ **deployed** (validator 5.0, narration/RAG 4.4–4.5) |
| **mistral-small3.2** | 24B | Mistral AI | 🇫🇷 FR | ✅ **deployed** (best non-Chinese tool-caller) |
| gemma3:27b | 27B | Google | 🇺🇸 US | Won planner (4.0) but **broke tool-calling (2.0)** → not used |
| llama3.1:8b | 8B | Meta | 🇺🇸 US | Baseline — too weak |
| **llama3.2-vision** | 11B | Meta | 🇺🇸 US | ✅ **deployed** (vision) |
| qwen2.5:14b | 14B | Alibaba | 🇨🇳 CN | Scored well — **excluded: Chinese policy** |
| qwen2.5:32b | 32B | Alibaba | 🇨🇳 CN | **Judge only** (offline) — never deployed |
| qwen2.5-coder:32b | 32B | Alibaba | 🇨🇳 CN | NL→SQL weak (2.25) + Chinese → excluded |
| deepseek-r1:32b | 32B | DeepSeek | 🇨🇳 CN | Failed structured jobs + slow + Chinese |
| qwq:32b | 32B | Alibaba | 🇨🇳 CN | Failed structured jobs + slow + Chinese |
| **nomic-embed-text** | ~0.1B | Nomic AI | 🇺🇸 US | ✅ **deployed** (embeddings) |
| mxbai-embed-large | ~0.3B | Mixedbread | 🇩🇪 DE | Ties nomic — backup |

## B3. All models tested — cloud big-models (quality check only, NOT deployed)

| Model | Params | Maker | Country | Result |
|---|---|---|---|---|
| gpt-oss-120b | 120B | OpenAI | 🇺🇸 US | Tied/worse, **timed out** on planner |
| llama-3.3-70b | 70B | Meta | 🇺🇸 US | Tied small models, no gain |
| gpt-oss-20b | 20B | OpenAI | 🇺🇸 US | Same as local |
| qwen-2.5-72b | 72B | Alibaba | 🇨🇳 CN | No gain + Chinese |
| deepseek-r1-distill-70b / -32b | 70B/32B | DeepSeek | 🇨🇳 CN | Failed structured jobs |
| phi-4 / mistral-small-3.2 / gemma-3-27b | 14–27B | MS/Mistral/Google | 🇺🇸🇫🇷 | Same as local |

## B4. Why these 4 — not the raw eval winners

| Model | Why NOT deployed |
|---|---|
| gpt-oss:20b | Good + fits, but **reasoning model → empty answers** under our token caps; **failed golden eval**. Fixable later (higher token budget + thinking-aware streaming). |
| gemma3:27b | **Broke tool-calling (2.0)**, failed golden eval; 27B blocks co-residency. |
| qwen2.5 / coder / deepseek-r1 / qwq | **Chinese-origin — excluded by policy.** |

## B5. Eval scoreboard — raw best vs what we deployed

| Job | Raw best (score) | Deployed | Deployed score | Top among deployable? |
|---|---|---|---|---|
| Planner | gemma3:27b (4.0) | mistral-small3.2 | 3.0 | best non-Chinese, in-app |
| Validator | phi4 (5.0) — tie | **phi4** | **5.0** | ✅ outright best |
| Executor | qwen2.5:14b (3.5) | mistral-small3.2 | 3.0 | best non-Chinese |
| NL→SQL | gpt-oss:20b (3.2) | mistral-small3.2 | 2.8 | + guardrails (all weak) |
| RAG | gpt-oss:20b (4.4) — tie | **phi4** | **4.4** | ✅ ties best |
| Narration | phi4 (4.5) — tie | **phi4** | **4.5** | ✅ ties best |
| Embeddings | nomic = mxbai (5.0) | **nomic-embed-text** | **5.0** | ✅ ties best |

---

# PART C — DEPLOYMENT

## C1. Live THERMYNX config (`backend/app/config.py`)

| Job | Config setting | Model | Maker |
|---|---|---|---|
| Default fallback | `OLLAMA_DEFAULT_MODEL` | phi4 | Microsoft |
| Narration / Text | `OLLAMA_MODEL_TEXT` | phi4 | Microsoft |
| Tool / Executor | `OLLAMA_MODEL_TOOL` | mistral-small3.2 | Mistral AI |
| NL→SQL | `OLLAMA_MODEL_SQL` | mistral-small3.2 | Mistral AI |
| Planner | `OLLAMA_MODEL_PLANNER` | mistral-small3.2 | Mistral AI |
| Validator / Auditor | `OLLAMA_AUDITOR_MODEL` | phi4 | Microsoft |
| RAG answer | `OLLAMA_MODEL_RAG` | *(empty)* → phi4 | Microsoft |
| Vision | `OLLAMA_VISION_MODEL` | llama3.2-vision | Meta |
| Embeddings | (embeddings pipeline) | nomic-embed-text | Nomic AI |

## C2. Deployment tuning / timeouts

| Setting | Value | Why |
|---|---|---|
| `AGENT_MAX_STEPS` | 8 | max ReAct loops before forced stop |
| `NL_QUERY_LLM_TIMEOUT_S` | 40 s | SQL gen on 24B mistral (slower than old 8B) |
| `NL_QUERY_DB_TIMEOUT_S` | 10 s | MySQL execution cap |
| `NL_QUERY_MAX_ROWS` | 1000 | hard LIMIT |
| `OLLAMA_CHAT_TIMEOUT_S` | 60 s | non-streaming tool calls |
| `OLLAMA_STREAM_TIMEOUT_S` | 120 s | streaming answers |
| `VISION_TIMEOUT_S` | 90 s | vision calls |
| `ANALYZER_CACHE_TTL_S` | 60 s | Redis answer cache |

## C3. Guardrails / safety

| Area | Guard | Note |
|---|---|---|
| NL→SQL | validator + deny-list + LIMIT cap | **#1 risk** — all models weak; the guard does the heavy lifting |
| Work orders | numeric-citation guard | proposal must cite a real telemetry number; never auto-persists |
| Model pinning | `OLLAMA_DIGEST_*` (optional) | warns if a model changes under `ollama pull` |

---

# PART D — BOTTOM LINE

| Question | Answer |
|---|---|
| Best models? | **mistral-small3.2 (24B) + phi4 (14B)** + llama3.2-vision + nomic-embed-text — all non-Chinese |
| Best hardware? | **The planned 48 GB box (FP8)** — fits the whole team (~32 GB), no upgrade needed |
| Need a 70B/120B? | **No** — cloud test showed bigger ties/loses; would also need an 80 GB+ GPU |
| Biggest risk? | **NL→SQL** — fix with guardrails/retry, not a bigger model |
| Revisit later? | **gpt-oss:20b** — only with a higher token budget + thinking-aware streaming |

**One line:** run **mistral-small3.2 + phi4** (+ vision + nomic) on the **planned 48 GB FP8 box** —
that is the best-grade, best-fit, all-non-Chinese setup for our tasks; no bigger hardware needed.
