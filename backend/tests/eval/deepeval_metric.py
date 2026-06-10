"""DeepEval faithfulness metric (F6.4) — LOCAL Ollama judge, zero egress.

Wraps a local Ollama model as a `DeepEvalBaseLLM` so DeepEval's
`FaithfulnessMetric` runs fully on-prem: no OpenAI key, no cloud, no telemetry
(DEEPEVAL_TELEMETRY_OPT_OUT is set before deepeval imports — it bundles
posthog/sentry). Faithfulness = are the ANSWER's claims supported by the
retrieval context (the telemetry summary the analyzer was actually given).

Recorded as a SIGNAL alongside the S2 judge — never a hard gate, matching
critique.py's "second opinion, never a gate". Defensive: never raises; on any
failure (judge unreachable, schema mismatch) it returns score=None.

deepeval is dev-only (requirements-dev.txt); import is lazy so the runtime
image never loads it.
"""
from __future__ import annotations

import os

# Must be set BEFORE deepeval is imported anywhere (it wires posthog/sentry at import).
os.environ.setdefault("DEEPEVAL_TELEMETRY_OPT_OUT", "YES")
os.environ.setdefault("DEEPEVAL_DISABLE_PROGRESS_BAR", "YES")

import json

import httpx

JUDGE_MODEL = "llama3.1:8b"                  # local, non-Chinese, different from the answer model
OLLAMA_HOST = "http://100.125.103.28:11434"  # Tailscale Ollama host (same as the S2 judge)
TIMEOUT     = 90.0

_judge = None  # cached DeepEvalBaseLLM wrapper (built once)


def _build_judge():
    """Construct the local-Ollama DeepEvalBaseLLM wrapper (lazy — needs deepeval)."""
    from deepeval.models import DeepEvalBaseLLM

    class OllamaJudge(DeepEvalBaseLLM):
        def __init__(self, model: str, host: str):
            self.model = model
            self.host = host

        def load_model(self):
            return self.model

        def get_model_name(self) -> str:
            return f"ollama:{self.model}"

        def _call(self, prompt: str, schema=None):
            payload: dict = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.0, "num_predict": 800},
            }
            if schema is not None:
                payload["format"] = "json"  # constrain to JSON when a schema is expected
            r = httpx.post(f"{self.host}/api/generate", json=payload, timeout=TIMEOUT)
            r.raise_for_status()
            raw = r.json().get("response", "")
            if schema is not None:
                # DeepEval passes a pydantic schema and expects an instance back.
                return schema(**json.loads(raw))
            return raw

        def generate(self, prompt: str, schema=None):
            return self._call(prompt, schema)

        async def a_generate(self, prompt: str, schema=None):
            return self._call(prompt, schema)

    return OllamaJudge(JUDGE_MODEL, OLLAMA_HOST)


def faithfulness_score(question: str, answer: str, context: list[str]) -> dict:
    """Run DeepEval's FaithfulnessMetric with the local judge.

    Returns {score: float|None, reason: str, success: bool|None}. Never raises.
    score is in [0,1]; success is score >= threshold. None ⇒ metric could not run
    (treat as no-signal, not a failure).
    """
    if not answer or not context:
        return {"score": None, "reason": "empty answer or context", "success": None}
    try:
        from deepeval.metrics import FaithfulnessMetric
        from deepeval.test_case import LLMTestCase

        global _judge
        if _judge is None:
            _judge = _build_judge()

        metric = FaithfulnessMetric(
            threshold=0.7, model=_judge, async_mode=False, include_reason=True,
        )
        tc = LLMTestCase(input=question or "(n/a)", actual_output=answer, retrieval_context=context)
        metric.measure(tc)
        return {
            "score":   metric.score,
            "reason":  (metric.reason or "")[:300],
            "success": metric.is_successful(),
        }
    except Exception as exc:  # judge down, schema mismatch, etc. — degrade to no-signal
        return {"score": None, "reason": f"deepeval error: {type(exc).__name__}: {exc}"[:300], "success": None}
