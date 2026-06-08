# OMNYX Real-Data Model Evaluation

> Run: 2026-06-08T10:15:08.871224+00:00 · judge = `claude-opus-4-8` · scores 1-5, pass = score≥4 (or all-correct for validator/embeddings).
> Source: real Unicharm MySQL + pgvector corpus (read-only). See README.md for why.

## planner
| Model | pass-rate | avg score | avg latency (s) | ok/n |
|---|---|---|---|---|
| gemma4:12b | 100% | 4.0 | 32.9 | 2/2 |
| command-r7b:latest | 50% | 3.5 | 12.9 | 2/2 |
| devstral:latest | 0% | 2.5 | 21.3 | 2/2 |
| granite3.3:latest | 0% | 2.0 | 4.0 | 2/2 |
| phi4-mini:latest | 0% | 2.0 | 6.3 | 2/2 |
| mistral-nemo:latest | 0% | 2.0 | 10.8 | 2/2 |
| gemma3:12b | 0% | 2.0 | 12.1 | 2/2 |
| codestral:latest | 0% | 2.0 | 15.8 | 2/2 |
| nemotron-cascade-2:latest | 0% | 2.0 | 30.2 | 2/2 |

## validator
| Model | pass-rate | avg score | avg latency (s) | ok/n |
|---|---|---|---|---|
| command-r7b:latest | 100% | 5.0 | 2.2 | 1/1 |
| mistral-nemo:latest | 100% | 5.0 | 6.4 | 1/1 |
| devstral:latest | 100% | 5.0 | 9.1 | 1/1 |
| phi4-mini:latest | 100% | 5.0 | 11.8 | 1/1 |
| granite3.3:latest | 100% | 5.0 | 14.0 | 1/1 |
| codestral:latest | 100% | 5.0 | 22.7 | 1/1 |
| gemma3:12b | 100% | 5.0 | 28.9 | 1/1 |
| gemma4:12b | 100% | 5.0 | 35.9 | 1/1 |
| nemotron-cascade-2:latest | 100% | 5.0 | 54.2 | 1/1 |

## executor
| Model | pass-rate | avg score | avg latency (s) | ok/n |
|---|---|---|---|---|
| devstral:latest | 100% | 4.5 | 72.3 | 2/2 |
| mistral-nemo:latest | 50% | 3.5 | 37.0 | 2/2 |
| nemotron-cascade-2:latest | 50% | 3.5 | 90.7 | 2/2 |
| gemma4:12b | 50% | 3.0 | 65.9 | 2/2 |
| granite3.3:latest | 0% | 1.0 | 13.5 | 2/2 |
| gemma3:12b | 0% | 1.0 | 31.3 | 2/2 |
| command-r7b:latest | 0% | 1.0 | 31.7 | 2/2 |
| phi4-mini:latest | 0% | 1.0 | 32.6 | 2/2 |
| codestral:latest | 0% | 1.0 | 40.0 | 2/2 |

## nl_to_sql
| Model | pass-rate | avg score | avg latency (s) | ok/n |
|---|---|---|---|---|
| codestral:latest | 60% | 3.2 | - | 5/5 |
| command-r7b:latest | 40% | 2.4 | - | 5/5 |
| devstral:latest | 40% | 3.25 | 0.5 | 4/5 |
| gemma3:12b | 40% | 3.0 | - | 4/5 |
| nemotron-cascade-2:latest | 40% | 2.75 | 0.1 | 4/5 |
| gemma4:12b | 40% | 3.67 | - | 3/5 |
| mistral-nemo:latest | 40% | 3.33 | - | 3/5 |
| granite3.3:latest | 20% | 3.0 | - | 2/5 |
| phi4-mini:latest | 20% | 3.5 | - | 1/5 |

## rag_qa
| Model | pass-rate | avg score | avg latency (s) | ok/n |
|---|---|---|---|---|
| gemma3:12b | 100% | 5.0 | 10.9 | 5/5 |
| devstral:latest | 100% | 5.0 | 16.6 | 5/5 |
| gemma4:12b | 100% | 5.0 | 35.1 | 3/3 |
| granite3.3:latest | 100% | 4.75 | 15.3 | 4/4 |
| nemotron-cascade-2:latest | 100% | 4.75 | 34.0 | 4/4 |
| mistral-nemo:latest | 100% | 4.67 | 10.9 | 3/3 |
| codestral:latest | 80% | 4.6 | 24.4 | 5/5 |
| phi4-mini:latest | 75% | 4.0 | 11.0 | 4/4 |
| command-r7b:latest | 20% | 4.2 | 15.7 | 5/5 |

## narration
| Model | pass-rate | avg score | avg latency (s) | ok/n |
|---|---|---|---|---|
| command-r7b:latest | 100% | 4.5 | 13.8 | 2/2 |
| devstral:latest | 100% | 4.5 | 14.9 | 2/2 |
| codestral:latest | 100% | 4.0 | 17.0 | 2/2 |
| gemma3:12b | 50% | 3.5 | 8.9 | 2/2 |
| phi4-mini:latest | 50% | 3.0 | 7.9 | 2/2 |
| mistral-nemo:latest | 50% | 3.0 | 14.0 | 2/2 |
| granite3.3:latest | 50% | 3.0 | 16.6 | 2/2 |
| nemotron-cascade-2:latest | 0% | 1.5 | 30.9 | 1/2 |
| gemma4:12b | 0% | 1.0 | - | 0/2 |

## embeddings
_skipped / no data — not run_

\* judge == candidate (self-graded; may be optimistic).

## Fit verdict (auto-derived)

| Role | Best fit | Avoid (bad fit) — why |
|---|---|---|
| Planner | gemma4:12b (4.0, 100%) | devstral:latest (0% pass); granite3.3:latest (0% pass, score 2.0); phi4-mini:latest (0% pass, score 2.0); mistral-nemo:latest (0% pass, score 2.0); gemma3:12b (0% pass, score 2.0); codestral:latest (0% pass, score 2.0); nemotron-cascade-2:latest (0% pass, score 2.0) |
| Validator | command-r7b:latest (5.0, 100%) | — |
| Executor | devstral:latest (4.5, 100%) | granite3.3:latest (0% pass, score 1.0); gemma3:12b (0% pass, score 1.0); command-r7b:latest (0% pass, score 1.0); phi4-mini:latest (0% pass, score 1.0); codestral:latest (0% pass, score 1.0) |
| NL→SQL | codestral:latest (3.2, 60%) | command-r7b:latest (score 2.4); devstral:latest (errored 4/5); gemma3:12b (errored 4/5); nemotron-cascade-2:latest (errored 4/5); gemma4:12b (errored 3/5); mistral-nemo:latest (errored 3/5); granite3.3:latest (errored 2/5); phi4-mini:latest (errored 1/5) |
| RAG answerer | gemma3:12b (5.0, 100%) | — |
| Narration | command-r7b:latest (4.5, 100%) | nemotron-cascade-2:latest (errored 1/2, 0% pass, score 1.5); gemma4:12b (errored 0/2, 0% pass, score 1.0) |
| Embeddings | — (mode skipped) | — |

> Best fit = highest pass-rate among models that ran every case (ok=n). Bad fit = 0% pass, avg score <2.5, any errored case, or >120s/case.

## Per-role recommendation (from this run)

| Role | Best on real data |
|---|---|
| Planner | gemma4:12b |
| Validator | command-r7b:latest |
| Executor | devstral:latest |
| NL→SQL | codestral:latest |
| RAG answerer | gemma3:12b |
| Narration | command-r7b:latest |
| Embeddings | — (mode skipped) |

> Cross-check vs the synthetic Round-2 verdict (gpt-oss:20b Planner + phi4 Validator): see whether real-data results confirm or revise it. Final sign-off remains the Round-3 vLLM/FP8 run on 48 GB hardware.
