"""S2 LLM-as-judge — semantic grounding check.

Uses a LOCAL Ollama model (llama3.1:8b by default — different from the
answer model) to assess whether an answer is semantically grounded in the
provided context summary. Open-source, on-prem, zero data egress.

Usage in eval cases:
    "expect": {"s2_judge": True, "s2_grounded": True}

The runner calls judge_answer() after S1 checks pass. The judge returns:
    {"grounded": bool, "issues": [str], "raw": str}

This is the only judge call per case — one LLM round-trip at eval time.
"""
from __future__ import annotations

import json
import re

import httpx

JUDGE_MODEL   = "llama3.1:8b"     # smaller, faster; different from qwen2.5:14b used for answers
JUDGE_TEMP    = 0.0                # deterministic
JUDGE_TIMEOUT = 60.0
OLLAMA_HOST   = "http://localhost:8000"  # proxied through backend for consistency;
                                          # falls back to direct Ollama if needed

_JUDGE_PROMPT = """You are a strict evaluator checking whether an AI-generated HVAC analysis answer is
grounded in the provided context.

CONTEXT (the data the AI was given):
{context}

ANSWER (what the AI said):
{answer}

Task: For every specific numeric claim (kW, TR, kW/TR, %, °C, hours) in the ANSWER:
1. Check if the number appears in the CONTEXT within 10% tolerance.
2. If a number is in the ANSWER but NOT in the CONTEXT, mark it as an issue.

Return ONLY this JSON:
{{
  "grounded": true | false,
  "issues": ["claim X not found in context", ...]
}}

Rules:
- "grounded" = true if zero issues found.
- Be lenient on rounding (0.613 vs 0.61 is fine).
- Ignore non-numeric claims (adjectives like "efficient", "normal").
- No prose outside the JSON.
"""


def _extract_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\n?", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"```\s*$", "", raw)
    raw = raw.strip()
    start = raw.find("{")
    if start < 0:
        return {"grounded": None, "issues": ["judge returned no JSON"]}
    depth = 0
    for i in range(start, len(raw)):
        if raw[i] == "{":
            depth += 1
        elif raw[i] == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(raw[start : i + 1])
                except json.JSONDecodeError:
                    break
    return {"grounded": None, "issues": ["judge JSON unparseable"]}


def judge_answer(
    answer: str,
    context_summary: str,
    *,
    ollama_host: str = "http://100.125.103.28:11434",
    model: str = JUDGE_MODEL,
    timeout: float = JUDGE_TIMEOUT,
) -> dict:
    """Synchronous S2 judge call. Returns {grounded, issues, raw}.

    Called from the eval runner on cases that opt-in with s2_judge=True.
    Uses the Tailscale Ollama host directly (not through the backend proxy)
    so the eval harness doesn't need the backend to be running for S2.
    """
    if not answer or not context_summary:
        return {"grounded": None, "issues": ["empty answer or context"]}

    prompt = _JUDGE_PROMPT.format(
        context=context_summary[:3000],
        answer=answer[:3000],
    )
    try:
        r = httpx.post(
            f"{ollama_host}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False,
                  "options": {"temperature": JUDGE_TEMP, "num_predict": 400}},
            timeout=timeout,
        )
        r.raise_for_status()
        raw = r.json().get("response", "")
    except Exception as exc:
        return {"grounded": None, "issues": [f"judge call failed: {exc}"], "raw": ""}

    result = _extract_json(raw)
    result["raw"] = raw[:500]
    return result
