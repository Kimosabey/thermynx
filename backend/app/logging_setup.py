"""Central logging configuration for uvicorn + thermynx.* hierarchy.

Namespaces in use:
  thermynx.app          — lifespan / startup
  thermynx.access       — HTTP access (method path status ms request_id)
  thermynx.api.*        — route modules (analyzer, agent, health, reports, threads, …)
  thermynx.llm.ollama   — Ollama HTTP client
  thermynx.services.agent — ReAct agent loop
  thermynx.domain.tools — agent tool execution
  thermynx.jobs.anomaly_scan — scheduled anomaly job

Add ``from app.log import get_logger`` and ``log = get_logger("api.mymodule")`` in new code.

Output destinations:
  - stdout (always)            — captured by uvicorn / docker
  - rotating file (optional)   — when ``LOG_FILE`` is set, also writes structured JSON
                                  to that path. Used by Promtail to ship logs into Loki
                                  when the backend runs outside Docker (uvicorn on host).
"""

from __future__ import annotations

import json
import logging
import logging.handlers
import os
import sys
from datetime import datetime, timezone
from typing import Any

from app.config import settings


class JsonFormatter(logging.Formatter):
    """One JSON object per line (structured logs for collectors)."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def _resolve_level(name: str) -> int:
    return getattr(logging, name.upper(), logging.INFO)


def configure_logging() -> None:
    """
    Attach handlers to ``thermynx`` (non-propagating).
    Child loggers ``thermynx.api``, ``thermynx.llm``, etc. propagate into it.
    Aligns uvicorn log levels with ``LOG_LEVEL``.

    Handlers:
      - StreamHandler(stdout)                   — always
      - RotatingFileHandler(settings.LOG_FILE)  — only if LOG_FILE is set
    """
    level = _resolve_level(settings.LOG_LEVEL)

    if settings.LOG_JSON:
        stdout_formatter: logging.Formatter = JsonFormatter()
    else:
        stdout_formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-5s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    tnx = logging.getLogger("thermynx")
    tnx.handlers.clear()

    # stdout handler — human-readable or JSON depending on LOG_JSON
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setLevel(level)
    stdout_handler.setFormatter(stdout_formatter)
    tnx.addHandler(stdout_handler)

    # File handler — always structured JSON (for Loki ingestion via Promtail)
    if settings.LOG_FILE:
        try:
            log_dir = os.path.dirname(settings.LOG_FILE) or "."
            os.makedirs(log_dir, exist_ok=True)
            file_handler = logging.handlers.RotatingFileHandler(
                settings.LOG_FILE,
                maxBytes=settings.LOG_FILE_MAX_BYTES,
                backupCount=settings.LOG_FILE_BACKUP_COUNT,
                encoding="utf-8",
            )
            file_handler.setLevel(level)
            file_handler.setFormatter(JsonFormatter())  # file is always JSON
            tnx.addHandler(file_handler)
        except OSError as e:
            # File logging is best-effort — never crash the app over it.
            stdout_handler.setLevel(level)
            logging.getLogger("thermynx.app").warning(
                "log_file_setup_failed path=%s err=%s", settings.LOG_FILE, e
            )

    tnx.setLevel(level)
    tnx.propagate = False

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"):
        logging.getLogger(name).setLevel(level)

    if settings.LOG_LEVEL.upper() == "DEBUG":
        logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)
