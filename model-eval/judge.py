"""LLM-as-judge — a held-constant strong model grades open-ended answers on a
1–5 rubric. Aligns with docs/planning/ai/EVALUATION_PLAN.md (grounding + factual
accuracy + format). Deterministic checks live in each runner; this adds quality.
"""
import config as cfg
import llm

_JUDGE_SYS = (
    "You are a strict evaluator for an HVAC operations AI. Score the candidate's "
    "answer on a 1-5 scale (5=excellent, 1=poor) for the given criteria. Be "
    "critical: penalize hallucinated numbers, ungrounded claims, missing citations, "
    "or answers that don't address the question. "
    'Respond with ONLY JSON: {"score": <1-5 int>, "pass": <true|false>, "reason": "<one sentence>"}. '
    "pass=true only if score>=4."
)


async def judge(criteria: str, question: str, answer: str,
                context: str = "") -> dict:
    """Return {score:int, pass:bool, reason:str, judge_error?:str}."""
    user = (f"CRITERIA: {criteria}\n\n"
            f"QUESTION / TASK:\n{question}\n\n"
            + (f"GROUND-TRUTH CONTEXT:\n{context}\n\n" if context else "")
            + f"CANDIDATE ANSWER:\n{answer}\n\nScore it.")
    try:
        obj, _ = await llm.chat_json(cfg.JUDGE_MODEL, _JUDGE_SYS, user, temperature=0.0)
        score = int(obj.get("score", 0))
        score = min(5, max(1, score))
        return {"score": score, "pass": bool(obj.get("pass", score >= 4)),
                "reason": str(obj.get("reason", ""))[:200]}
    except Exception as exc:  # noqa: BLE001 — a judge failure must not abort the sweep
        return {"score": 0, "pass": False, "reason": "", "judge_error": str(exc)[:160]}
