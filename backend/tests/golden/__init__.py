"""Golden test cases for AI feature regressions.

Each case is a plain dict with the schema documented in `cases.py`. Tests are
discovered via pytest parametrize in `tests/eval/test_golden.py`.
"""
from tests.golden.cases import ALL_CASES, CASES_BY_CATEGORY

__all__ = ["ALL_CASES", "CASES_BY_CATEGORY"]
