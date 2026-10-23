"""OAuth2 login with Google (authorization-code flow, CSRF-protected with a state cookie)."""
import hmac
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.ratelimit import client_ip
from app.core.security import new_refresh_token
from app.core.timeutil import utcnow
from app.models import RefreshToken, User
from app.routers.auth import create_user, set_refresh_cookie
from app.services.notify import audit
from datetime import timedelta

router = APIRouter(prefix="/auth/google", tags=["OAuth2"])
STATE_COOKIE = "oauth_state"


def _redirect_uri() -> str:
    return f"{settings.PUBLIC_URL.rstrip('/')}/api/auth/google/callback"


def exchange_code(code: str) -> dict:
    """Swap the authorization code for the user's verified Google profile (patched in tests)."""
    with httpx.Client(timeout=10) as c:
        tok = c.post("https://oauth2.googleapis.com/token", data={
            "code": code, "client_id": settings.GOOGLE_CLIENT_ID, "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": _redirect_uri(), "grant_type": "authorization_code"})
        tok.raise_for_status()
        info = c.get("https://openidconnect.googleapis.com/v1/userinfo",
                     headers={"Authorization": f"Bearer {tok.json()['access_token']}"})
        info.raise_for_status()
        return info.json()


@router.get("/login")
def google_login():
    if not (settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET):
        raise HTTPException(404, "Google sign-in is not configured.")
    state = secrets.token_urlsafe(24)
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode({
        "client_id": settings.GOOGLE_CLIENT_ID, "redirect_uri": _redirect_uri(), "response_type": "code",
        "scope": "openid email profile", "state": state, "prompt": "select_account"})
    resp = RedirectResponse(url)
    resp.set_cookie(STATE_COOKIE, state, max_age=600, httponly=True, secure=settings.COOKIE_SECURE,
                    samesite="lax", path=settings.COOKIE_PATH)
    return resp


@router.get("/callback")
def google_callback(request: Request, code: str = "", state: str = "", db: Session = Depends(get_db)):
    fail = RedirectResponse(f"{settings.PUBLIC_URL.rstrip('/')}/login?error=oauth")
    cookie_state = request.cookies.get(STATE_COOKIE, "")
    if not code or not state or not cookie_state or not hmac.compare_digest(state, cookie_state):
        return fail
    try:
        info = exchange_code(code)
    except Exception:
        return fail
    email, sub = (info.get("email") or "").lower(), str(info.get("sub") or "")
    if not email or not sub or not info.get("email_verified"):
        return fail
    user = db.query(User).filter(User.oauth_provider == "google", User.oauth_sub == sub).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user and user.oauth_provider is None:
            user.oauth_provider, user.oauth_sub = "google", sub  # link: Google verified this email
        elif user:
            return fail
        else:
            user = create_user(db, (info.get("name") or email.split("@")[0])[:120], email, None, oauth=("google", sub))
    if not user.is_active:
        return fail
    raw, hashed = new_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=hashed, expires_at=utcnow() + timedelta(days=settings.REFRESH_TOKEN_DAYS),
                        user_agent=(request.headers.get("user-agent") or "")[:200]))
    user.last_login_at = utcnow()
    audit(db, "login_oauth_google", user, ip=client_ip(request))
    db.commit()
    resp = RedirectResponse(f"{settings.PUBLIC_URL.rstrip('/')}/auth/callback")
    set_refresh_cookie(resp, raw)
    resp.delete_cookie(STATE_COOKIE, path=settings.COOKIE_PATH)
    return resp
