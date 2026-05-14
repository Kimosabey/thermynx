"""Namespaced application loggers — all under ``graylinx.*``."""

import logging


def get_logger(name: str) -> logging.Logger:
    """Return ``logging.getLogger(f\"graylinx.{name}\")``."""
    return logging.getLogger(f"graylinx.{name}")
