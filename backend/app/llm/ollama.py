import json
import time
from typing import AsyncIterator, Any

import httpx

from app.config import settings
from app.errors import OllamaUnavailableError
from app.log import get_logger
from app.observability.context import current_request_id

log = get_logger("llm.ollama")


# ── Circuit breaker (Reliability R1) ─────────────────────────────────────────
# After N failures within WINDOW seconds, the breaker opens and short-circuits
# all Ollama calls for COOLDOWN seconds. Prevents request pile-up during an
# Ollama outage (each call would otherwise wait for the full timeout).

_CB_FAILURE_THRESHOLD = 3        # failures in the window to trip
_CB_FAILURE_WINDOW_S  = 30.0     # rolling window for counting failures
_CB_COOLDOWN_S        = 60.0     # how long the breaker stays open

_cb_failures: list[float] = []   # timestamps of recent failures
_cb_open_until: float = 0.0       # epoch seconds; 0 = closed


def _circuit_open_remaining() -> float:
    """Return seconds remaining if the breaker is open, else 0."""
    now = time.monotonic()
    return _cb_open_until - now if _cb_open_until > now else 0.0


def _circuit_check() -> None:
    """Raise OllamaUnavailableError immediately if the breaker is open."""
    remaining = _circuit_open_remaining()
    if remaining > 0:
        raise OllamaUnavailableError(
            f"Ollama temporarily unavailable (circuit breaker open, "
            f"retry in {remaining:.0f}s)."
        )


def _circuit_record_failure() -> None:
    """Note one failure; trip the breaker if threshold reached in the window."""
    global _cb_open_until
    now = time.monotonic()
    cutoff = now - _CB_FAILURE_WINDOW_S
    _cb_failures[:] = [t for t in _cb_failures if t >= cutoff]
    _cb_failures.append(now)
    if len(_cb_failures) >= _CB_FAILURE_THRESHOLD:
        _cb_open_until = now + _CB_COOLDOWN_S
        log.warning(
            "ollama_circuit_open failures=%s window_s=%s cooldown_s=%s",
            len(_cb_failures), _CB_FAILURE_WINDOW_S, _CB_COOLDOWN_S,
        )


def _circuit_record_success() -> None:
    """Clear failure history on a successful call (closes the breaker if open)."""
    global _cb_open_until
    if _cb_failures or _cb_open_until:
        _cb_failures.clear()
        _cb_open_until = 0.0


def circuit_state() -> dict[str, Any]:
    """Expose breaker state for /health and debugging."""
    return {
        "open":               _circuit_open_remaining() > 0,
        "open_seconds_left":  round(_circuit_open_remaining(), 1),
        "recent_failures":    len(_cb_failures),
        "threshold":          _CB_FAILURE_THRESHOLD,
        "window_seconds":     _CB_FAILURE_WINDOW_S,
    }


def _stream_timeout() -> httpx.Timeout:
    return httpx.Timeout(settings.OLLAMA_STREAM_TIMEOUT_S, connect=10.0)


def _chat_timeout() -> httpx.Timeout:
    return httpx.Timeout(settings.OLLAMA_CHAT_TIMEOUT_S, connect=10.0)


def _correlation_headers() -> dict[str, str]:
    """Forward the current request's correlation ID to Ollama so its access
    logs (if forwarded into Loki) can be joined back to backend traces."""
    rid = current_request_id.get()
    return {"X-Request-Id": rid} if rid else {}


async def list_models() -> list[str]:
    _circuit_check()
    try:
        async with httpx.AsyncClient(timeout=_stream_timeout(), headers=_correlation_headers()) as client:
            resp = await client.get(f"{settings.OLLAMA_HOST}/api/tags")
            resp.raise_for_status()
            raw = resp.json().get("models", [])
    except httpx.TimeoutException as e:
        _circuit_record_failure()
        raise OllamaUnavailableError("Ollama did not respond in time.") from e
    except httpx.HTTPStatusError as e:
        _circuit_record_failure()
        raise OllamaUnavailableError(
            "Ollama returned an HTTP error while listing models."
        ) from e
    except httpx.RequestError as e:
        _circuit_record_failure()
        raise OllamaUnavailableError(
            f"Cannot connect to Ollama at {settings.OLLAMA_HOST}."
        ) from e

    _circuit_record_success()
    log.debug("ollama_list_models count=%s request_id=%s", len(raw), current_request_id.get())
    return [m["name"] for m in raw]


async def stream_generate(
    prompt: str,
    model: str | None = None,
    *,
    temperature: float = 0.3,
    num_predict: int | None = None,
) -> AsyncIterator[str]:
    """Yield text chunks via /api/generate (prompt-based, no tool support).

    num_predict: hard cap on generated tokens. None = model default (~unbounded).
    """
    target = model or settings.OLLAMA_DEFAULT_MODEL
    log.debug(
        "stream_generate_start model=%s prompt_chars=%s num_predict=%s request_id=%s",
        target, len(prompt), num_predict, current_request_id.get(),
    )
    options: dict[str, Any] = {"temperature": temperature, "top_p": 0.9, "num_ctx": 8192}
    if num_predict is not None and num_predict > 0:
        options["num_predict"] = num_predict
    payload = {
        "model": target,
        "prompt": prompt,
        "stream": True,
        "options": options,
    }
    _circuit_check()
    try:
        async with httpx.AsyncClient(timeout=_stream_timeout(), headers=_correlation_headers()) as client:
            async with client.stream(
                "POST", f"{settings.OLLAMA_HOST}/api/generate", json=payload
            ) as resp:
                try:
                    resp.raise_for_status()
                except httpx.TimeoutException as e:
                    _circuit_record_failure()
                    raise OllamaUnavailableError("Ollama generate request timed out.") from e
                except httpx.HTTPStatusError as e:
                    _circuit_record_failure()
                    raise OllamaUnavailableError(
                        "Ollama returned an error during generate."
                    ) from e

                # Stream opened OK — count as success even if it errors mid-stream.
                # Mid-stream tear-downs are a different failure mode than connection-level.
                _circuit_record_success()

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
        _circuit_record_failure()
        raise OllamaUnavailableError(
            f"Cannot connect to Ollama at {settings.OLLAMA_HOST}."
        ) from e


async def chat(
    messages: list[dict],
    tools: list[dict] | None = None,
    model: str | None = None,
    *,
    temperature: float = 0.0,
    num_predict: int | None = None,
) -> dict:
    """
    Single non-streaming chat call via /api/chat.
    Returns the full response dict including tool_calls if present.
    temperature=0.0 default: tool-selection steps should be deterministic.
    """
    target = model or settings.OLLAMA_DEFAULT_MODEL
    opts: dict[str, Any] = {"temperature": temperature, "top_p": 0.9, "num_ctx": 8192}
    if num_predict is not None and num_predict > 0:
        opts["num_predict"] = num_predict
    payload: dict[str, Any] = {
        "model": target,
        "messages": messages,
        "stream": False,
        "options": opts,
    }
    if tools:
        payload["tools"] = tools

    _circuit_check()
    async with httpx.AsyncClient(timeout=_chat_timeout(), headers=_correlation_headers()) as client:
        try:
            resp = await client.post(f"{settings.OLLAMA_HOST}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
        except httpx.TimeoutException as e:
            _circuit_record_failure()
            raise OllamaUnavailableError("Ollama chat request timed out.") from e
        except httpx.HTTPStatusError as e:
            _circuit_record_failure()
            raise OllamaUnavailableError(
                "Ollama returned an error for the chat request."
            ) from e
        except httpx.RequestError as e:
            _circuit_record_failure()
            raise OllamaUnavailableError(
                f"Cannot connect to Ollama at {settings.OLLAMA_HOST}."
            ) from e
    _circuit_record_success()

    log.debug(
        "chat_done model=%s has_tools=%s msg_chars=%s request_id=%s",
        target,
        bool(tools),
        len((data.get("message") or {}).get("content") or ""),
        current_request_id.get(),
    )
    return data


async def stream_chat_text(
    messages: list[dict],
    model: str | None = None,
    *,
    temperature: float = 0.3,
    num_predict: int | None = None,
) -> AsyncIterator[str]:
    """Stream text chunks from /api/chat (final answer, no tools)."""
    target = model or settings.OLLAMA_DEFAULT_MODEL
    log.debug(
        "stream_chat_text_start model=%s messages=%s num_predict=%s request_id=%s",
        target, len(messages), num_predict, current_request_id.get(),
    )
    options: dict[str, Any] = {"temperature": temperature, "top_p": 0.9, "num_ctx": 8192}
    if num_predict is not None and num_predict > 0:
        options["num_predict"] = num_predict
    payload = {
        "model": target,
        "messages": messages,
        "stream": True,
        "options": options,
    }
    _circuit_check()
    async with httpx.AsyncClient(timeout=_stream_timeout(), headers=_correlation_headers()) as client:
        try:
            async with client.stream("POST", f"{settings.OLLAMA_HOST}/api/chat", json=payload) as resp:
                resp.raise_for_status()
                _circuit_record_success()
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
            _circuit_record_failure()
            raise OllamaUnavailableError("Ollama stream request timed out.") from e
        except httpx.HTTPStatusError as e:
            _circuit_record_failure()
            raise OllamaUnavailableError("Ollama returned an error during streaming.") from e
        except httpx.RequestError as e:
            _circuit_record_failure()
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
