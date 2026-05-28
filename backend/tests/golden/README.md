# Golden test cases — AI regression suite

These are the **deterministic regression cases** for AI features. Run them
after any prompt change, model swap, or service refactor to catch behavioural
drift.

## Layout

```
tests/golden/
├── __init__.py        — exports ALL_CASES + CASES_BY_CATEGORY
├── cases.py           — all cases as plain Python dicts
└── README.md          — this file
```

Cases are **plain Python dicts** (not YAML / JSON) so they're checked by your
editor's linter and don't need a parser dependency.

## Categories

| Category | Verifies | Tier |
|---|---|---|
| `equipment_refusal` | "chiller 3" / "tower 5" / "pump 7" refused | T1-D |
| `capability_claim` | "shut down", "send email", "create work order" refused | T1-A · T2-F |
| `prompt_injection` | SQL injection, role-override refused | T1-B · T2-3 |
| `benchmark_override` | User-supplied benchmarks ignored | T1-E |
| `topic_off_domain` | Non-HVAC questions refused | T1-D-topic |
| `happy_path` | Real questions still answered correctly | — |
| `postcheck` | Post-gen audit flags raised correctly | T3 |

## Adding a new case

1. Open [`cases.py`](./cases.py)
2. Add a dict to the relevant list (`NL_QUERY_CASES`, `ANALYZER_CASES`, `AGENT_CASES`)
3. Schema:

```python
{
    "id":       "unique_snake_case_id",
    "endpoint": "/api/v1/nl-query",
    "category": "equipment_refusal",
    "body":     {"question": "..."},        # JSON body for POST
    "expect": {
        "status":          422,              # HTTP status
        "contains_any":    [...],            # at least one must appear
        "contains_all":    [...],            # all must appear
        "not_contains":    [...],            # none may appear
        "max_latency_ms":  1000,             # bound
        "min_latency_ms":  0,                # bound
        "audit_flag_count_min": 0,           # postcheck flags (analyzer only)
        "audit_flag_count_max": 5,           # postcheck flags (analyzer only)
    },
    "tags": ["T1-D"],
}
```

4. Run `pytest backend/tests/eval/test_golden.py -k <id>` to iterate
5. Once green, commit alongside the feature change that motivated the case

## Running

```bash
# Backend must be running on http://localhost:8000

# All cases
pytest backend/tests/eval/test_golden.py -v

# Fast subset only (no LLM calls — refusals + validation)
pytest backend/tests/eval/test_golden.py -v -k "refusal or claim or injection"

# Single case
pytest backend/tests/eval/test_golden.py -v -k nlq_unknown_chiller

# By category
pytest backend/tests/eval/test_golden.py -v -k capability_claim
```

The harness `SKIPS` (not fails) when the backend isn't reachable, so it's safe
to run unconditionally in CI — set `EVAL_REQUIRE_BACKEND=1` to fail-instead-of-skip.

## Expected test count

Current: 18 cases — 9 NL-Query · 5 analyzer · 3 agent · ~1 happy-path per surface.
Target after Phase 2 expansion: ~150 cases (see `docs/planning/ai/EVALUATION_PLAN.md`).
