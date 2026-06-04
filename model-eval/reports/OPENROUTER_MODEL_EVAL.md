# OMNYX Real-Data Model Evaluation

> Run: 2026-06-03T18:17:46.407879+00:00 · judge = `qwen2.5:32b` · scores 1-5, pass = score≥4 (or all-correct for validator/embeddings).
> Source: real Unicharm MySQL + pgvector corpus (read-only). See README.md for why.

## planner
| Model | pass-rate | avg score | avg latency (s) | ok/n |
|---|---|---|---|---|
| openai/gpt-oss-20b | 100% | 4.0 | 2.9 | 3/3 |
| google/gemma-3-27b-it | 100% | 4.0 | 3.1 | 3/3 |
| meta-llama/llama-3.3-70b-instruct | 67% | 3.67 | 2.0 | 3/3 |
| openai/gpt-oss-120b | 67% | 4.0 | 25.6 | 2/3 |
| microsoft/phi-4 | 0% | 3.0 | 2.0 | 3/3 |
| mistralai/mistral-small-3.2-24b-instruct | 0% | 3.0 | 2.7 | 3/3 |
| qwen/qwen-2.5-72b-instruct | 0% | 3.0 | 5.2 | 3/3 |
| deepseek/deepseek-r1-distill-qwen-32b | 0% | 0.0 | - | 0/3 |
| deepseek/deepseek-r1-distill-llama-70b | 0% | 0.0 | - | 0/3 |

## validator
| Model | pass-rate | avg score | avg latency (s) | ok/n |
|---|---|---|---|---|
| microsoft/phi-4 | 100% | 5.0 | 2.8 | 1/1 |
| mistralai/mistral-small-3.2-24b-instruct | 100% | 5.0 | 2.8 | 1/1 |
| meta-llama/llama-3.3-70b-instruct | 100% | 5.0 | 3.5 | 1/1 |
| openai/gpt-oss-20b | 100% | 5.0 | 9.5 | 1/1 |
| qwen/qwen-2.5-72b-instruct | 100% | 5.0 | 11.0 | 1/1 |
| openai/gpt-oss-120b | 100% | 5.0 | 41.1 | 1/1 |
| google/gemma-3-27b-it | 0% | 1.0 | - | 0/1 |
| deepseek/deepseek-r1-distill-qwen-32b | 0% | 1.0 | - | 0/1 |
| deepseek/deepseek-r1-distill-llama-70b | 0% | 1.0 | - | 0/1 |

## executor
| Model | pass-rate | avg score | avg latency (s) | ok/n |
|---|---|---|---|---|
| qwen/qwen-2.5-72b-instruct | 33% | 3.33 | 25.6 | 3/3 |
| mistralai/mistral-small-3.2-24b-instruct | 33% | 3.33 | 181.8 | 3/3 |
| meta-llama/llama-3.3-70b-instruct | 0% | 2.33 | 8.8 | 3/3 |
| openai/gpt-oss-20b | 0% | 2.33 | 14.7 | 3/3 |
| openai/gpt-oss-120b | 0% | 2.33 | 45.0 | 3/3 |
| microsoft/phi-4 | 0% | 1.67 | 8.3 | 3/3 |
| google/gemma-3-27b-it | 0% | 2.0 | 37.0 | 1/3 |
| deepseek/deepseek-r1-distill-llama-70b | 0% | 1.0 | 19.4 | 1/3 |
| deepseek/deepseek-r1-distill-qwen-32b | 0% | 0.0 | - | 0/3 |

## rag_qa
| Model | pass-rate | avg score | avg latency (s) | ok/n |
|---|---|---|---|---|
| openai/gpt-oss-20b | 100% | 4.5 | 9.4 | 10/10 |
| meta-llama/llama-3.3-70b-instruct | 100% | 4.4 | 4.5 | 10/10 |
| mistralai/mistral-small-3.2-24b-instruct | 100% | 4.4 | 5.6 | 10/10 |
| deepseek/deepseek-r1-distill-llama-70b | 100% | 4.4 | 10.0 | 10/10 |
| google/gemma-3-27b-it | 100% | 4.3 | 4.7 | 10/10 |
| openai/gpt-oss-120b | 90% | 4.4 | 14.1 | 10/10 |
| qwen/qwen-2.5-72b-instruct | 80% | 4.25 | 3.8 | 4/5 |
| microsoft/phi-4 | 60% | 4.1 | 3.9 | 10/10 |
| deepseek/deepseek-r1-distill-qwen-32b | 29% | 3.86 | 36.4 | 7/7 |

## narration
| Model | pass-rate | avg score | avg latency (s) | ok/n |
|---|---|---|---|---|
| meta-llama/llama-3.3-70b-instruct | 100% | 4.5 | 2.8 | 2/2 |
| google/gemma-3-27b-it | 100% | 4.5 | 5.2 | 2/2 |
| mistralai/mistral-small-3.2-24b-instruct | 100% | 4.0 | 1.8 | 2/2 |
| microsoft/phi-4 | 100% | 4.0 | 2.8 | 2/2 |
| openai/gpt-oss-20b | 100% | 4.0 | 3.4 | 2/2 |
| openai/gpt-oss-120b | 100% | 4.0 | 4.0 | 2/2 |
| deepseek/deepseek-r1-distill-llama-70b | 100% | 4.5 | 8.0 | 1/2 |
| qwen/qwen-2.5-72b-instruct | 50% | 4.0 | 3.8 | 2/2 |
| deepseek/deepseek-r1-distill-qwen-32b | 0% | 0.0 | - | 0/2 |

\* judge == candidate (self-graded; may be optimistic).

## Fit verdict (auto-derived)

| Role | Best fit | Avoid (bad fit) — why |
|---|---|---|
| Planner | openai/gpt-oss-20b (4.0, 100%) | openai/gpt-oss-120b (errored 2/3); microsoft/phi-4 (0% pass); mistralai/mistral-small-3.2-24b-instruct (0% pass); qwen/qwen-2.5-72b-instruct (0% pass); deepseek/deepseek-r1-distill-qwen-32b (errored 0/3, 0% pass, score 0.0); deepseek/deepseek-r1-distill-llama-70b (errored 0/3, 0% pass, score 0.0) |
| Validator | microsoft/phi-4 (5.0, 100%) | google/gemma-3-27b-it (errored 0/1, 0% pass, score 1.0); deepseek/deepseek-r1-distill-qwen-32b (errored 0/1, 0% pass, score 1.0); deepseek/deepseek-r1-distill-llama-70b (errored 0/1, 0% pass, score 1.0) |
| Executor | qwen/qwen-2.5-72b-instruct (3.33, 33%) | mistralai/mistral-small-3.2-24b-instruct (182s/case); meta-llama/llama-3.3-70b-instruct (0% pass, score 2.33); openai/gpt-oss-20b (0% pass, score 2.33); openai/gpt-oss-120b (0% pass, score 2.33); microsoft/phi-4 (0% pass, score 1.67); google/gemma-3-27b-it (errored 1/3, 0% pass, score 2.0); deepseek/deepseek-r1-distill-llama-70b (errored 1/3, 0% pass, score 1.0); deepseek/deepseek-r1-distill-qwen-32b (errored 0/3, 0% pass, score 0.0) |
| NL→SQL | — (mode skipped) | — |
| RAG answerer | openai/gpt-oss-20b (4.5, 100%) | qwen/qwen-2.5-72b-instruct (errored 4/5) |
| Narration | meta-llama/llama-3.3-70b-instruct (4.5, 100%) | deepseek/deepseek-r1-distill-llama-70b (errored 1/2); deepseek/deepseek-r1-distill-qwen-32b (errored 0/2, 0% pass, score 0.0) |
| Embeddings | — (mode skipped) | — |

> Best fit = highest pass-rate among models that ran every case (ok=n). Bad fit = 0% pass, avg score <2.5, any errored case, or >120s/case.

## Per-role recommendation (from this run)

| Role | Best on real data |
|---|---|
| Planner | openai/gpt-oss-20b |
| Validator | microsoft/phi-4 |
| Executor | qwen/qwen-2.5-72b-instruct |
| NL→SQL | — (mode skipped) |
| RAG answerer | openai/gpt-oss-20b |
| Narration | meta-llama/llama-3.3-70b-instruct |
| Embeddings | — (mode skipped) |

> Cross-check vs the synthetic Round-2 verdict (gpt-oss:20b Planner + phi4 Validator): see whether real-data results confirm or revise it. Final sign-off remains the Round-3 vLLM/FP8 run on 48 GB hardware.
