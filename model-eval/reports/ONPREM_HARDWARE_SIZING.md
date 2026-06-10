# OMNYX / THERMYNX — On-Prem Hardware, Models & Deployment Guide

> **Purpose:** one complete reference — the **hardware** we run on, the **models** we picked
> (and tested), and the **live deployment config**. All tabular.
> **Dates:** 2026-06-03 (eval) · 2026-06-05 (in-app golden-eval filter).
> **Companion:** [MODEL_FIT_VERDICT.md](MODEL_FIT_VERDICT.md) (decision evidence) ·
> raw data: [REAL_DATA_MODEL_EVAL.md](REAL_DATA_MODEL_EVAL.md) (local) ·
> [OPENROUTER_MODEL_EVAL.md](OPENROUTER_MODEL_EVAL.md) (cloud). Everything runs **on-prem**
> (cloud was test-only).

> **🔄 UPDATE 2026-06-10:** (1) **phi4 RESTORED** — Ollama 0.30.6 → **0.30.7** fixes the phi4
> `0xc0000409` crash, so phi4 (eval winner 5.0) is now deployed for **Validator / Narration / RAG**;
> mistral-small3.2 is the **fallback**. (2) Added a **64 GB tier** and an **"AI CPU" (Core Ultra
> NPU/iGPU)** note (§A6). (3) Added an **Apple Silicon alternative — Mac Studio M3 Ultra 96 GB** (§A7),
> evaluated against the NVIDIA path. Updated tables reflect this; any older "phi4 crashes 0.30.6" line is superseded.

---

# PART A — HARDWARE

## A1. Our on-prem servers

| | Current (test box) | Future (production) | Headroom (optional) |
|---|---|---|---|
| GPU | RTX 4000 Ada | (planned) RTX 6000 Ada / L40S class | RTX 6000 Ada + 2nd card / bigger |
| **GPU VRAM** | **20 GB** | **48 GB** | **64 GB** |
| System RAM | 32 GB | 48–64 GB | 64–128 GB |
| Serving engine | Ollama (Q4 GGUF) | vLLM (FP8) | vLLM (FP8) |
| Models loadable at once | **1 big chat model + nomic hot** | **all core models together** (~31–44 GB) | **entire team hot** incl. vision |
| Role | screening / dev | production | future / multi-tenant headroom |

> The **NPU / iGPU inside the Core Ultra CPU is NOT a serving tier** — see §A6. All inference runs on the discrete NVIDIA GPU.
> A non-NVIDIA alternative — **Mac Studio M3 Ultra (96 GB unified, Ollama-Metal)** — is evaluated in **§A7**.

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

| Param size | VRAM (Q4) | 20 GB | 48 GB | 64 GB | Use? |
|---|---|---|---|---|---|
| 8B | ~5 GB | ✅ | ✅ | ✅ | ⚠️ quality too low |
| **11–14B** | ~8–9 GB | ✅ | ✅ | ✅ | ✅ **ideal** (phi4, vision) |
| **24B** | ~15 GB | ✅ alone | ✅ | ✅ | ✅ **ideal** (mistral-small3.2) |
| 27–32B | ~17–19 GB | ✅ alone | ✅ | ✅ | ❌ blocks co-residency, no gain |
| 70B | ~42 GB (Q4) / ~75 GB (FP8) | ❌ | alone-only | ✅ Q4 alone | ❌ not worth it |
| 120B | ~65 GB+ | ❌ | ❌ | ❌ (needs 80 GB+) | ❌ can't run |

**Per-box loadout — which of the deployed team stays hot (Q4):** (full team resident ≈ 66–68 GB)

| Box | Usable mem | Hot (resident) | Rotates on demand | Rotation? |
|---|---|---|---|---|
| **20 GB** (RTX 4000 Ada) | ~19 GB | phi4 (9) + gemma4 (8) + nomic (0.3) ≈ 17 GB | devstral, codestral, mistral, vision | ❌ heavy — each 13–15 GB model evicts another |
| **48 GB** (RTX 6000 Ada / L40S) | ~46 GB | gemma4 + devstral + codestral + phi4 + nomic ≈ 44 GB | mistral (fallback), vision | ⚠️ minimal — 5 of 7 hot |
| **64 GB** | ~62 GB | above + vision ≈ 52 GB | mistral (fallback) only | ✅ none in practice — 6 of 7 hot |
| **Mac Studio M3 Ultra 96 GB** | ~72–86 GB | **entire team ≈ 66 GB** | — | ✅ zero — all 7 hot (see §A7) |

> Per-model params/VRAM are in §B1. FP8 (vLLM) is higher-precision but larger per parameter, so fewer models stay hot at once — the Q4 loadout above is the practical reference.

## A4. Hardware tiers vs quality grade

| Tier | On-prem GPU | RAM | Precision | Runs | Grade (our tasks) | Verdict |
|---|---|---|---|---|---|---|
| **Dev — Current** | **20 GB** (RTX 4000 Ada) | 32 GB | Q4 (Ollama) | 1 big model + nomic hot; others evict on use | Fine for dev/screening; thrashes under multi-model | ✅ Dev only |
| **A — Planned** | **48 GB** | 48–64 GB | FP8 | Full 14–24B team resident (~32 GB) | **Production-grade, proven best** | ✅ **Recommended** |
| **A+ — Headroom** | **64 GB** | 64–128 GB | FP8 | Entire team hot incl. vision (~44–52 GB) + KV room | Same quality, more concurrency / no model rotation | ⚪ Optional comfort, not required |
| **B — Premium** | **80 GB** (A100/H100) | 128 GB | FP8 | One 70B + small validator | Highest single-model | ⚠️ Optional — no real gain |
| **C — Max** | **2× 80 GB** | 256 GB | FP8 | 120B / many big models | Frontier / headroom | ❌ Not justified |

## A5. What stays on-prem (production)

| Component | Location | Note |
|---|---|---|
| LLM models (phi4, mistral, vision, embed) | **On-prem GPU** | Ollama / vLLM |
| Plant data (MySQL telemetry) | **On-prem** | never leaves network |
| Document corpus (pgvector) | **On-prem** | never leaves network |
| Cloud (OpenRouter) | **Test-only** | NOT in production |

## A6. "AI CPU" — the Core Ultra NPU / iGPU (not a serving option)

The test box CPU is an **Intel Core Ultra 9 285K**, which includes an **NPU ("AI Boost")** and an
**Arc Xe iGPU**. Neither is usable for our LLMs with the current stack:

| Compute unit | Used by Ollama? | Why / evidence |
|---|---|---|
| **NVIDIA RTX 4000 Ada (CUDA)** | ✅ yes | All inference runs here (`library=CUDA compute=8.9`). |
| **Intel Arc iGPU (Vulkan)** | ❌ auto-dropped | Server log: `dropping integrated GPU; to enable, set OLLAMA_IGPU_ENABLE=1`. Even if enabled it shares slow system RAM and is far weaker than the RTX 4000 — net negative. |
| **Intel NPU ("AI Boost")** | ❌ no backend | Ollama / llama.cpp have **no NPU path**. The NPU targets small ONNX/DirectML/OpenVINO workloads, not 14–24B GGUF LLMs. |
| **CPU cores only** | ⚠️ technically | Runs, but ~10–50× slower than the GPU at these sizes → unusable for an interactive app. |

**Do we need to test it? No.** There is no Ollama route to the NPU, and the iGPU/CPU are strictly
slower than the discrete GPU we already use — a benchmark would only confirm "worse." **Keep all LLM
serving on the NVIDIA GPU.** (A future *tiny* on-NPU model — e.g. a local OCR/vision pre-filter via
OpenVINO/DirectML — is a separate stack from Ollama and would get its own evaluation.)

> **Not the same as Apple Silicon:** §A6 rejects the **Intel** NPU/iGPU (no Ollama path). **Apple Metal
> *is* a fully supported Ollama backend** — so a Mac is a legitimate (if throughput-limited) serving box,
> evaluated next in §A7. "Non-NVIDIA" is not blanket-rejected.

## A7. Apple Silicon alternative — Mac Studio M3 Ultra (96 GB)

**Considered as an alternative to the planned 48 GB NVIDIA box** (not a replacement). Apple Silicon is a
real Ollama serving platform via **Metal** (all 7 roles incl. vision), with a large **unified memory** pool.

| Spec | Mac Studio M3 Ultra (this config) |
|---|---|
| Unified memory | **96 GB** (~72–86 GB usable for models via `iogpu.wired_limit_mb`) |
| Memory bandwidth | **~819 GB/s** (>2× RTX 4000's ~360; near RTX 6000 Ada ~960) |
| Serving engine | **Ollama-Metal** (full team incl. vision) · `vllm-metal` exists but is **text-only** |
| Whole team hot? | ✅ **yes** — entire team (~68 GB) resident, **no eviction/rotation** |
| Speed (14–24B) | interactive, ≈ phi4-on-RTX-4000 (~35 tok/s) or better; 70B Q4 ≈ 10–15 tok/s |
| Power / footprint | ~100–200 W, silent, desktop-sized |
| Cost | ~$4,000 / ~₹3.5 L (96 GB / 1 TB) |

### Mac Studio 96 GB vs NVIDIA 48 GB (planned)

| Factor | Mac Studio M3 Ultra 96 GB | NVIDIA 48 GB (RTX 6000 Ada / L40S) |
|---|---|---|
| Usable model memory | ~72–86 GB unified | 48 GB VRAM |
| Memory bandwidth | ~819 GB/s | ~860–960 GB/s |
| Engine | Ollama-Metal (vllm-metal = text-only) | **vLLM FP8** (best batching) or Ollama |
| Whole team hot | ✅ all 7 roles, no rotation | ⚠️ core team fits; full set tight |
| **Concurrent batching (many users)** | ❌ weak (~20–50 tok/s, limited) | ✅ **strong — continuous batching** |
| Vision (llama3.2-vision) | ✅ Ollama-Metal | ✅ |
| Power / noise / size | ✅ low / silent / tiny | ❌ workstation/server |
| Multi-site replication | ⚠️ a Mac per site (low per-site load) | ✅ central vLLM server or per-site GPU |
| Ops | macOS (different toolchain) | Linux + CUDA (standard for vLLM) |

### Verdict (THERMYNX = many-concurrent, multi-site)
**NVIDIA + vLLM (the planned 48 GB box) stays the production engine.** vLLM's continuous batching on CUDA
is built for many parallel requests; Apple Silicon serving delivers strong *single-stream* speed but weak
*batched* throughput, so it would bottleneck under many concurrent users across sites. The Mac Studio's
96 GB "whole-team-hot" advantage pays off when you're **memory-bound on one box, not throughput-bound across
many users** — making it the better pick for a **single-box, low-concurrency, edge / dev / demo / fallback**
role. Net: keep NVIDIA+vLLM for multi-site production; hold the Mac as a per-site edge / dev option. Full
write-up: [MAC_STUDIO_M3_ULTRA_EVALUATION.md](../../docs/operations/hardware/MAC_STUDIO_M3_ULTRA_EVALUATION.md).

---

# PART B — MODELS

## B1. Deployed model team (all non-Chinese, Claude-judged + app-confirmed)

> Updated 2026-06 (Ollama 0.30.6): judge = **Claude Opus 4.8**; **3 upgrades** — **gemma4**
> (Planner), **devstral** (Executor), **codestral** (NL→SQL). Plain-English: [MODEL_EVAL_FINAL_REPORT.md](MODEL_EVAL_FINAL_REPORT.md).

| Model | Params | Maker | Country | VRAM (Q4) | Jobs it does |
|---|---|---|---|---|---|
| **gemma4:12b** ⬆🧠 | 12B | Google | 🇺🇸 US | ~8 GB | **Planner** — best plans (3.3–4.0), JSON path |
| **devstral** ⬆ | 24B | Mistral AI | 🇫🇷 FR | ~14 GB | **Executor** (tool-calling) — best (4.5) |
| **codestral** ⬆ | 22B | Mistral AI | 🇫🇷 FR | ~12 GB | **NL→SQL** (+ guardrails) |
| **phi4** ⬆ | 14B | Microsoft | 🇺🇸 US | ~9 GB | **Validator, Text, Narration, RAG** — eval winner 5.0, restored on Ollama 0.30.7 |
| **mistral-small3.2** | 24B | Mistral | 🇫🇷 FR | ~15 GB | Default / fallback model |
| **llama3.2-vision** | 11B | Meta | 🇺🇸 US | ~8 GB | Vision |
| **nomic-embed-text** | ~0.1B | Nomic AI | 🇺🇸 US | ~0.3 GB | Embeddings |

**On the 48 GB box** the core agents (gemma4 + phi4 + devstral, ~31 GB) stay loaded together;
codestral/vision rotate in as needed. Each runs alone on the 20 GB box.
**mistral-small3.2** is the **safe fast fallback for Planner** if gemma4's ~25s is too slow.
**Key insight:** gemma4 is a *thinking* model — it works great in the **JSON planner path**
(roomy) but goes blank in the short capped *text* path, so we use it for Planner only.

**Specs (from the server) — context window + input matter for memory & prompt sizing:**

| Name | Size / Usage | Context | Input / capabilities |
|---|---|---|---|
| gemma4:12b (Planner) | 11.9B / ~8 GB | **256K** | Text + Vision + Audio + Tools + thinking |
| devstral (Executor) | 23.6B / ~14 GB | 128K | Text + Tools |
| codestral (NL→SQL) | 22.2B / ~12 GB | 32K | Text (code) |
| phi4 (Validator/Narration/RAG) | 14.7B / ~9 GB | **16K** | Text only |
| mistral-small3.2 (fallback) | 24.0B / ~15 GB | 128K | Text + Vision + Tools |
| llama3.2-vision (Vision) | 10.7B / ~8 GB | 128K | Text + Images + Tools |
| nomic-embed-text (Embeddings) | 137M / ~0.3 GB | 2K | Text (search) |

> Bigger context = more KV-cache VRAM. phi4 is capped at **16K** — keep big RAG prompts trimmed
> for the phi4 jobs; gemma4/devstral/mistral have plenty of room (128–256K).

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
| Default fallback | `OLLAMA_DEFAULT_MODEL` | **mistral-small3.2** (safe fallback) | Mistral |
| Narration / Text | `OLLAMA_MODEL_TEXT` | **phi4** ⬆ (restored on 0.30.7; was mistral-small3.2) | Microsoft |
| Tool / Executor | `OLLAMA_MODEL_TOOL` | **devstral** ⬆ (was mistral-small3.2) | Mistral AI |
| NL→SQL | `OLLAMA_MODEL_SQL` | **codestral** ⬆ (was mistral-small3.2) | Mistral AI |
| Planner | `OLLAMA_MODEL_PLANNER` | **gemma4:12b** ⬆ (fallback: mistral-small3.2) | Google |
| Validator / Auditor | `OLLAMA_AUDITOR_MODEL` | **phi4** ⬆ (restored on 0.30.7; was mistral-small3.2) | Microsoft |
| RAG answer | `OLLAMA_MODEL_RAG` | **phi4** ⬆ (restored on 0.30.7; gpt-oss NOT used — goes blank) | Microsoft |
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
| Best models? | Planner **gemma4:12b** · Executor **devstral** · NL→SQL **codestral** · Validator/Narration/RAG **phi4** (restored on Ollama 0.30.7; mistral-small3.2 = fallback) · Embeddings **nomic** · Vision **llama3.2-vision** — all non-Chinese |
| Best hardware? | **The planned 48 GB box (FP8)** — fits the team, no upgrade needed |
| Need a 70B/120B? | **No** — cloud test showed bigger ties/loses; would also need an 80 GB+ GPU |
| Biggest risk? | **NL→SQL** — fix with guardrails/retry, not a bigger model |
| Excluded (blank in app) | **gemma4, gpt-oss** — scored well but return blank answers under the app's word limit |
| Revisit later? | gpt-oss / gemma4 — only with a higher word budget + thinking-aware streaming |

**One line:** run **gemma4 + devstral + codestral + phi4** (+ vision + nomic) on the **planned 48 GB FP8 box** —
that is the best-grade, best-fit, all-non-Chinese setup for our tasks; no bigger hardware needed.
