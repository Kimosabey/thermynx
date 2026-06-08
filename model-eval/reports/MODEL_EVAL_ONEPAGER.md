# OMNYX / THERMYNX — Model Pick (One-Pager)

> Real Unicharm data · Judge = **Claude Opus 4.8** · all picks **non-Chinese** & **app-confirmed** · 2026-06

## ✅ Final team — use these

| Role | Model | Params | Maker | Type | Why |
|---|---|---|---|---|---|
| **Planner** | **gemma4:12b** | 12B | Google 🇺🇸 | 🧠 thinking | Best plans (4.0); works in JSON path; ~25s OK (background step) |
| **Executor** | **devstral** | 24B | Mistral 🇫🇷 | ⚡ direct | Best tool-calling (4.5) |
| **NL→SQL** | **codestral** | 22B | Mistral 🇫🇷 | ⚡ direct | Best deployable SQL (+ guardrails) |
| **Validator** | **phi4** | 14B | Microsoft 🇺🇸 | ⚡ direct | 5.0, fast, independent |
| **Narration** | **phi4** | 14B | Microsoft 🇺🇸 | ⚡ direct | 5.0 |
| **RAG** | **phi4** | 14B | Microsoft 🇺🇸 | ⚡ direct | 5.0, grounded |
| **Embeddings** | **nomic-embed-text** | 0.1B | Nomic 🇺🇸 | — | ties best, smallest |
| **Vision** | **llama3.2-vision** | 11B | Meta 🇺🇸 | — | non-Chinese vision |

*Planner alternatives if 25s is too slow: gpt-oss:20b (3.0, ~13s) or mistral-small3.2 (2.0, ~14s).*

## 📐 Model specs (from the server)

| Name | Size / Usage | Context | Input / capabilities |
|---|---|---|---|
| **gemma4:12b** (Planner) | 11.9B / ~8 GB | **256K** | Text + Vision + Audio + Tools + **thinking** |
| **devstral** (Executor) | 23.6B / ~14 GB | 128K | Text + **Tools** |
| **codestral** (NL→SQL) | 22.2B / ~12 GB | 32K | Text (code) |
| **phi4** (Validator/Narration/RAG) | 14.7B / ~9 GB | 16K | Text only |
| mistral-small3.2 (Planner fallback) | 24.0B / ~15 GB | 128K | Text + Vision + Tools |
| **llama3.2-vision** (Vision) | 10.7B / ~8 GB | 128K | Text + **Images** + Tools |
| **nomic-embed-text** (Embeddings) | 137M / ~0.3 GB | 2K | Text (search) |
| gpt-oss:20b (alt) | 20.9B / ~13 GB | 128K | Text + Tools + thinking |

*Notes: gemma4 has the biggest context (256K) + is multimodal — great for the Planner. phi4's
context is small (16K) — fine for its short jobs (validate/narrate), keep big RAG prompts trimmed.*

## 🧠 Thinking model only where it helps

| Use thinking | Use direct (fast) |
|---|---|
| **Planner** (real judgment, JSON output, background) | Executor, NL→SQL, RAG, Narration, Validator |

## 📊 Scores (Claude judge, /5, best per role)

| Role | Winner | Score | Runner-up |
|---|---|---|---|
| Planner | gemma4:12b | 4.0 | gpt-oss 3.0 |
| Executor | devstral | 4.5 | nemotron / mistral-nemo 3.5 |
| NL→SQL | codestral | 3.2 | mistral-small3.2 2.8 |
| Validator | phi4 | 5.0 | (8-way tie) |
| RAG | phi4 | 5.0 | many tie |
| Narration | phi4 | 5.0 | devstral 4.5 |

## ❌ Excluded — why

| Model(s) | Reason |
|---|---|
| qwen, deepseek, qwq | Chinese — policy |
| gemma3:27b | broke tool-calling; too big to co-reside |
| 70B / 120B (cloud-tested) | won't fit our hardware; no quality gain |
| phi4-reasoning / magistral / sqlcoder 7B & 15B | tested as challengers (Planner / NL→SQL) — **none beat gemma4 / codestral** |
| *(note)* gpt-oss/gemma4 only go blank on the **text/narration** path, **not** Planner — so gemma4 is fine as Planner | — |

## 💻 Hardware

| | Value |
|---|---|
| Today (test) | 20 GB GPU — 1 model at a time |
| Production | **48 GB GPU** — whole team loaded together |
| Upgrade needed? | **No** — team fits; bigger models gave no benefit |
| Cost | Deployed models **free** (own hardware); only testing used paid Claude/cloud |

## 🚀 Deploy (in `backend/app/config.py`)

| Setting | Value |
|---|---|
| `OLLAMA_MODEL_PLANNER` | gemma4:12b ⬆ |
| `OLLAMA_MODEL_TOOL` (Executor) | devstral ⬆ |
| `OLLAMA_MODEL_SQL` | codestral ⬆ |
| `OLLAMA_AUDITOR_MODEL` / `OLLAMA_MODEL_TEXT` / RAG | phi4 |
| `OLLAMA_VISION_MODEL` | llama3.2-vision |
| Embeddings | nomic-embed-text |

**One line:** Planner **gemma4:12b** · Executor **devstral** · NL→SQL **codestral** · Validator/Narration/RAG **phi4** · Embeddings **nomic** · Vision **llama3.2-vision** — all non-Chinese, all confirmed working in the app, on the 48 GB box, no upgrade needed.
