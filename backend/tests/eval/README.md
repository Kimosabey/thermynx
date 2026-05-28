# AI eval harness

Pytest-based regression suite for the AI feature surface. Runs the cases
defined in [`tests/golden/cases.py`](../golden/cases.py) against a live
backend and verifies deterministic expectations (status code, contains/
not-contains text, latency bounds, post-gen audit flag counts).

This is **Layer 4 / S1 deterministic** from
[`docs/planning/ai/EVALUATION_PLAN.md`](../../../docs/planning/ai/EVALUATION_PLAN.md).
S2 (LLM-as-judge) and S3 (numeric-reference comparison) are follow-on phases.

## Quick run

```bash
# 1. Start the backend (uvicorn on :8000)
cd backend
../.venv/Scripts/uvicorn main:app --reload --port 8000

# 2. In another shell, run the suite
cd backend
../.venv/Scripts/pytest tests/eval/test_golden.py -v
```

Output looks like:

```
tests/eval/test_golden.py::test_golden_case[nlq_unknown_chiller]   PASSED  [0.06s]
tests/eval/test_golden.py::test_golden_case[nlq_unknown_tower]     PASSED  [0.05s]
tests/eval/test_golden.py::test_golden_case[nlq_shutdown_action]   PASSED  [0.04s]
tests/eval/test_golden.py::test_golden_case[nlq_off_topic_joke]    PASSED  [0.04s]
tests/eval/test_golden.py::test_golden_case[nlq_happy_chiller_1]   PASSED  [1.42s]
tests/eval/test_golden.py::test_golden_case[an_unknown_chiller]    PASSED  [0.18s]
...
=========================== 18 passed in 47.32s ============================
```

## Subsets

```bash
# Fast — all preflight refusals (no LLM call)
pytest tests/eval/test_golden.py -v -k "refusal or claim or topic or injection"

# Slow — happy paths only (real LLM work)
pytest tests/eval/test_golden.py -v -k happy_path

# One case
pytest tests/eval/test_golden.py -v -k nlq_unknown_chiller

# By tier tag (matches against test ID prefix only via -k)
pytest tests/eval/test_golden.py -v -k nlq    # NL-Query suite
pytest tests/eval/test_golden.py -v -k an_    # Analyzer suite
pytest tests/eval/test_golden.py -v -k ag_    # Agent suite
```

## Backend not running

By default the suite **skips** (not fails) when `:8000` is unreachable:

```
SKIPPED [18] backend not reachable at http://localhost:8000
```

For CI, force fail-on-unreachable:

```bash
EVAL_REQUIRE_BACKEND=1 pytest tests/eval/test_golden.py -v
```

Or point at a remote backend:

```bash
EVAL_BASE_URL=http://staging.thermynx:8000 pytest tests/eval/test_golden.py -v
```

## Adding cases

See [`tests/golden/README.md`](../golden/README.md) for the case schema.
TL;DR: add a dict to the relevant list in `cases.py`, run
`pytest -k <id>` until green, commit.

## When tests fail

Pytest prints the failure reasons inline. Common patterns:

| Failure | Likely cause |
|---|---|
| `status: expected 422, got 200` | Preflight didn't fire — reload backend, check `services/preflight.py` |
| `contains_any: none of [...] found` | Prompt regression — model paraphrased the refusal |
| `not_contains: forbidden [...] found` | LLM hallucinated or capability-claimed despite the rule |
| `latency: 8500ms exceeds max 1000ms` | Preflight bypassed — refusal went all the way to the LLM |
| `audit_flag_count: 7 not in [0, 5]` | Postcheck regression — model fabricated more than the tolerance |

## Roadmap

| Phase | What | Status |
|---|---|---|
| **Phase 1** (this) | S1 deterministic checks + 18 cases | 🟢 Done |
| **Phase 2** | Expand to 150 cases per [`EVALUATION_PLAN.md`](../../../docs/planning/ai/EVALUATION_PLAN.md) | ⏳ Planned |
| **Phase 3** | S2 LLM-as-judge (semantic grounding check) | ⏳ Planned |
| **Phase 3** | S3 reference comparison (numeric values vs analytics ground truth) | ⏳ Planned |
| **Phase 4** | JSON run reports + diff vs previous run | ⏳ Planned |
| **Phase 4** | Pre-commit hook on prompt/agent changes | ⏳ Planned |
