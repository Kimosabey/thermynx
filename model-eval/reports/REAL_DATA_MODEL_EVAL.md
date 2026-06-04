# OMNYX Real-Data Model Evaluation

> Run: 2026-06-03T14:51:38.469557+00:00 · judge = `qwen2.5:32b` · scores 1-5, pass = score≥4 (or all-correct for validator/embeddings).
> Source: real Unicharm MySQL + pgvector corpus (read-only). See README.md for why.

## planner
| Model | pass-rate | avg score | avg latency (s) | ok/n |
|---|---|---|---|---|
| gemma3:27b | 100% | 4.0 | 16.2 | 2/2 |
| qwq:32b | 100% | 4.0 | 28.1 | 2/2 |
| gpt-oss:20b | 50% | 3.5 | 11.7 | 2/2 |
| qwen2.5:14b | 50% | 3.5 | 14.8 | 2/2 |
| qwen2.5:32b * | 50% | 3.5 | 24.6 | 2/2 |
| llama3.1:8b | 0% | 3.0 | 10.9 | 2/2 |
| phi4:latest | 0% | 3.0 | 11.7 | 2/2 |
| mistral-small3.2:latest | 0% | 3.0 | 14.0 | 2/2 |
| deepseek-r1:32b | 0% | 3.0 | 75.0 | 2/2 |

## validator
| Model | pass-rate | avg score | avg latency (s) | ok/n |
|---|---|---|---|---|
| llama3.1:8b | 100% | 5.0 | 21.3 | 1/1 |
| phi4:latest | 100% | 5.0 | 23.7 | 1/1 |
| qwen2.5:14b | 100% | 5.0 | 23.8 | 1/1 |
| mistral-small3.2:latest | 100% | 5.0 | 25.6 | 1/1 |
| gpt-oss:20b | 100% | 5.0 | 28.2 | 1/1 |
| gemma3:27b | 100% | 5.0 | 28.7 | 1/1 |
| qwen2.5:32b | 100% | 5.0 | 42.0 | 1/1 |
| qwq:32b | 100% | 5.0 | 47.5 | 1/1 |
| deepseek-r1:32b | 0% | 2.5 | 141.0 | 1/1 |

## executor
| Model | pass-rate | avg score | avg latency (s) | ok/n |
|---|---|---|---|---|
| qwen2.5:14b | 50% | 3.5 | 38.1 | 2/2 |
| gpt-oss:20b | 50% | 3.0 | 60.0 | 2/2 |
| mistral-small3.2:latest | 50% | 3.0 | 72.7 | 2/2 |
| qwen2.5:32b * | 50% | 3.0 | 149.6 | 2/2 |
| phi4:latest | 0% | 3.0 | 54.2 | 2/2 |
| llama3.1:8b | 0% | 2.5 | 47.1 | 2/2 |
| qwq:32b | 0% | 2.5 | 225.8 | 2/2 |
| gemma3:27b | 0% | 2.0 | 78.8 | 2/2 |
| deepseek-r1:32b | 0% | 1.5 | 434.1 | 2/2 |

## nl_to_sql
| Model | pass-rate | avg score | avg latency (s) | ok/n |
|---|---|---|---|---|
| gpt-oss:20b | 60% | 3.2 | - | 5/5 |
| mistral-small3.2:latest | 40% | 2.8 | - | 5/5 |
| qwen2.5:14b | 20% | 2.6 | - | 4/5 |
| llama3.1:8b | 20% | 2.5 | - | 4/5 |
| qwen2.5:32b * | 20% | 2.5 | - | 4/5 |
| gemma3:27b | 20% | 2.4 | 0.1 | 4/5 |
| qwen2.5-coder:32b | 0% | 2.25 | - | 4/5 |
| phi4:latest | 0% | 2.0 | - | 4/5 |
| deepseek-r1:32b | 0% | 0.0 | - | 0/5 |
| qwq:32b | 0% | 0.0 | - | 0/5 |

## rag_qa
| Model | pass-rate | avg score | avg latency (s) | ok/n |
|---|---|---|---|---|
| gpt-oss:20b | 100% | 4.4 | 11.7 | 5/5 |
| phi4:latest | 100% | 4.4 | 12.3 | 5/5 |
| mistral-small3.2:latest | 100% | 4.4 | 14.3 | 5/5 |
| gemma3:27b | 100% | 4.4 | 14.5 | 5/5 |
| qwen2.5:14b | 100% | 4.4 | 14.6 | 5/5 |
| qwen2.5:32b * | 100% | 4.4 | 28.8 | 5/5 |
| qwq:32b | 100% | 4.4 | 84.9 | 5/5 |
| llama3.1:8b | 100% | 4.2 | 6.0 | 5/5 |
| deepseek-r1:32b | 80% | 4.4 | 76.5 | 5/5 |

## narration
| Model | pass-rate | avg score | avg latency (s) | ok/n |
|---|---|---|---|---|
| phi4:latest | 100% | 4.5 | 12.5 | 2/2 |
| mistral-small3.2:latest | 100% | 4.5 | 14.3 | 2/2 |
| qwen2.5:14b | 100% | 4.5 | 14.4 | 2/2 |
| gemma3:27b | 100% | 4.5 | 17.9 | 2/2 |
| qwen2.5:32b * | 100% | 4.5 | 26.9 | 2/2 |
| gpt-oss:20b | 100% | 4.0 | 15.1 | 2/2 |
| qwq:32b | 100% | 4.0 | 59.8 | 2/2 |
| deepseek-r1:32b | 100% | 5.0 | - | 0/2 |
| llama3.1:8b | 0% | 3.0 | 9.6 | 2/2 |

## embeddings
| Model | pass-rate | avg score | avg latency (s) | ok/n |
|---|---|---|---|---|
| nomic-embed-text | 100% | 5.0 | - | 1/1 |
| mxbai-embed-large | 100% | 5.0 | - | 1/1 |

\* judge == candidate (self-graded; may be optimistic).

## Fit verdict (auto-derived)

| Role | Best fit | Avoid (bad fit) — why |
|---|---|---|
| Planner | gemma3:27b (4.0, 100%) | llama3.1:8b (0% pass); phi4:latest (0% pass); mistral-small3.2:latest (0% pass); deepseek-r1:32b (0% pass) |
| Validator | llama3.1:8b (5.0, 100%) | deepseek-r1:32b (0% pass, 141s/case) |
| Executor | qwen2.5:14b (3.5, 50%) | qwen2.5:32b (150s/case); phi4:latest (0% pass); llama3.1:8b (0% pass); qwq:32b (0% pass, 226s/case); gemma3:27b (0% pass, score 2.0); deepseek-r1:32b (0% pass, score 1.5, 434s/case) |
| NL→SQL | gpt-oss:20b (3.2, 60%) | qwen2.5:14b (errored 4/5); llama3.1:8b (errored 4/5); qwen2.5:32b (errored 4/5); gemma3:27b (errored 4/5, score 2.4); qwen2.5-coder:32b (errored 4/5, 0% pass, score 2.25); phi4:latest (errored 4/5, 0% pass, score 2.0); deepseek-r1:32b (errored 0/5, 0% pass, score 0.0); qwq:32b (errored 0/5, 0% pass, score 0.0) |
| RAG answerer | gpt-oss:20b (4.4, 100%) | — |
| Narration | phi4:latest (4.5, 100%) | deepseek-r1:32b (errored 0/2); llama3.1:8b (0% pass) |
| Embeddings | nomic-embed-text (5.0, 100%) | — |

> Best fit = highest pass-rate among models that ran every case (ok=n). Bad fit = 0% pass, avg score <2.5, any errored case, or >120s/case.

## Per-role recommendation (from this run)

| Role | Best on real data |
|---|---|
| Planner | gemma3:27b |
| Validator | llama3.1:8b |
| Executor | qwen2.5:14b |
| NL→SQL | gpt-oss:20b |
| RAG answerer | gpt-oss:20b |
| Narration | phi4:latest |
| Embeddings | nomic-embed-text |

> Cross-check vs the synthetic Round-2 verdict (gpt-oss:20b Planner + phi4 Validator): see whether real-data results confirm or revise it. Final sign-off remains the Round-3 vLLM/FP8 run on 48 GB hardware.
