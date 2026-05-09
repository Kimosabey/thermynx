import json
from typing import AsyncIterator, Any
import httpx
from app.config import settings

TIMEOUT      = httpx.Timeout(120.0, connect=10.0)
TOOL_TIMEOUT = httpx.Timeout(60.0,  connect=10.0)


async def list_models() -> list[str]:
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(f"{settings.OLLAMA_HOST}/api/tags")
        resp.raise_for_status()
        return [m["name"] for m in resp.json().get("models", [])]


async def stream_generate(prompt: str, model: str | None = None) -> AsyncIterator[str]:
    """Yield text chunks via /api/generate (prompt-based, no tool support)."""
    target = model or settings.OLLAMA_DEFAULT_MODEL
    payload = {
        "model": target,
        "prompt": prompt,
        "stream": True,
        "options": {"temperature": 0.3, "top_p": 0.9, "num_ctx": 8192},
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        async with client.stream("POST", f"{settings.OLLAMA_HOST}/api/generate", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                chunk = data.get("response", "")
                if chunk:
                    yield chunk
                if data.get("done"):
                    return


async def chat(
    messages: list[dict],
    tools: list[dict] | None = None,
    model: str | None = None,
) -> dict:
    """
    Single non-streaming chat call via /api/chat.
    Returns the full response dict including tool_calls if present.
    """
    target = model or settings.OLLAMA_DEFAULT_MODEL
    payload: dict[str, Any] = {
        "model": target,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.2, "top_p": 0.9, "num_ctx": 8192},
    }
    if tools:
        payload["tools"] = tools

    async with httpx.AsyncClient(timeout=TOOL_TIMEOUT) as client:
        resp = await client.post(f"{settings.OLLAMA_HOST}/api/chat", json=payload)
        resp.raise_for_status()
        return resp.json()


async def stream_chat_text(
    messages: list[dict],
    model: str | None = None,
) -> AsyncIterator[str]:
    """Stream text chunks from /api/chat (final answer, no tools)."""
    target = model or settings.OLLAMA_DEFAULT_MODEL
    payload = {
        "model": target,
        "messages": messages,
        "stream": True,
        "options": {"temperature": 0.3, "top_p": 0.9, "num_ctx": 8192},
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        async with client.stream("POST", f"{settings.OLLAMA_HOST}/api/chat", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                chunk = data.get("message", {}).get("content", "")
                if chunk:
                    yield chunk
                if data.get("done"):
                    return


async def check_ollama_health() -> tuple[bool, list[str]]:
    try:
        return True, await list_models()
    except Exception:
        return False, []
