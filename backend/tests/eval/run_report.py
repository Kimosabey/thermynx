"""Run the golden suite against the live backend and write a structured report.

Outputs (to backend/tests/eval/reports/):
  - eval-<timestamp>.json  — full machine-readable results
  - eval-<timestamp>.md    — human-readable summary table
  - latest.md              — copy of the most recent run

Usage (from backend/, backend must be running on :8000):
  PYTHONIOENCODING=utf-8 ../.venv/Scripts/python.exe -m tests.eval.run_report
"""
from __future__ import annotations

import datetime
import json
import pathlib

from tests.golden.cases import ALL_CASES
from tests.eval.runner import run_case, backend_reachable

REPORTS = pathlib.Path(__file__).parent / "reports"


def _status(r) -> str:
    if r.skipped:
        return "skip"
    return "pass" if r.passed else "FAIL"


def main() -> None:
    REPORTS.mkdir(exist_ok=True)
    if not backend_reachable():
        print("Backend not reachable on :8000 — start it first (make backend).")
        return

    started = datetime.datetime.now()
    print(f"Running {len(ALL_CASES)} golden cases against :8000 ...\n")
    results = []
    for c in ALL_CASES:
        r = run_case(c)
        results.append(r)
        print(f"  {_status(r):4}  {r.case_id:42} {r.latency_ms:>7} ms"
              + (f"   <- {'; '.join(r.failures)[:90]}" if r.failures else ""))

    passed  = sum(1 for r in results if r.passed and not r.skipped)
    failed  = sum(1 for r in results if not r.passed and not r.skipped)
    skipped = sum(1 for r in results if r.skipped)
    ts = started.strftime("%Y%m%d-%H%M%S")

    payload = {
        "started":   started.isoformat(),
        "backend":   "http://localhost:8000",
        "totals":    {"total": len(results), "passed": passed, "failed": failed, "skipped": skipped},
        "cases": [
            {
                "id": r.case_id, "passed": r.passed, "skipped": r.skipped, "status": r.status,
                "latency_ms": r.latency_ms, "failures": r.failures,
                "s2_verdict": r.s2_verdict, "deepeval": r.deepeval,
            }
            for r in results
        ],
    }
    (REPORTS / f"eval-{ts}.json").write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")

    md = [
        f"# Golden eval report — {started:%Y-%m-%d %H:%M}",
        "",
        f"**{passed} passed · {failed} failed · {skipped} skipped**  (of {len(results)} cases) — backend `:8000`",
        "",
        "| Case | Result | HTTP | Latency | Notes |",
        "|------|--------|------|---------|-------|",
    ]
    for r in results:
        mark = "✅ pass" if (r.passed and not r.skipped) else ("⏭️ skip" if r.skipped else "❌ FAIL")
        note = "; ".join(r.failures)[:100] if r.failures else (r.skip_reason if r.skipped else "")
        md.append(f"| {r.case_id} | {mark} | {r.status} | {r.latency_ms} ms | {note} |")
    md_text = "\n".join(md) + "\n"
    (REPORTS / f"eval-{ts}.md").write_text(md_text, encoding="utf-8")
    (REPORTS / "latest.md").write_text(md_text, encoding="utf-8")

    print(f"\n=== {passed} passed · {failed} failed · {skipped} skipped (of {len(results)}) ===")
    print(f"report -> tests/eval/reports/eval-{ts}.md  (+ .json, + latest.md)")


if __name__ == "__main__":
    main()
