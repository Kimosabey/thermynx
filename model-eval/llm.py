"""LLM calls for the harness — provider-aware (local Ollama + cloud OpenRouter).

Routing is by model name: a slug containing "/" (e.g. "openai/gpt-oss-120b") goes
to OpenRouter's OpenAI-compatible API; a bare name ("gpt-oss:20b") goes to the local
Ollama server. This lets runners.py stay provider-agnostic — it just passes model names.

The app's app.llm.ollama client has no JSON-mode (format="json") option, so the
harness makes its own thin calls. Read-only w.r.t. databases; only talks to the LLM
endpoints. NOTE: OpenRouter calls send the prompt (incl. real-data cases) to a
third-party cloud — used only with explicit user authorization.
"""
import json
import os
import time
from pathlib import Path

import httpx

import config as cfg
from app.config import settings

HOST = settings.OLLAMA_HOST.rstrip("/")
OPENROUTER_BASE = "https://openrouter.ai/api/v1"


def _load_openrouter_key() -> str | None:
    """Key from env, else from the gitignored model-eval/.env.local. Never logged."""
    k = os.getenv("OPENROUTER_API_KEY")
    if not k:
        envf = Path(__file__).resolve().parent / ".env.local"
        if envf.exists():
            for line in envf.read_text(encoding="utf-8").splitlines():
                if line.strip().startswith("OPENROUTER_API_KEY="):
                    k = line.split("=", 1)[1].strip()
                    break
    return k or None


_OR_KEY = _load_openrouter_key()


def _is_openrouter(model: str) -> bool:
    return "/" in model


def _or_headers() -> dict:
    if not _OR_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not set (env or model-eval/.env.local)")
    # Referer/Title are OpenRouter attribution headers (optional, recommended).
    return {"Authorization": f"Bearer {_OR_KEY}",
            "HTTP-Referer": "https://graylinx.ai", "X-Title": "graylinx-model-eval"}


def _extract_json(text: str) -> dict:
    """Pull the outermost JSON object out of a reply (tolerates reasoning preambles)."""
    start, depth = text.find("{"), 0
    if start < 0:
        raise ValueError("no JSON object in reply")
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return json.loads(text[start:i + 1])
    raise ValueError("unbalanced JSON in reply")


async def chat_json(model: str, system: str, user: str,
                    temperature: float = cfg.CHAT_TEMPERATURE) -> tuple[dict, float]:
    """JSON-mode chat. Returns (parsed_obj, latency_s)."""
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    t0 = time.time()
    if _is_openrouter(model):
        payload = {"model": model, "messages": msgs, "temperature": temperature,
                   "response_format": {"type": "json_object"}}
        async with httpx.AsyncClient(timeout=cfg.REQUEST_TIMEOUT_S) as c:
            r = await c.post(f"{OPENROUTER_BASE}/chat/completions", json=payload, headers=_or_headers())
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"] or ""
    else:
        payload = {"model": model, "messages": msgs, "stream": False, "format": "json",
                   "options": {"temperature": temperature, "num_ctx": 8192}}
        async with httpx.AsyncClient(timeout=cfg.REQUEST_TIMEOUT_S) as c:
            r = await c.post(f"{HOST}/api/chat", json=payload)
            r.raise_for_status()
            content = r.json()["message"]["content"]
    return _extract_json(content), round(time.time() - t0, 1)


async def chat_tools(model: str, messages: list[dict], tools: list[dict],
                     temperature: float = cfg.CHAT_TEMPERATURE) -> tuple[dict, list[dict], float]:
    """Native tool-calling chat. Returns (assistant_message, calls, latency_s).

    `assistant_message` is the provider's raw assistant message (echo it back into
    `messages` as-is). `calls` is normalized: [{"id","name","args"(dict)}]. Models
    without native tool support return [] (caller falls back to JSON-mode), or 4xx
    (the caller catches it and falls back). Works for both Ollama and OpenRouter;
    TOOL_SCHEMAS is already in OpenAI function format, which both accept.
    """
    t0 = time.time()
    if _is_openrouter(model):
        payload = {"model": model, "messages": messages, "tools": tools, "temperature": temperature}
        async with httpx.AsyncClient(timeout=cfg.REQUEST_TIMEOUT_S) as c:
            r = await c.post(f"{OPENROUTER_BASE}/chat/completions", json=payload, headers=_or_headers())
            r.raise_for_status()
            message = r.json()["choices"][0]["message"]
    else:
        payload = {"model": model, "messages": messages, "stream": False, "tools": tools,
                   "options": {"temperature": temperature, "num_ctx": 8192}}
        async with httpx.AsyncClient(timeout=cfg.REQUEST_TIMEOUT_S) as c:
            r = await c.post(f"{HOST}/api/chat", json=payload)
            r.raise_for_status()
            message = r.json().get("message") or {}
    calls = []
    for i, tc in enumerate(message.get("tool_calls") or []):
        fn = tc.get("function", {})
        args = fn.get("arguments")
        if isinstance(args, str):  # OpenAI/OpenRouter send arguments as a JSON string
            try:
                args = json.loads(args)
            except Exception:  # noqa: BLE001
                args = {}
        calls.append({"id": tc.get("id") or f"call_{i}", "name": fn.get("name", ""),
                      "args": args if isinstance(args, dict) else {}})
    return message, calls, round(time.time() - t0, 1)


async def chat_text(model: str, system: str, user: str,
                    temperature: float = cfg.CHAT_TEMPERATURE,
                    num_predict: int | None = None) -> tuple[str, float]:
    """Plain-text chat (narration / RAG answer). Returns (text, latency_s)."""
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    t0 = time.time()
    if _is_openrouter(model):
        payload = {"model": model, "messages": msgs, "temperature": temperature}
        if num_predict:
            payload["max_tokens"] = num_predict
        async with httpx.AsyncClient(timeout=cfg.REQUEST_TIMEOUT_S) as c:
            r = await c.post(f"{OPENROUTER_BASE}/chat/completions", json=payload, headers=_or_headers())
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"] or ""
    else:
        opts = {"temperature": temperature, "num_ctx": 8192}
        if num_predict:
            opts["num_predict"] = num_predict
        payload = {"model": model, "messages": msgs, "stream": False, "options": opts}
        async with httpx.AsyncClient(timeout=cfg.REQUEST_TIMEOUT_S) as c:
            r = await c.post(f"{HOST}/api/chat", json=payload)
            r.raise_for_status()
            content = r.json()["message"]["content"]
    return content.strip(), round(time.time() - t0, 1)


async def embed(model: str, text: str) -> list[float]:
    """Single embedding vector from Ollama /api/embeddings (local only)."""
    async with httpx.AsyncClient(timeout=cfg.REQUEST_TIMEOUT_S) as c:
        r = await c.post(f"{HOST}/api/embeddings", json={"model": model, "prompt": text})
        r.raise_for_status()
        return r.json()["embedding"]
