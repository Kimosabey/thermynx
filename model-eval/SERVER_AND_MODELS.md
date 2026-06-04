# Server & Models — reference for the model-eval harness

> The LLM server, its hardware limits, the model inventory, and the candidates
> under test. Both this project and OMNYX (Graylinx v2) share **the same Ollama
> server**, so these facts apply to both. OMNYX keeps the deeper write-up in
> `omnyx/docs/reference/MODEL_BENCHMARK.md` (Rounds 1–2 screening) — this file is
> the local copy so the testing harness is self-documenting.

## LLM serving box (current — the test bench)
| | Value |
|---|---|
| Endpoint | `http://100.125.103.28:11434` (Tailscale; OpenAI-compatible at `/v1`) |
| GPU | **NVIDIA RTX 4000 Ada — 20 GB VRAM** (shared with the Windows desktop) |
| System RAM | **32 GB** |
| OS | Windows workstation |
| Serving | Ollama (Q4 GGUF) |

**What fits on this box (Q4 rule-of-thumb):** 14B ≈ 9 GB · 20B ≈ 13 GB · 24–32B ≈
15–19 GB (tight) · 49B-4bit ≈ 28–30 GB (offloads) · 70B ≈ 42 GB (heavy CPU offload,
slow) · **gpt-oss:120B ≈ 65 GB → won't run** (exceeds 32 GB RAM). Two big models
**cannot** stay co-resident here. So this box is for **screening ≤32B models**;
real latency / two-model-resident tests belong on the deploy box.

## On-prem deploy target (future — the real sizing decider)
| | Value |
|---|---|
| GPU | **48 GB VRAM** |
| System RAM | **48 GB** |
| Serving | vLLM @ FP8 (planned) |

On 48 GB a Planner (~20–32B) **plus** a small Validator (phi4 / 14B) fit resident
together; a 49B planner fits with a small validator; 70B fits alone; 120B still
needs offload. **The production model choice must fit 48 GB.**

## Model inventory on the server (20 models, verified via `_probe.py`)
`gpt-oss:20b`, `gpt-oss:120b`, `phi4:latest`, `phi:latest`, `qwen2.5:32b`,
`qwen2.5:14b`, `qwen2.5-coder:32b`, `qwq:32b`, `mistral-small3.2:latest`,
`mistral-small:latest`, `deepseek-r1:32b`, `gemma3:27b`, `nemotron-cascade-2:latest`,
`llama3.3:latest`, `llama3.1:8b`, `llama3.2:latest`, `llama3.2-vision:11b`,
`llama3.2-vision:latest`, `nomic-embed-text:latest`, `mxbai-embed-large:latest`.

## Candidates under test (this harness)
| Model | Params | VRAM (Q4) | Tested as | Notes |
|---|---|---|---|---|
| gpt-oss:20b | 20B | ~13 GB | Planner | anchor; reasoning; fits 20 GB & 48 GB |
| phi4 | 14B | ~9 GB | Validator | independent lineage = good cross-check |
| mistral-small3.2 | 24B | ~15 GB | **Executor** / general | tool-native, fast — front-runner for the executor role |
| qwen2.5:32b | 32B | ~19 GB | Planner alt + **judge** | reliable structured output |
| qwen2.5:14b | 14B | ~9 GB | Validator alt | fast |
| qwen2.5-coder:32b | 32B | ~19 GB | **NL→SQL only** | code-tuned |
| deepseek-r1:32b | 32B | ~19 GB | reasoning | slow (thinking overhead) |
| gemma3:27b | 27B | ~17 GB | general / vision | multimodal |
| llama3.1:8b | 8B | ~5 GB | baseline | this project's current SQL/tool model |
| nomic-embed-text | – | ~0.3 GB | Embeddings (768-dim) | this project's current embedder |
| mxbai-embed-large | – | ~0.7 GB | Embeddings (1024-dim) | stronger-retrieval candidate |

**Judge:** `qwen2.5:32b`, held constant (excluded as a candidate in judged modes
to avoid self-grading).

**Executor role:** now tested as a first-class mode — each candidate runs the app's
real read-only tool registry via native Ollama tool-calling (JSON-mode fallback for
models without native tool support). The eval reveals which candidates are genuinely
tool-native; `mistral-small3.2`, `qwen2.5`, and `llama3.1` are expected to be.

## This project's current (locked) choices — what we're re-evaluating
From `docs/planning/ai/MODEL_SIZING_DECISION.md`: text/narration = `qwen2.5:14b`,
tool-calling = `llama3.1:8b`, NL→SQL = `llama3.1:8b`, auditor = `llama3.2:latest`,
vision = `llama3.2-vision`, embeddings = `nomic-embed-text`. This harness checks
whether those (and OMNYX's gpt-oss:20b + phi4 pick) still hold on **real data**.

## Evaluation method (agreed)
- **Round 1–2 — screening on Ollama (Q4)** on the 20 GB box: cut unreliable models,
  prove the harness. Latency here is offload-skewed, **not** a deploy figure.
- **Round 3 — final on vLLM @ FP8** on 48 GB: the survivors, real prompts, real
  latency, two-model-resident. The production sign-off.
