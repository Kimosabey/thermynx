"""Sequential, model-by-model driver — runs each candidate through ALL modes one at
a time and rewrites the report after every model, so the best-fit table builds up
live (and partial results survive an interruption).

  python model-eval/run_sequential.py                 # local Ollama candidates
  python model-eval/run_sequential.py --cloud         # OpenRouter cloud candidates

Output: reports/REAL_DATA_MODEL_EVAL.md (local) or OPENROUTER_MODEL_EVAL.md (cloud),
plus the matching results .json. Read-only against the real DBs; judge stays local.
"""
import _bootstrap  # noqa: F401  (sys.path + cwd + .env)

import argparse
import asyncio
import json

import config as cfg
import runners
from run_eval import _md
from app.db.session import MySQLSession

# Fast models first so the partial report populates quickly; slow 32B reasoners last.
LOCAL_ORDER = [
    "gpt-oss:20b", "qwen2.5:14b", "llama3.1:8b", "phi4:latest", "mistral-small3.2:latest",
    "gemma3:27b", "qwen2.5:32b", "deepseek-r1:32b", "qwq:32b",
]
CHAT_MODES = ["planner", "validator", "executor", "nl_to_sql", "rag_qa", "narration"]
ALL_MODES = CHAT_MODES + ["embeddings"]


async def _run_chat_model(model: str, db, *, cloud: bool = False) -> list[dict]:
    """One model through every chat/agentic mode (judge stays local).

    NL→SQL is skipped for cloud models: the app's run_nl_query uses the backend's
    own Ollama client, which can't route OpenRouter slugs — it would fail every case.
    NL→SQL is ranked on the local run instead.
    """
    rows: list[dict] = []
    rows += await runners.run_planner([model], db)
    rows += await runners.run_validator([model], db)
    rows += await runners.run_executor([model], db)
    rows += await runners.run_narration([model], db)
    if not cloud:
        rows += await runners.run_nl_to_sql([model])
    rows += await runners.run_rag_qa([model])
    return rows


def _write(out: str, rows: list[dict], modes: list[str]) -> None:
    cfg.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    raw = "results.json" if out == "REAL_DATA_MODEL_EVAL" else f"{out}.results.json"
    (cfg.REPORTS_DIR / raw).write_text(json.dumps(rows, indent=2, default=str), encoding="utf-8")
    (cfg.REPORTS_DIR / f"{out}.md").write_text(_md(rows, modes), encoding="utf-8")


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cloud", action="store_true", help="run OpenRouter cloud candidates instead of local Ollama")
    ap.add_argument("--reduced", action="store_true",
                    help="fewer cases per mode (full decider, faster): planner/exec=2, NL=5, RAG=5")
    ap.add_argument("--judge", default=cfg.JUDGE_MODEL,
                    help="judge model (e.g. claude-opus-4-8 for the Anthropic judge)")
    ap.add_argument("--models", default="",
                    help="comma-separated model override (e.g. a follow-up set); skips coder+embeddings extras")
    ap.add_argument("--out", default="",
                    help="report basename override (e.g. FOLLOWUP_NEW); default depends on --cloud")
    args = ap.parse_args()

    if args.reduced:
        cfg.N_FAULT_CASES = 2; cfg.N_EXEC_CASES = 2
        cfg.N_NL_QUESTIONS = 5; cfg.N_RAG_QUESTIONS = 5

    cfg.JUDGE_MODEL = args.judge  # judge.py + run_eval._md read this at call time
    print(f"Judge model: {cfg.JUDGE_MODEL}", flush=True)

    cloud = args.cloud
    override = [m.strip() for m in args.models.split(",") if m.strip()]
    models = override or (cfg.CLOUD_MODELS if cloud else LOCAL_ORDER)
    out = args.out or ("OPENROUTER_MODEL_EVAL" if cloud else "REAL_DATA_MODEL_EVAL")
    # cloud: no local embeddings, and no NL→SQL (backend SQL path can't route cloud slugs)
    modes = [m for m in CHAT_MODES if m != "nl_to_sql"] if cloud else ALL_MODES
    all_rows: list[dict] = []

    print(f"Sequential run · {'CLOUD/OpenRouter' if cloud else 'LOCAL/Ollama'} · "
          f"{len(models)} models · modes={modes}", flush=True)

    # Preflight: for LOCAL runs, Ollama MUST be reachable — otherwise every candidate call
    # fails and we'd silently score all-zeros (the failure we just hit). Abort loudly instead.
    if not cloud:
        import httpx
        from app.config import settings
        url = settings.OLLAMA_HOST.rstrip("/") + "/api/tags"
        try:
            n = len(httpx.get(url, timeout=10).json().get("models", []))
            print(f"Ollama reachable ✓ ({n} models at {settings.OLLAMA_HOST})", flush=True)
        except Exception as exc:  # noqa: BLE001
            print(f"\nABORT — Ollama NOT reachable at {settings.OLLAMA_HOST} ({str(exc)[:90]}).\n"
                  "On the server: set OLLAMA_HOST=0.0.0.0, restart Ollama, allow TCP 11434 in the\n"
                  "firewall — then verify `curl http://100.125.103.28:11434/api/tags` works from a\n"
                  "remote machine. Not running (would otherwise score all-zeros).", flush=True)
            return

    async with MySQLSession() as db:
        for i, model in enumerate(models, 1):
            print(f"\n=== [{i}/{len(models)}] {model} ===", flush=True)
            try:
                rows = await _run_chat_model(model, db, cloud=cloud)
            except Exception as exc:  # noqa: BLE001 — never let one model abort the run
                print(f"  !! {model} failed: {str(exc)[:160]}", flush=True)
                rows = []
            all_rows += rows
            _write(out, all_rows, modes)
            done = [f"{r['mode']}={r.get('score', '-')}" for r in rows if r["mode"] in CHAT_MODES]
            print(f"  {model}: {len(rows)} rows · {done}", flush=True)
            print(f"  -> wrote partial {out}.md ({len(all_rows)} rows so far)", flush=True)

    # NL->SQL also has a code-tuned candidate (local only) — skip when a custom --models set is given
    if not cloud and not override:
        print("\n=== NL->SQL extra: qwen2.5-coder:32b ===", flush=True)
        try:
            all_rows += await runners.run_nl_to_sql(["qwen2.5-coder:32b"])
            _write(out, all_rows, modes)
        except Exception as exc:  # noqa: BLE001
            print(f"  !! coder failed: {str(exc)[:160]}", flush=True)

        # Embeddings comparison (local embedders, in memory)
        print("\n=== embeddings: nomic vs mxbai ===", flush=True)
        try:
            all_rows += await runners.run_embeddings(cfg.MODELS_BY_MODE["embeddings"])
            _write(out, all_rows, modes)
        except Exception as exc:  # noqa: BLE001
            print(f"  !! embeddings failed: {str(exc)[:160]}", flush=True)

    _write(out, all_rows, modes)
    print(f"\nDONE · {len(all_rows)} rows · reports/{out}.md", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
