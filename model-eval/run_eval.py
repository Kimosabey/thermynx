"""Orchestrator — runs selected modes x models against real data, writes a report.

  python model-eval/run_eval.py                         # full sweep, all modes/models
  python model-eval/run_eval.py --modes planner,nl_to_sql
  python model-eval/run_eval.py --modes planner --models gpt-oss:20b,qwen2.5:14b --quick

Output: model-eval/reports/REAL_DATA_MODEL_EVAL.md  + results.json
Read-only against the real DBs.
"""
import _bootstrap  # noqa: F401  (sys.path + cwd + .env)

import argparse
import asyncio
import json
from collections import defaultdict

import config as cfg
import runners
from app.db.session import MySQLSession

JUDGED_MODES = {"planner", "executor", "nl_to_sql", "rag_qa", "narration"}


async def _gather(modes: list[str], models_override: list[str] | None) -> list[dict]:
    rows: list[dict] = []
    models_for = lambda mode: models_override or cfg.MODELS_BY_MODE[mode]

    # MySQL-backed modes share one read session
    if {"planner", "validator", "executor", "narration"} & set(modes):
        async with MySQLSession() as db:
            if "planner" in modes:
                print("• planner ..."); rows += await runners.run_planner(models_for("planner"), db)
            if "validator" in modes:
                print("• validator ..."); rows += await runners.run_validator(models_for("validator"), db)
            if "executor" in modes:
                print("• executor ..."); rows += await runners.run_executor(models_for("executor"), db)
            if "narration" in modes:
                print("• narration ..."); rows += await runners.run_narration(models_for("narration"), db)
    if "nl_to_sql" in modes:
        print("• nl_to_sql ..."); rows += await runners.run_nl_to_sql(models_for("nl_to_sql"))
    if "rag_qa" in modes:
        print("• rag_qa ..."); rows += await runners.run_rag_qa(models_for("rag_qa"))
    if "embeddings" in modes:
        print("• embeddings ..."); rows += await runners.run_embeddings(models_for("embeddings"))
    return rows


def _agg(rows: list[dict], mode: str) -> list[dict]:
    by = defaultdict(list)
    for r in rows:
        if r["mode"] == mode and r["model"] != "-":
            by[r["model"]].append(r)
    table = []
    for model, rs in by.items():
        ok = [r for r in rs if r["ok"]]
        scored = [r["score"] for r in rs if r.get("score")]
        lats = [r["latency_s"] for r in ok if r.get("latency_s")]
        passes = [r for r in rs if r.get("passed")]
        table.append({
            "model": model, "n": len(rs), "ok": len(ok),
            "ok_rate": round(len(ok) / len(rs), 2) if rs else 0.0,
            "avg_score": round(sum(scored) / len(scored), 2) if scored else 0.0,
            "pass_rate": round(len(passes) / len(rs), 2) if rs else 0.0,
            "avg_latency": round(sum(lats) / len(lats), 1) if lats else None,
        })
    # ok_rate before score so a model that errored (e.g. emitted no usable answer) can't
    # outrank one that actually ran, even if its few scored rows look good.
    table.sort(key=lambda t: (t["pass_rate"], t["ok_rate"], t["avg_score"],
                              -(t["avg_latency"] or 999)), reverse=True)
    return table


def _md(rows: list[dict], modes: list[str]) -> str:
    from datetime import datetime, timezone
    L = ["# OMNYX Real-Data Model Evaluation",
         "",
         f"> Run: {datetime.now(timezone.utc).isoformat()} · judge = `{cfg.JUDGE_MODEL}` · "
         "scores 1-5, pass = score≥4 (or all-correct for validator/embeddings).",
         "> Source: real Unicharm MySQL + pgvector corpus (read-only). See README.md for why.",
         ""]
    best, tables = {}, {}
    for mode in modes:
        tbl = _agg(rows, mode)
        if not tbl:
            # surface SKIP reasons
            skips = [r for r in rows if r["mode"] == mode]
            note = skips[0].get("reason") or skips[0].get("error", "no data") if skips else "not run"
            L += [f"## {mode}", f"_skipped / no data — {note}_", ""]
            continue
        tables[mode] = tbl
        # best fit = top row that actually succeeded on every case (ok==n); else top row
        fully_ok = [t for t in tbl if t["ok"] == t["n"]]
        best[mode] = (fully_ok[0] if fully_ok else tbl[0])["model"]
        L += [f"## {mode}",
              "| Model | pass-rate | avg score | avg latency (s) | ok/n |",
              "|---|---|---|---|---|"]
        for t in tbl:
            star = " *" if (mode in JUDGED_MODES and t["model"] == cfg.JUDGE_MODEL) else ""
            L.append(f"| {t['model']}{star} | {t['pass_rate']:.0%} | {t['avg_score']} | "
                     f"{t['avg_latency'] if t['avg_latency'] is not None else '-'} | {t['ok']}/{t['n']} |")
        L.append("")
    if any(m in JUDGED_MODES for m in modes):
        L += ["\\* judge == candidate (self-graded; may be optimistic).", ""]

    role_map = {"Planner": "planner", "Validator": "validator", "Executor": "executor",
                "NL→SQL": "nl_to_sql", "RAG answerer": "rag_qa", "Narration": "narration",
                "Embeddings": "embeddings"}

    # auto-derived best/bad fit verdict (success-rate + latency aware)
    SLOW_S = 120
    L += ["## Fit verdict (auto-derived)", "",
          "| Role | Best fit | Avoid (bad fit) — why |", "|---|---|---|"]
    for role, mode in role_map.items():
        tbl = tables.get(mode)
        if not tbl:
            L.append(f"| {role} | — (mode skipped) | — |")
            continue
        fully_ok = [t for t in tbl if t["ok"] == t["n"]]
        b = fully_ok[0] if fully_ok else tbl[0]
        cav = "" if fully_ok else " ⚠ no fully-reliable model"
        bad = []
        for t in tbl:
            why = []
            if t["ok"] < t["n"]:
                why.append(f"errored {t['ok']}/{t['n']}")
            if t["pass_rate"] == 0:
                why.append("0% pass")
            if t["avg_score"] < 2.5:
                why.append(f"score {t['avg_score']}")
            if t["avg_latency"] and t["avg_latency"] > SLOW_S:
                why.append(f"{t['avg_latency']:.0f}s/case")
            if why:
                bad.append(f"{t['model']} ({', '.join(why)})")
        L.append(f"| {role} | {b['model']} ({b['avg_score']}, {b['pass_rate']:.0%}){cav} "
                 f"| {'; '.join(bad) or '—'} |")
    L += ["", f"> Best fit = highest pass-rate among models that ran every case (ok=n). "
          f"Bad fit = 0% pass, avg score <2.5, any errored case, or >{SLOW_S}s/case.", ""]

    # per-role recommendation (one-line best pick)
    L += ["## Per-role recommendation (from this run)", "", "| Role | Best on real data |", "|---|---|"]
    for role, mode in role_map.items():
        L.append(f"| {role} | {best.get(mode, '— (mode skipped)')} |")
    L += ["",
          "> Cross-check vs the synthetic Round-2 verdict (gpt-oss:20b Planner + phi4 Validator): "
          "see whether real-data results confirm or revise it. Final sign-off remains the "
          "Round-3 vLLM/FP8 run on 48 GB hardware.", ""]
    return "\n".join(L)


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--modes", default=",".join(cfg.ALL_MODES))
    ap.add_argument("--models", default="")
    ap.add_argument("--quick", action="store_true", help="1 case per mode for a fast smoke run")
    ap.add_argument("--out", default="REAL_DATA_MODEL_EVAL",
                    help="report basename in reports/ (use OPENROUTER_MODEL_EVAL for the cloud run)")
    args = ap.parse_args()

    modes = [m.strip() for m in args.modes.split(",") if m.strip()]
    models_override = [m.strip() for m in args.models.split(",") if m.strip()] or None
    if args.quick:
        cfg.N_FAULT_CASES = 1; cfg.N_EXEC_CASES = 1; cfg.N_NL_QUESTIONS = 2
        cfg.N_RAG_QUESTIONS = 2; cfg.EMBED_SAMPLE = 6

    print(f"Modes: {modes} · models: {models_override or 'per-mode defaults'} · quick={args.quick}")
    rows = await _gather(modes, models_override)

    cfg.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    raw_name = "results.json" if args.out == "REAL_DATA_MODEL_EVAL" else f"{args.out}.results.json"
    (cfg.REPORTS_DIR / raw_name).write_text(json.dumps(rows, indent=2, default=str), encoding="utf-8")
    report = _md(rows, modes)
    md_path = cfg.REPORTS_DIR / f"{args.out}.md"
    md_path.write_text(report, encoding="utf-8")
    print(f"\nWrote {md_path} ({len(rows)} rows)")
    print("\n" + report)


if __name__ == "__main__":
    asyncio.run(main())
