# Planner Improvement Playbook (gemma4:12b) — for later

> **Goal:** raise the Planner score (currently ~3.0/5, Claude Opus judge, reduced cases) **without**
> changing the model — gemma4:12b is confirmed best/right-size. This is a *prompt/context* playbook,
> cheapest-first. Apply + re-test when we choose to invest. Model selection itself is settled —
> see [MODEL_EVAL_FINAL_REPORT.md](MODEL_EVAL_FINAL_REPORT.md).

---

## STEP 0 — First decide if it's even worth it
Planning is a **bounded task** (read a few numbers → "raise work order, tier 2, check X") and Claude
grades **strictly**, so ~3.0 may be "acceptable," not "failing." **Read the judge's deductions first**
(Step 1). If they're real gaps → fix. If they're "could be more detailed" nitpicks → 3.0 is likely fine
for production, and effort is better spent on **NL→SQL guardrails** (our actual weak spot).

---

## STEP 1 — Mine the Opus feedback (diagnose before changing anything)
The harness stores Claude's `reason` per case in `reports/results.json` (and the run logs). Pull the
Planner rows and **categorize every deduction** into buckets; the dominant bucket = highest-leverage fix.

| Bucket | Meaning |
|---|---|
| Missing steps | skipped a diagnostic action it should have taken |
| Wrong order | right steps, wrong sequence |
| Wrong tool/action | called the wrong executor tool for the situation |
| Vague instructions | executor couldn't act on what the planner wrote |
| Hallucinated context | assumed facts not in the fault case |
| Incomplete root cause | addressed symptoms, not the underlying fault |

**How to pull the data:**
```
python -c "import _bootstrap,json; rows=json.load(open('reports/results.json')); \
[print(r['model'],r['score'],'|',r['reason']) for r in rows if r['mode']=='planner']"
```

---

## STEP 2 — Match the dominant failure to the fix

| Dominant failure | Most likely fix |
|---|---|
| Missing steps / wrong order | Better system prompt — add an explicit fault-diagnosis procedure |
| Vague instructions | Output-format constraint — typed steps (action / tool / expected_output) |
| Wrong tool selection | Rewrite executor **tool descriptions** in `app.ai.tools` (ambiguous names) |
| Hallucinated context | Inject richer fault context / RAG |
| Incomplete root cause | Few-shot examples — show what a "complete" plan looks like |

---

## STEP 3 — Interventions, highest-ROI first

| # | Intervention | What to do | Cost | Our note |
|---|---|---|---|---|
| 1 | **Few-shot examples** ⭐ | Put 2–3 of our **4-scoring** plans as `fault → ideal plan` pairs in the system prompt | ~1 hr | Usually the fastest win |
| 2 | **Typed structured steps** | We already emit JSON (`rationale/steps/tier`); upgrade `steps` to objects: `{action, tool, expected_output, fallback}` | ~1 hr | Forces completeness; gaps become obvious |
| 3 | **Richer fault context + RAG** | Add equipment history, recent maintenance, and a RAG pull of the **maintenance/anomaly playbook** to the prompt | ~½ day | Our summary is already decent; RAG of docs is the real add |
| 4 | **Chain-of-thought block** | A `<reasoning>` step (fault category, subsystem, safety, confidence) before the plan | ~1 hr | ⚠️ **Lower priority for us** — gemma4 *already* thinks internally; explicit CoT is partly redundant **and** risks the token/blank issue. Use only if Steps 1–2 plateau |
| 5 | **Fine-tuning** | Build 20–30 graded `fault → ideal plan` pairs (domain expert + synthetic from best outputs), fine-tune gemma4:12b | days | **Last resort** — only if prompting stalls ~3.5–4.0. Path to 4.5 |

---

## HOW TO RE-TEST after each change
Re-run the Planner mode with the **same Claude judge** and compare the average:
```
# from model-eval/ :
python -c "import sys,os,asyncio; sys.path.insert(0,os.path.abspath('.')); \
import _bootstrap,config as cfg,runners; from app.db.session import MySQLSession; \
cfg.JUDGE_MODEL='claude-opus-4-8'; cfg.N_FAULT_CASES=6; \
asyncio.run((lambda: __import__('asyncio').get_event_loop())())"
```
Simplest: `python run_sequential.py --reduced --judge claude-opus-4-8 --models gemma4:12b` (then read the
planner rows). **Change ONE thing at a time**, re-score, keep it only if the average goes up.

**Target:** ~3.0 → 3.5–4.0 with prompting (Steps 1–3); 4.0+ likely needs fine-tuning (Step 5).

---

## Guardrails (don't regress)
- Keep gemma4 on the **JSON-mode planner path** with a generous token budget (it's a thinking model —
  a tight text cap makes it go blank).
- Re-run the **in-app golden check** after prompt changes (confirm it still returns valid plans live).
- Same judge (`claude-opus-4-8`) every time so scores stay comparable.
- This is **prompt/context tuning only** — the model (gemma4:12b) and the rest of the team are settled.
