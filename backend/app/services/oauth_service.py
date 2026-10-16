# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Google OAuth 2.0 (Authorization Code) login — Module 1.

Implements the free, industry-standard "Sign in with Google" flow:

1. `build_authorization_url` mints a short-lived signed **state** (CSRF) and
   returns the Google consent URL.
2. `authenticate` exchanges the returned `code` for tokens, verifies the
   OpenID Connect ID token (signature + audience + issuer + expiry via
   ``google-auth``), then links or creates the local user.

Config-gated by ``GOOGLE_CLIENT_ID`` / ``GOOGLE_CLIENT_SECRET``: with no
credentials the endpoints return 503 and nothing else changes, so the platform
runs and is fully testable without a Google Cloud project. The two network-
boundary helpers (`_exchange_code`, `_verify_id_token`) are isolated so tests
can monkeypatch them instead of hitting Google.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from uuid import uuid4

import jwt
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..Models import User
from ..core import config
from ..services.auth import AuthService

logger = logging.getLogger("auth.oauth")

PROVIDER = "google"
GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
_STATE_TTL = timedelta(minutes=10)


class GoogleOAuthService:
    """Google Authorization Code flow against the local user store."""

    @staticmethod
    def is_configured() -> bool:
        return config.is_google_oauth_enabled()

    @staticmethod
    def _require_configured() -> None:
        if not GoogleOAuthService.is_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google OAuth is not configured on this server",
            )

    # ------------------------------------------------------------------
    # State (CSRF) — signed, short-lived, no server-side storage
    # ------------------------------------------------------------------

    @staticmethod
    def _create_state(redirect_uri: str) -> str:
        now = datetime.now(timezone.utc)
        payload = {
            "type": "oauth_state",
            "redirect_uri": redirect_uri,
            "iat": now,
            "exp": now + _STATE_TTL,
            "jti": uuid4().hex,
        }
        return jwt.encode(payload, AuthService._secret_key(), algorithm=AuthService.ALGORITHM)

    @staticmethod
    def _verify_state(state: str, redirect_uri: str) -> bool:
        try:
            payload = jwt.decode(
                state, AuthService._secret_key(), algorithms=[AuthService.ALGORITHM]
            )
        except jwt.PyJWTError:
            return False
        if payload.get("type") != "oauth_state":
            return False
        # Bind the state to the redirect URI it was minted for.
        return payload.get("redirect_uri") == redirect_uri

    # ------------------------------------------------------------------
    # Step 1 — authorization URL
    # ------------------------------------------------------------------

    @staticmethod
    def build_authorization_url(redirect_uri: str) -> dict:
        GoogleOAuthService._require_configured()
        if not redirect_uri:
            raise HTTPException(status_code=400, detail="redirect_uri is required")
        state = GoogleOAuthService._create_state(redirect_uri)
        params = {
            "client_id": config.get_google_client_id(),
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "online",
            "prompt": "select_account",
        }
        return {
            "authorization_url": f"{GOOGLE_AUTH_ENDPOINT}?{urlencode(params)}",
            "state": state,
        }

    # ------------------------------------------------------------------
    # Step 2 — network boundary (isolated for testability)
    # ------------------------------------------------------------------

    @staticmethod
    def _exchange_code(code: str, redirect_uri: str) -> dict:
        """Exchange the authorization code for tokens at Google."""
        import httpx

        try:
            resp = httpx.post(
                GOOGLE_TOKEN_ENDPOINT,
                data={
                    "code": code,
                    "client_id": config.get_google_client_id(),
                    "client_secret": config.get_google_client_secret(),
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
                timeout=10.0,
            )
        except Exception as exc:  # network failure -> auth failure, never a 500
            logger.warning("oauth.token_exchange_failed error=%s", exc)
            raise HTTPException(status_code=502, detail="Google token exchange unavailable")
        if resp.status_code != 200:
            logger.warning("oauth.token_exchange_rejected status=%s", resp.status_code)
            raise HTTPException(status_code=401, detail="Google token exchange failed")
        return resp.json()

    @staticmethod
    def _verify_id_token(id_token: str, audience=None) -> dict:
        """Verify the OIDC ID token (signature, audience, issuer, expiry).

        `audience` may be a single client id or a list; it defaults to every
        configured Google client id (web + mobile) so both flows are accepted.
        """
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token

        audiences = audience or config.get_google_id_token_audiences() or config.get_google_client_id()
        try:
            claims = google_id_token.verify_oauth2_token(
                id_token, google_requests.Request(), audiences
            )
        except Exception as exc:
            logger.warning("oauth.id_token_invalid error=%s", exc)
            raise HTTPException(status_code=401, detail="Invalid Google identity token")
        return claims

    # ------------------------------------------------------------------
    # Step 3 — link or create the local user
    # ------------------------------------------------------------------

    @staticmethod
    def _link_or_create_user(db: Session, claims: dict) -> User:
        subject = str(claims.get("sub") or "").strip()
        email = str(claims.get("email") or "").strip().lower()
        if not subject or not email:
            raise HTTPException(status_code=401, detail="Google account has no usable identity")

        # 1) Existing OAuth link
        user = (
            db.query(User)
            .filter(User.oauth_provider == PROVIDER, User.oauth_subject == subject)
            .first()
        )
        if user is not None:
            return user

        # 2) Existing password account with the same email -> link it
        user = db.query(User).filter(User.email == email).first()
        if user is not None:
            user.oauth_provider = PROVIDER
            user.oauth_subject = subject
            if claims.get("email_verified") and not user.is_verified:
                user.is_verified = True
            db.flush()
            return user

        # 3) New account (no local password; Google verified the address)
        user = User(
            email=email,
            full_name=claims.get("name") or None,
            hashed_password=None,
            oauth_provider=PROVIDER,
            oauth_subject=subject,
            is_verified=bool(claims.get("email_verified", True)),
            is_active=True,
        )
        db.add(user)
        db.flush()

        # Assign the default "User" role
        from ..api.deps import get_or_create_role
        from ..Models import UserRole

        role = get_or_create_role(db, "User", "Standard registered user")
        db.add(UserRole(user_id=user.id, role_id=role.id))
        db.flush()
        return user

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    @staticmethod
    def authenticate(
        db: Session, code: str, redirect_uri: str, state: str
    ) -> User:
        """Complete the flow: verify state, exchange code, verify token, link user."""
        GoogleOAuthService._require_configured()

        if not GoogleOAuthService._verify_state(state, redirect_uri):
            raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

        token_data = GoogleOAuthService._exchange_code(code, redirect_uri)
        id_token = token_data.get("id_token")
        if not id_token:
            raise HTTPException(status_code=401, detail="Google did not return an identity token")

        claims = GoogleOAuthService._verify_id_token(id_token)
        user = GoogleOAuthService._link_or_create_user(db, claims)
        return user

    @staticmethod
    def authenticate_id_token(db: Session, id_token: str) -> User:
        """Complete a native-app login from a Google OIDC id_token.

        The mobile client is a public (PKCE) client and cannot hold a secret,
        so it proves identity with an id_token. We verify it exactly as in the
        code flow (signature, audience, issuer, expiry) and link/create the user.
        """
        GoogleOAuthService._require_configured()
        if not id_token or not id_token.strip():
            raise HTTPException(status_code=400, detail="id_token is required")

        claims = GoogleOAuthService._verify_id_token(id_token)
        return GoogleOAuthService._link_or_create_user(db, claims)
