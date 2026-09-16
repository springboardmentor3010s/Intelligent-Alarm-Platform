"""Centralized environment configuration (Phase 2 hardening).

Every security-sensitive value lives here so startup can fail fast instead of
implicitly trusting unsafe defaults:

- `SECRET_KEY` must be a real value in production; a missing/placeholder key is
  rejected with a `RuntimeError` at import/first-use time.
- `CORS_ORIGINS` becomes an explicit allowlist; the wildcard fallback
  (`["*"]` + `allow_credentials`) is removed entirely.

Values are read on every call (never cached at import) so the behavior is
deterministic and easy to assert in tests via monkeypatching.
"""

import os
from typing import List

# The placeholder shipped in .env.example / docker-compose for local dev. It must
# never be accepted when ENVIRONMENT=production.
PLACEHOLDER_SECRET = "change_this_to_a_very_random_secret_key_min_32_bytes"

# Local-development CORS allowlist used only when ENVIRONMENT is not production.
# Deliberately explicit (never a wildcard) so credentials-based requests stay safe.
DEV_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
]

_PROD_ENVIRONMENTS = {"production", "prod"}


def environment() -> str:
    """Return the runtime environment name, defaulting to development."""
    return os.getenv("ENVIRONMENT", "development").strip().lower() or "development"


def is_production() -> bool:
    """True when the process is running in a production environment."""
    return environment() in _PROD_ENVIRONMENTS


def get_secret_key() -> str:
    """Return the JWT signing secret, failing fast in production.

    In development the placeholder from .env.example is tolerated (local dev
    convenience). In production a missing or placeholder secret raises so an
    unsafe default can never sign real tokens.
    """
    key = os.getenv("SECRET_KEY", "").strip()
    if not key or key == PLACEHOLDER_SECRET:
        if is_production():
            raise RuntimeError(
                "SECRET_KEY is missing or set to the placeholder value. "
                "Generate a strong random secret and set SECRET_KEY before "
                "starting the production server."
            )
        return PLACEHOLDER_SECRET
    return key


def get_cors_origins() -> List[str]:
    """Return the explicit CORS allowlist from CORS_ORIGINS (comma-separated).

    Production fails fast when the allowlist is empty; development falls back to
    the local dev origins. A wildcard is never returned.
    """
    raw = os.getenv("CORS_ORIGINS", "")
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    if not origins:
        if is_production():
            raise RuntimeError(
                "CORS_ORIGINS is empty. Configure an explicit allowlist of "
                "trusted origins before starting the production server."
            )
        origins = list(DEV_CORS_ORIGINS)
    return origins
