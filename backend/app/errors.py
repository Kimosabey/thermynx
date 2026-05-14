"""
Typed exception hierarchy for Graylinx.

Raising an AppError subclass anywhere in the stack produces a clean
HTTP response with a user-facing message and request_id — no stack
traces ever reach the client.

Usage:
    from app.errors import OllamaUnavailableError
    raise OllamaUnavailableError()

    # or override the message:
    raise NotFoundError(f"Equipment '{eq_id}' not found")
"""


class AppError(Exception):
    status_code: int = 500
    default_detail: str = "An unexpected error occurred."

    def __init__(self, detail: str | None = None):
        self.detail = detail or self.__class__.default_detail
        super().__init__(self.detail)


# ── 4xx ──────────────────────────────────────────────────────────────────────

class NotFoundError(AppError):
    status_code   = 404
    default_detail = "Resource not found."


class ValidationError(AppError):
    status_code   = 400
    default_detail = "Invalid request."


class RateLimitError(AppError):
    status_code   = 429
    default_detail = "Too many requests — slow down and try again."


# ── 5xx ──────────────────────────────────────────────────────────────────────

class OllamaUnavailableError(AppError):
    status_code   = 502
    default_detail = "LLM service is currently unavailable. Try again in a moment."


class TelemetryUnavailableError(AppError):
    status_code   = 502
    default_detail = "Telemetry database is unreachable."


class EmbeddingError(AppError):
    status_code   = 502
    default_detail = "Embedding service failed. Check that nomic-embed-text is loaded on the Ollama box."
