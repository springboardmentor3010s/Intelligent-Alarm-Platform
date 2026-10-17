# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
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


# ---------------------------------------------------------------------------
# Push delivery configuration
# ---------------------------------------------------------------------------

_PUSH_PROVIDERS = {"noop", "expo"}


def get_push_provider() -> str:
    """Return the selected push provider name (default ``noop``).

    ``expo`` enables real FCM/APNs delivery through Expo's push relay. Any
    unknown value is rejected in production (fail fast) and falls back to
    ``noop`` in development.
    """
    name = os.getenv("PUSH_PROVIDER", "noop").strip().lower() or "noop"
    if name not in _PUSH_PROVIDERS:
        if is_production():
            raise RuntimeError(
                f"PUSH_PROVIDER={name!r} is not a supported provider "
                f"({sorted(_PUSH_PROVIDERS)})."
            )
        return "noop"
    return name


def get_expo_access_token() -> str:
    """Return the Expo push access token (empty = unauthenticated push)."""
    return os.getenv("EXPO_ACCESS_TOKEN", "").strip()


def get_push_expo_url() -> str:
    """Return the Expo push service endpoint (overridable for testing)."""
    return (
        os.getenv("PUSH_EXPO_URL", "https://exp.host/--/api/v2/push/send").strip()
        or "https://exp.host/--/api/v2/push/send"
    )


# ---------------------------------------------------------------------------
# MongoDB secondary event log (optional)
# ---------------------------------------------------------------------------


def get_mongodb_uri() -> str:
    """Return the MongoDB connection URI, or "" when the event log is disabled.

    Empty (the default) means no MongoDB: the event store is a silent no-op, so
    PostgreSQL remains the only required datastore for a local-first run. Set
    ``MONGODB_URI`` (e.g. ``mongodb://mongo:27017`` for the bundled compose
    service, or a ``mongodb+srv://`` Atlas string) to enable event logging.
    """
    return os.getenv("MONGODB_URI", "").strip()


def get_mongodb_db_name() -> str:
    """Return the database the event log writes to (default ``cerebrokognit_events``)."""
    return os.getenv("MONGODB_DB", "cerebrokognit_events").strip() or "cerebrokognit_events"


# ---------------------------------------------------------------------------
# Google OAuth2 login (Module 1)
# ---------------------------------------------------------------------------


def get_google_client_id() -> str:
    """Return the Google OAuth client id (empty = OAuth login disabled)."""
    return os.getenv("GOOGLE_CLIENT_ID", "").strip()


def get_google_client_secret() -> str:
    """Return the Google OAuth client secret (empty = OAuth login disabled)."""
    return os.getenv("GOOGLE_CLIENT_SECRET", "").strip()


def get_google_redirect_uri() -> str:
    """Return the default OAuth redirect URI (optional server-side default)."""
    return os.getenv("GOOGLE_REDIRECT_URI", "").strip()


def get_google_mobile_client_id() -> str:
    """Return the public (iOS/Android) OAuth client id used by the native app.

    The native app proves identity with a PKCE flow and posts the resulting
    OIDC id_token; the backend only needs to verify its audience, so no secret
    is involved. Falls back to the web client id when unset.
    """
    return os.getenv("GOOGLE_MOBILE_CLIENT_ID", "").strip()


def get_google_id_token_audiences() -> List[str]:
    """Return the accepted id_token audiences (web + mobile client ids)."""
    return [cid for cid in (get_google_client_id(), get_google_mobile_client_id()) if cid]


def is_google_oauth_enabled() -> bool:
    """True when both Google OAuth credentials are configured.

    Config-gated: with no credentials the OAuth endpoints return 503, so the
    app runs (and is testable) without a Google Cloud project.
    """
    return bool(get_google_client_id() and get_google_client_secret())


# ---------------------------------------------------------------------------
# Adaptive difficulty RL bandit (Phase D)
# ---------------------------------------------------------------------------


def is_rl_bandit_enabled() -> bool:
    """True when the contextual bandit may blend into difficulty decisions.

    Config-gated (default off) so the deterministic rule/ML path is the
    default and tests stay stable; set ``RL_BANDIT_ENABLED=1`` to opt in.
    """
    return os.getenv("RL_BANDIT_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}


def get_rl_blend_ratio() -> float:
    """Fraction of recommendations the bandit may override (0..1, default 0.3)."""
    raw = os.getenv("RL_BLEND_RATIO", "").strip()
    try:
        value = float(raw) if raw else 0.3
    except ValueError:
        return 0.3
    return max(0.0, min(1.0, value))
