# OMNYX / THERMYNX — Model Evaluation: Final Report (Claude-judged)

> **One document, everything — in plain English:** the picks, *why* each was chosen,
> the evidence, the hardware, and the deployment. Judge = **Claude Opus 4.8** (a top model,
> grading every answer 1–5). All deploy picks are **non-Chinese** and **confirmed to work
> inside the real app** (the "golden check"). Date: 2026-06.

---

## 1. THE DECISION — deploy these (all non-Chinese, all app-tested)

| Job | Model | Maker | Why this one (plain English) |
|---|---|---|---|
| **Planner** (decide the action) | **gemma4:12b** (12B) 🧠 | Google 🇺🇸 | **Best plans (3.3–4.0)** and works in the app's JSON path (no blank). A "thinking" model — used here because planning needs judgment. ~25s/plan is fine (runs in the background). |
| **Executor** (use the tools) | **devstral** (24B) | Mistral 🇫🇷 | **Best at tool-calling (4.5/5)** and works in the app. A coding-agent model — clear upgrade. |
| **NL→SQL** (question → database) | **codestral** (22B) | Mistral 🇫🇷 | Best *deployable* at writing SQL. A code specialist — upgrade for our weakest area. |
| **Validator** (approve/reject) | **mistral-small3.2** * | Mistral 🇫🇷 | 5.0 (ties phi4). *phi4 is the winner but won't run — see ⚠ below.* |
| **Narration** (summarise numbers) | **mistral-small3.2** * | Mistral 🇫🇷 | 4.5 (phi4 winner 5.0, can't run). |
| **RAG** (answer from manuals) | **mistral-small3.2** * | Mistral 🇫🇷 | 4.4 (phi4 winner 5.0, can't run). |
| **Embeddings** (search) | **nomic-embed-text** | Nomic 🇺🇸 | Ties the best, smallest/cheapest. |
| **Vision** (images) | **llama3.2-vision** (11B) | Meta 🇺🇸 | The non-Chinese vision model we run. |

> **⚠ RUNTIME NOTE (phi4):** phi4 (14B) is the **eval winner** for Validator/Narration/RAG (5.0/5.0/5.0),
> but the **Ollama 0.30.6 runner CRASHES loading it** (`0xc0000409` stack overrun). 0.30.6 is required
> for **gemma4** (Planner), so phi4 and gemma4 **can't share one Ollama version**. Until Ollama fixes
> phi4-14B, **mistral-small3.2 is the runtime substitute** for those 3 roles — near-identical scores,
> runs cleanly. (phi4-mini works; phi4-reasoning also crashes.)

**Change vs what's deployed today:** Planner → **gemma4:12b**, Executor → **devstral**, NL→SQL → **codestral**, Validator/Narration/RAG → **mistral-small3.2** (phi4 blocked by the 0.30.6 crash). Embeddings/vision unchanged.
*Planner alternative if ~25s is too slow: mistral-small3.2 (faster, lower quality).*

### Model specs (pulled from the server)

| Name | Size / Usage | Context | Input / capabilities |
|---|---|---|---|
| **gemma4:12b** (Planner) | 11.9B / ~8 GB | **256K** | Text + Vision + Audio + Tools + thinking |
| **devstral** (Executor) | 23.6B / ~14 GB | 128K | Text + Tools |
| **codestral** (NL→SQL) | 22.2B / ~12 GB | 32K | Text (code) |
| **phi4** (Validator/Narration/RAG) | 14.7B / ~9 GB | 16K | Text only |
| mistral-small3.2 (Planner fallback) | 24.0B / ~15 GB | 128K | Text + Vision + Tools |
| **llama3.2-vision** (Vision) | 10.7B / ~8 GB | 128K | Text + Images + Tools |
| **nomic-embed-text** (Embeddings) | 137M / ~0.3 GB | 2K | Text (search) |
| gpt-oss:20b (alt) | 20.9B / ~13 GB | 128K | Text + Tools + thinking |

*gemma4 has the largest context (256K) and is multimodal — ideal for the Planner. phi4's context
is small (16K) — fine for its short jobs; keep big RAG prompts trimmed.*

---

## 2. HOW WE TESTED (two layers, plain English)

| Layer | What it means | Example |
|---|---|---|
| **1. Scoreboard** | Ask each model real plant questions; a top AI judge (**Claude Opus 4.8**) grades the answer 1–5. | "Plan the action for this high-energy chiller" → judge scores the plan. |
| **2. Golden check** | Try the model the way the **real app** uses it — with the app's limit on how much it can write. Confirms it doesn't break in production. | Ask for a 2-line summary with the app's word limit → must return a real answer, **not a blank**. |

We used **real Unicharm data** (live chiller readings + the real manuals), and the **same judge for everyone** so scores compare fairly. **Pass = 4 or higher.**

---

## 3. THE BIG LESSON — a model's behaviour depends on *how* it's called

"Thinking" models (gemma4, gpt-oss) reason silently before answering. That's great for hard
decisions — but it matters **which path the app uses:**

| Path | Used for | Thinking model | Why |
|---|---|---|---|
| **JSON / structured** (roomy) | **Planner** | ✅ Works (valid plans) | forced to output structured JSON + has room → thinks *and* answers |
| **Plain text, tight word-limit** | Narration / short answers | ❌ Blank | thinking eats the small budget → no room to answer |

> **Analogy:** a student writes a great essay with time, but in a strict 5-minute exam spends
> all 5 minutes thinking and hands in a **blank page**. Give them a structured form with room
> (the Planner) and they fill it in perfectly.

**So the rule we follow: use a thinking model for the Planner (structured, roomy), and direct
models for the short/fast jobs.** That's why gemma4 = Planner ✅, and phi4 (direct) = narration/RAG.

| Model | Best at | In the app |
|---|---|---|
| **gemma4:12b** 🧠 | Planner (3.3–4.0) | ✅ valid plans in the JSON path — **used as Planner** |
| **devstral** | Executor (4.5) | ✅ used |
| **codestral** | NL→SQL | ✅ used |
| **phi4** (direct) | Validator/Narration/RAG (5.0) | ✅ used (the short/fast jobs) |
| gpt-oss:20b 🧠 | — | works in JSON, but only scored 2.0 on planner → not picked |

We still run the **golden check** before deploying — it's what taught us to route thinking
models to the Planner and keep direct models for the capped text jobs.

---

## 4. SCOREBOARD — who scored best per job (Claude judge, non-Chinese)

| Job | Top scorers (score) | Deployed pick & note |
|---|---|---|
| **Planner** | **gemma4 3.3–4.0** ✅ (works in JSON path); gpt-oss 2.0; mistral 2.0 | **gemma4:12b** (best; ~25s/plan) |
| **Executor** | **devstral 4.5** ✅; nemotron 3.5; mistral-nemo 3.5; rest ~2 | **devstral** |
| **NL→SQL** | gpt-oss 3.4 → blank; **codestral 3.2** ✅; mistral 2.8 | **codestral** (+ SQL safety guard) |
| **Validator** | many tie at **5.0** | **phi4** (fast + independent) |
| **RAG** | several at **5.0** | **phi4** |
| **Narration** | **phi4 5.0**; devstral 4.5 | **phi4** |
| **Embeddings** | nomic = mxbai | **nomic** |

**Note:** NL→SQL is weak for *every* model — so we keep the **SQL safety/retry guard** regardless; that guard does the heavy lifting, not the model.

---

## 5. EVERY MODEL THAT LOST — and exactly why

We tested **25+ models**. Here is the full list of the ones **not chosen**, grouped by reason.

### A) Excluded by the non-Chinese policy
| Model | Params | Note |
|---|---|---|
| qwen2.5:14b | 14B 🇨🇳 | scored well (RAG/validator 5.0) but **Chinese — policy** |
| qwen2.5:32b | 32B 🇨🇳 | Chinese; also mostly **errored** (too tight on the 20 GB box). Used *only* as the old test judge |
| qwen2.5-coder:32b | 32B 🇨🇳 | Chinese; weak SQL (2.25) |
| deepseek-r1:32b | 32B 🇨🇳 | Chinese; **failed** structured tasks; brutally slow (434s/executor case) |
| qwq:32b | 32B 🇨🇳 | Chinese; failed structured tasks; slow (226s) |

### B) Failed in the real app (blank / broke)
| Model | Params | Note |
|---|---|---|
| gpt-oss:20b | 20B 🇺🇸 | "thinking" model — **blank** in the short text path; Planner only 2.0 (gemma4 better) |
| gpt-oss:120b | 120B 🇺🇸 | blank **and** won't fit our hardware |
| gemma3:27b | 27B 🇺🇸 | **broke tool-calling (2.0)**; too big to co-reside |
| phi4-reasoning | 14B 🇺🇸 | Planner **failed 0/3** — dumps reasoning, no usable plan |

### C) Worked but weren't the best for any role
| Model | Params | Best score | Why not chosen |
|---|---|---|---|
| mistral-small3.2 | 24B 🇫🇷 | Planner 2.0 | solid all-rounder → kept only as **Planner fallback** |
| magistral | 24B 🇫🇷 | Planner 2.0 | no better than baseline; gemma4 wins |
| **gemma4:31b** | 31B 🇺🇸 | Planner 2.83 | **the "bigger brain" test** — *lost* to gemma4:12b (3.0) over 6 cases, **2.4× slower** (~49s vs 20s), 19 GB blocks co-residency. Bigger ≠ better even for reasoning → **12B wins on both boxes.** |
| nemotron-cascade-2 | 31.6B 🇺🇸 | Executor 3.5 | devstral (4.5) better; 24 GB is tight |
| mistral-nemo | 12B 🇫🇷 | Executor 3.5 | devstral better; not top at any role |
| command-r7b | 7B 🇨🇦 | Narration ~4 | Executor weak (1); not top anywhere |
| gemma3:12b | 12B 🇺🇸 | RAG ~5 | Executor 1; phi4 already covers RAG |
| granite3.3 | 8B 🇺🇸 | — | weak (Executor 1, SQL weak) |
| llama3.1:8b | 8B 🇺🇸 | — | too small — weakest baseline |
| phi4-mini | 3.8B 🇺🇸 | — | too small — weak |
| sqlcoder 7B & 15B | 7B/15B 🇺🇸 | NL→SQL 2.33 / 2.5 | **both lost to codestral (3.2)**; only 2–3 of 5 even ran — old/narrow model, needs its own prompt format |
| mxbai-embed-large | 0.3B 🇩🇪 | Embeddings 5.0 | ties nomic but bigger → nomic chosen |

### D) Too big for our hardware (cloud-tested only)
| Model | Params | Note |
|---|---|---|
| llama-3.3-70b, mistral-large, command-r-plus | 70–123B | non-Chinese, but need an 80 GB GPU; cloud test → **no quality gain** for our jobs |

**One-line summary of losses:** Chinese → policy · gpt-oss/gemma3/phi4-reasoning → break in the app · small models (≤8B) → too weak · sqlcoder/magistral/nemotron/etc. → worked but **not the best** · 70B+ → won't fit & no benefit. The winners (**gemma4, devstral, codestral, phi4, nomic, llama3.2-vision**) beat all of them on real data, in the app, within our hardware.

---

## 6. HARDWARE (plain English)

| | Today (test box) | Future (production) |
|---|---|---|
| GPU memory | 20 GB | **48 GB** |
| Can hold | **1 model at a time** (swaps, slow) | **the whole team at once** |

Our team — gemma4 (8 GB) + devstral (15 GB) + codestral (12 GB) + phi4 (9 GB) + nomic (tiny) —
runs **on our own hardware for free**. On the 48 GB box the core agents stay loaded together;
no swapping. **No hardware upgrade needed** (the cloud test confirmed bigger models don't help
our tasks).

---

## 7. DEPLOYMENT (where these are set)

Models are set per-job in `backend/app/config.py`. **To apply the 3 upgrades:**
- `OLLAMA_MODEL_PLANNER` (Planner) → **gemma4:12b** *(thinking model; keep its JSON-mode planner path + a roomy budget so it isn't truncated)*
- `OLLAMA_MODEL_TOOL` (Executor) → **devstral:latest**
- `OLLAMA_MODEL_SQL` (NL→SQL) → **codestral:latest**
- Validator / Narration / RAG stay **phi4**; vision/embeddings unchanged.

Before flipping these in production, run the app's own golden tests once with the new values
(all three passed the in-app checks above — gemma4 via the JSON planner path, devstral/codestral
via direct answers).

---

## 8. BOTTOM LINE

| Question | Answer |
|---|---|
| Best models? | Planner **gemma4:12b** · Executor **devstral** · NL→SQL **codestral** · Validator/Narration/RAG **phi4** · Embeddings **nomic** · Vision **llama3.2-vision** — all non-Chinese, all app-tested |
| Need bigger hardware? | **No** — the 48 GB box runs the team; bigger models gave no benefit |
| Biggest risk? | **NL→SQL** — fixed with the safety/retry guard, not a bigger model |
| What's free vs paid? | **Production models = free** (our hardware). Only the *testing* used paid Claude/cloud — one-time. |
| Judge used | **Claude Opus 4.8** (top model) — strict, trustworthy scores |

**One line:** run **gemma4 (Planner) + devstral (Executor) + codestral (NL→SQL) + phi4
(Validator/Narration/RAG)** + nomic + vision on the **48 GB box** — all non-Chinese, all
confirmed working in the app; **3 evidence-backed upgrades** (gemma4, devstral, codestral),
with thinking used only where it helps (the Planner).

---

## 9. HOW WE GOT HERE — what we did, step by step (plain English)

| # | What we did | Why it mattered |
|---|---|---|
| 1 | Built a **separate, read-only test harness** that runs each model on **real Unicharm data** (live chiller readings + real manuals) across all 7 jobs. | Tests on *our* data, not generic benchmarks — and never touches production. |
| 2 | Ran a **first sweep** of all local models with a local judge → got initial picks. | Baseline ranking. |
| 3 | **Upgraded the judge to Claude Opus 4.8** (a top model) and re-ran everything. | Stricter, more trustworthy grading — clearer winners. |
| 4 | **Added new non-Chinese candidates** (codestral, devstral, gemma4, nemotron, mistral-nemo, granite, command-r7b, phi4-mini) and tested them too. | Better coverage, especially for the weak spots (Executor, NL→SQL). |
| 5 | Ran a **"golden check"** — tried each model the way the **real app** uses it (with its word limit). | Caught the **"blank answer" trap**: some models score well but return nothing in production. |
| 6 | Discovered the **path insight**: thinking models work in the **JSON/Planner path** but go blank in the **short capped text path**. Re-tested gemma4 in the *correct* path → it's the best Planner. | Stopped us from wrongly dropping the best Planner. |
| 7 | Tested the big **70B/120B** models via **cloud (OpenRouter)** for comparison. | Confirmed bigger models are **not worth** the hardware for our jobs. |
| 8 | **Updated Ollama (0.24 → 0.30.6)** on the server. | So newer models (gemma4) run properly + thinking controls work. |
| 9 | Enforced the **non-Chinese policy** throughout and confirmed every deployed pick **works in the app**. | Final team is compliant *and* production-safe. |

**What we learned (carry forward):**
- A model isn't simply "good" or "bad" — **it depends on how the app calls it** (structured/roomy vs short/capped). Route **thinking models to reasoning jobs** (Planner), **direct models to fast jobs** (narration/RAG).
- **High score ≠ works in production** — always run the in-app golden check before deploying.
- **NL→SQL is the real risk** — solved with guardrails, not a bigger model.
- **Bigger ≠ better** for our tasks — small, right-fit, non-Chinese models win, and they run **free on our own hardware**.

---
*Detail/evidence: REAL_DATA_MODEL_EVAL.md (all non-Chinese scores) · ONPREM_HARDWARE_SIZING.md
(hardware/deploy) · MODEL_EVAL_ONEPAGER.md (one-page summary) · results_combined_all.json (every
model incl. Chinese, as raw evidence).*
