# OMNYX / THERMYNX Model Selection — Final Decision Report

> **Purpose:** pick the best on-prem AI model for each job, based on a real test against live
> Unicharm plant data, then filter by what actually works in our app + our **non-Chinese policy**.
> **Judge = Claude Opus 4.8** (top model). **Updated 2026-06 with new candidates + golden check.**
> **➡ The single, current, plain-English report is [MODEL_EVAL_FINAL_REPORT.md](MODEL_EVAL_FINAL_REPORT.md).**
> **Data:** [REAL_DATA_MODEL_EVAL.md](REAL_DATA_MODEL_EVAL.md) · **Hardware:** [ONPREM_HARDWARE_SIZING.md](ONPREM_HARDWARE_SIZING.md).

---

## 1. The decision — deployed models (non-Chinese, app-confirmed, Claude-judged)

| Job | **Deployed model** | Params | Maker | Why (justification) |
|---|---|---|---|---|
| **Planner** (decide action) | **gemma4:12b** 🧠⬆ | 12B | Google 🇺🇸 | **Best plans (3.3–4.0)**; works in the JSON planner path (no blank); thinking-where-needed. ~25s/plan (background) |
| **Executor** (call tools) | **devstral** ⬆ | 24B | Mistral 🇫🇷 | **Best tool-caller (4.5/5)** & passes golden check — UPGRADE (was mistral-small3.2) |
| **NL→SQL** (question → DB) | **codestral** ⬆ + guardrails | 22B | Mistral 🇫🇷 | Best *deployable* SQL & passes golden — UPGRADE (was mistral-small3.2) |
| **Validator** (approve/reject) | **mistral-small3.2** * | 24B | Mistral 🇫🇷 | 5.0 (ties phi4) |
| **Narration / Text** | **mistral-small3.2** * | 24B | Mistral 🇫🇷 | 4.5 |
| **RAG** (answer from manuals) | **mistral-small3.2** * | 24B | Mistral 🇫🇷 | 4.4 |
| **Vision** (images) | **llama3.2-vision** | 11B | Meta 🇺🇸 | non-Chinese vision model in use |
| **Embeddings** (search) | **nomic-embed-text** | ~0.1B | Nomic 🇺🇸 | ties best, smallest |

> **\* phi4 is the eval winner for these 3 roles (5.0) but the Ollama 0.30.6 runner CRASHES on
> phi4-14B (0xc0000409); 0.30.6 is required for gemma4, so mistral-small3.2 is the runtime
> substitute until Ollama fixes it.**

**Deployed = gemma4 + devstral + codestral + mistral-small3.2 (+vision +nomic), all non-Chinese.**
**Upgrades vs prior:** Planner → **gemma4**, Executor → **devstral**, NL→SQL → **codestral**.

> "Best that actually works in our app," not just "highest score." gemma4/gpt-oss scored well
> but return **blank answers** in the app (thinking-model trap) → dropped. qwen/deepseek/qwq =
> Chinese, excluded. Full plain-English reasoning in [MODEL_EVAL_FINAL_REPORT.md](MODEL_EVAL_FINAL_REPORT.md) §3 & §5.

---

## 2. All models we tested

**Local / on-prem candidates:**

| Model | Params | Maker | Country | Result summary |
|---|---|---|---|---|
| gpt-oss:20b | 20B | OpenAI | 🇺🇸 US | Strong raw scores, but **failed golden eval** (reasoning/empty) → not used |
| **phi4** | 14B | Microsoft | 🇺🇸 US | ✅ **deployed** — validator 5.0, narration 4.5 |
| **mistral-small3.2** | 24B | Mistral AI | 🇫🇷 FR | ✅ **deployed** — best non-Chinese tool-caller |
| gemma3:27b | 27B | Google | 🇺🇸 US | Won planner (4.0) but **broke tool-calling (2.0)** → not used |
| llama3.1:8b | 8B | Meta | 🇺🇸 US | Baseline — too weak (one NL→SQL 0/5) |
| **llama3.2-vision** | 11B | Meta | 🇺🇸 US | ✅ **deployed** — vision only |
| qwen2.5:14b | 14B | Alibaba | 🇨🇳 CN | Scored well (executor/narration) — **excluded: Chinese policy** |
| qwen2.5:32b | 32B | Alibaba | 🇨🇳 CN | Used as **judge only** — excluded from prod (Chinese) |
| qwen2.5-coder:32b | 32B | Alibaba | 🇨🇳 CN | NL→SQL only — weak (2.25) + Chinese → excluded |
| deepseek-r1:32b | 32B | DeepSeek | 🇨🇳 CN | **Failed structured jobs** + slow + Chinese → excluded |
| qwq:32b | 32B | Alibaba | 🇨🇳 CN | **Failed structured jobs** + slow + Chinese → excluded |
| **nomic-embed-text** | ~0.1B | Nomic AI | 🇺🇸 US | ✅ **deployed** — embeddings |
| mxbai-embed-large | ~0.3B | Mixedbread | 🇩🇪 DE | Ties nomic — backup |

**Cloud big-models (OpenRouter, quality comparison only — NOT deployed):**

| Model | Params | Maker | Country | Result |
|---|---|---|---|---|
| gpt-oss-120b | 120B | OpenAI | 🇺🇸 US | Tied/worse, **timed out** on planner |
| llama-3.3-70b | 70B | Meta | 🇺🇸 US | Tied small models, no gain |
| gpt-oss-20b | 20B | OpenAI | 🇺🇸 US | Same as local |
| qwen-2.5-72b | 72B | Alibaba | 🇨🇳 CN | No gain + Chinese |
| deepseek-r1-distill-70b / -32b | 70B/32B | DeepSeek | 🇨🇳 CN | Failed structured jobs |
| phi-4 / mistral-small-3.2 / gemma-3-27b | 14–27B | MS / Mistral / Google | 🇺🇸🇫🇷 | Same as local |

---

## 3. How we tested (plain English)

- Real **Unicharm plant data** (live telemetry + real document manuals), not made-up examples.
- **7 jobs** scored: Planner, Validator, Executor, NL→SQL, RAG, Narration, Embeddings.
- **Two checks per answer:** (1) hard rule (valid JSON / runnable SQL / grounded output) and
  (2) a **judge AI** (`qwen2.5:32b`, same for all) rating quality **1–5**. Pass = 4+.
- Small models on our 20 GB box; big models via cloud (quality only).
- Then a **golden-eval filter** (2026-06-05) inside the real app removed models that score well
  but **break in production** (see §5).

---

## 4. Raw results — who scored best per job

| Job | Raw winner (score) | Notes |
|---|---|---|
| Planner | gemma3:27b (4.0), gpt-oss:20b (3.5) | both later dropped (§5) |
| Validator | phi4 (5.0) — many tie | phi4 kept |
| Executor | qwen2.5:14b (3.5), mistral (3.0) | qwen Chinese → mistral kept |
| NL→SQL | gpt-oss:20b (3.2) — weak field | all weak; mistral + guardrails kept |
| RAG | gpt-oss:20b (4.4) — most tie ~4.4 | phi4 also 4.4 → kept |
| Narration | phi4 / qwen2.5:14b (4.5) | phi4 kept |
| Embeddings | nomic = mxbai (5.0) | nomic kept |

---

## 5. Why the raw winners are NOT deployed (important)

> **These models are NOT "bad."** Most score well and fit our hardware. They're dropped only
> because they either break in our app as configured (fixable) or fail the non-Chinese policy.

| Model | Eval result | Why dropped |
|---|---|---|
| **gpt-oss:20b** | **Good model, and it fits (20B, ~13 GB).** Won Planner / NL→SQL / RAG. | Not bad — just **incompatible with our current setup (fixable).** It's a **reasoning model**: it spends its token budget on a hidden "thinking" channel, so under our token caps (analyze=400) with big RAG prompts it returns an **empty answer** → **failed the golden eval (2026-06-05).** **Can be revisited** once we raise the token budget + add thinking-aware streaming in `llm/ollama.py`. |
| **gemma3:27b** | won Planner (4.0) | **Worst tool-calling (2.0)**, broke agent runs, failed golden eval; 27B also blocks co-residency. |
| **qwen2.5 / coder / deepseek-r1 / qwq** | some scored well | **Chinese-origin — excluded by policy.** (qwen2.5:32b kept *only* as the offline test judge, never deployed.) |

**The fix that's deployed:** **phi4 + mistral-small3.2** answer **directly** (no hidden thinking),
pass the golden eval, are non-Chinese, and fit together on the 48 GB box.

---

## 6. Do we need a bigger (70B/120B) model? — **No.**

| Job | Best small (≤32B) | Best big (70B/120B) | Bigger better? |
|---|---|---|---|
| Planner | gpt-oss-20b 4.0 | llama-70b 3.67 · 120b errored | **No** |
| Validator | phi4 5.0 | llama-70b 5.0 | **No** (maxed) |
| Executor | (mistral 3.0) | qwen-72b 3.33 (slower) | **No** |
| RAG / Narration | 4.4 / 4.5 | 4.4 / 4.5 | Tie |

Bigger models tie at best, run slower, and the 120B timed out. **No hardware upgrade justified.**
Full hardware sizing in [ONPREM_HARDWARE_SIZING.md](ONPREM_HARDWARE_SIZING.md).

---

## 7. Final recommendation

1. **Deploy:** mistral-small3.2 (Planner/Executor/NL→SQL) + phi4 (Validator/Narration/RAG) +
   llama3.2-vision (Vision) + nomic-embed-text (Embeddings). **All non-Chinese.**
2. **Keep the planned 48 GB box** — the 4-model team (~32 GB) fits together; no upgrade.
3. **NL→SQL is the #1 engineering risk** — invest in the SQL validation + retry layer, not a
   bigger model.
4. **Full-depth re-run + vLLM/FP8 latency test** on the 48 GB box for final sign-off.
5. **Revisit gpt-oss** later only with a higher token budget + thinking-aware streaming.

> **Housekeeping:** rotate the OpenRouter API key (pasted in chat during testing); stored
> gitignored at `model-eval/.env.local`.
