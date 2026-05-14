"""Namespaced application loggers — all under ``thermynx.*``."""

import logging


def get_logger(name: str) -> logging.Logger:
    """Return ``logging.getLogger(f\"thermynx.{name}\")``."""
    return logging.getLogger(f"thermynx.{name}")
