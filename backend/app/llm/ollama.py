import json
from typing import AsyncIterator, Any

import httpx

from app.config import settings
from app.errors import OllamaUnavailableError
from app.log import get_logger

log = get_logger("llm.ollama")

TIMEOUT      = httpx.Timeout(120.0, connect=10.0)
TOOL_TIMEOUT = httpx.Timeout(60.0,  connect=10.0)



async def list_models() -> list[str]:
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(f"{settings.OLLAMA_HOST}/api/tags")
            resp.raise_for_status()
            raw = resp.json().get("models", [])
    except httpx.TimeoutException as e:
        raise OllamaUnavailableError("Ollama did not respond in time.") from e
    except httpx.HTTPStatusError as e:
        raise OllamaUnavailableError(
            "Ollama returned an HTTP error while listing models."
        ) from e
    except httpx.RequestError as e:
        raise OllamaUnavailableError(
            f"Cannot connect to Ollama at {settings.OLLAMA_HOST}."
        ) from e

    log.debug("ollama_list_models count=%s", len(raw))
    return [m["name"] for m in raw]


async def stream_generate(prompt: str, model: str | None = None) -> AsyncIterator[str]:
    """Yield text chunks via /api/generate (prompt-based, no tool support)."""
    target = model or settings.OLLAMA_DEFAULT_MODEL
    log.debug("stream_generate_start model=%s prompt_chars=%s", target, len(prompt))
    payload = {
        "model": target,
        "prompt": prompt,
        "stream": True,
        "options": {"temperature": 0.3, "top_p": 0.9, "num_ctx": 8192},
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            async with client.stream(
                "POST", f"{settings.OLLAMA_HOST}/api/generate", json=payload
            ) as resp:
                try:
                    resp.raise_for_status()
                except httpx.TimeoutException as e:
                    raise OllamaUnavailableError("Ollama generate request timed out.") from e
                except httpx.HTTPStatusError as e:
                    raise OllamaUnavailableError(
                        "Ollama returned an error during generate."
                    ) from e

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
    except httpx.RequestError as e:
        raise OllamaUnavailableError(
            f"Cannot connect to Ollama at {settings.OLLAMA_HOST}."
        ) from e


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
        try:
            resp = await client.post(f"{settings.OLLAMA_HOST}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
        except httpx.TimeoutException as e:
            raise OllamaUnavailableError("Ollama chat request timed out.") from e
        except httpx.HTTPStatusError as e:
            raise OllamaUnavailableError(
                "Ollama returned an error for the chat request."
            ) from e
        except httpx.RequestError as e:
            raise OllamaUnavailableError(
                f"Cannot connect to Ollama at {settings.OLLAMA_HOST}."
            ) from e

    log.debug(
        "chat_done model=%s has_tools=%s msg_chars=%s",
        target,
        bool(tools),
        len((data.get("message") or {}).get("content") or ""),
    )
    return data


async def stream_chat_text(
    messages: list[dict],
    model: str | None = None,
) -> AsyncIterator[str]:
    """Stream text chunks from /api/chat (final answer, no tools)."""
    target = model or settings.OLLAMA_DEFAULT_MODEL
    log.debug("stream_chat_text_start model=%s messages=%s", target, len(messages))
    payload = {
        "model": target,
        "messages": messages,
        "stream": True,
        "options": {"temperature": 0.3, "top_p": 0.9, "num_ctx": 8192},
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
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
        except httpx.TimeoutException as e:
            raise OllamaUnavailableError("Ollama stream request timed out.") from e
        except httpx.HTTPStatusError as e:
            raise OllamaUnavailableError("Ollama returned an error during streaming.") from e
        except httpx.RequestError as e:
            raise OllamaUnavailableError(
                f"Cannot connect to Ollama at {settings.OLLAMA_HOST}."
            ) from e


async def check_ollama_health() -> tuple[bool, list[str]]:
    try:
        models = await list_models()
        return True, models
    except OllamaUnavailableError:
        return False, []
    except Exception as e:
        log.warning("ollama_health_check_failed host=%s err=%s", settings.OLLAMA_HOST, e)
        return False, []
