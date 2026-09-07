"""Centralized structured logging configuration for the API Gateway."""

import logging
import os
import sys

_configured = False

FIELDS = "%(asctime)s %(levelname)s [%(name)s] %(message)s"


def configure_logging() -> None:
    """Idempotent console logging config honoring LOG_LEVEL env."""
    global _configured
    if _configured:
        return
    level = os.getenv("LOG_LEVEL", "INFO").upper()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(FIELDS))
    root = logging.getLogger()
    root.setLevel(level)
    root.addHandler(handler)
    # Keep uvicorn access logs out of the picture (we log our own request lines).
    logging.getLogger("uvicorn.access").disabled = True
    _configured = True
