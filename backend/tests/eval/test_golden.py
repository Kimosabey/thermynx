"""Pytest entry point for the golden test suite.

Each case in `tests.golden.cases.ALL_CASES` becomes one parametrized test.
The backend must be running on `http://localhost:8000` (or pass `EVAL_BASE_URL`
env var). If the backend isn't reachable, tests SKIP cleanly rather than fail
— so this can run unconditionally in dev / CI.

Set `EVAL_REQUIRE_BACKEND=1` to make unreachability fail instead of skip.
"""
from __future__ import annotations

import os
import sys

import pytest

# Ensure `tests.*` resolves when pytest is run from the backend/ dir.
_THIS = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.dirname(os.path.dirname(_THIS))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from tests.eval.runner import backend_reachable, run_case   # noqa: E402
from tests.golden import ALL_CASES                          # noqa: E402

BASE_URL = os.environ.get("EVAL_BASE_URL", "http://localhost:8000")
REQUIRE  = os.environ.get("EVAL_REQUIRE_BACKEND", "0") == "1"


@pytest.fixture(scope="session")
def backend_check() -> None:
    if backend_reachable(BASE_URL):
        return
    msg = f"backend not reachable at {BASE_URL}"
    if REQUIRE:
        pytest.fail(msg)
    else:
        pytest.skip(msg, allow_module_level=False)


@pytest.mark.parametrize("case", ALL_CASES, ids=lambda c: c["id"])
def test_golden_case(case: dict, backend_check) -> None:
    """Run one golden case and assert all expectations pass."""
    result = run_case(case, base_url=BASE_URL)

    if result.skipped:
        pytest.skip(result.skip_reason or "case skipped")

    if not result.passed:
        # Build a readable failure message
        lines = [
            "",
            f"case_id:    {result.case_id}",
            f"category:   {case.get('category')}",
            f"endpoint:   {case.get('endpoint')}",
            f"status:     {result.status}",
            f"latency_ms: {result.latency_ms}",
            "failures:",
        ]
        for f in result.failures:
            lines.append(f"  • {f}")
        lines.append("")
        lines.append("response preview (first 500 chars):")
        lines.append(f"  {result.response_text!r}")
        pytest.fail("\n".join(lines))
