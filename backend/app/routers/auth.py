"""Registration, login (with role portals), refresh-token rotation, logout."""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.ratelimit import client_ip, limit
from app.core.security import (create_access_token, hash_password, hash_token, new_refresh_token,
                               password_problem, verify_password)
from app.core.timeutil import utcnow
from app.models import RefreshToken, User, UserProfile
from app.schemas import LoginIn, RegisterIn
from app.services.notify import audit, notify
from app.views import user_view

router = APIRouter(prefix="/auth", tags=["Authentication"])
COOKIE = "refresh_token"
PORTALS = {"user": {"member"}, "wellness_coach": {"member", "coach"}, "admin": {"member", "admin"}}
_DUMMY_HASH = hash_password("dummy-password-for-timing-1")  # equalises timing for unknown emails


def set_refresh_cookie(response: Response, raw: str) -> None:
    response.set_cookie(COOKIE, raw, max_age=settings.REFRESH_TOKEN_DAYS * 86400, httponly=True,
                        secure=settings.COOKIE_SECURE, samesite="strict", path=settings.COOKIE_PATH)


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE, path=settings.COOKIE_PATH)


def issue_session(db: Session, user: User, request: Request, response: Response) -> dict:
    raw, hashed = new_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=hashed, user_agent=(request.headers.get("user-agent") or "")[:200],
                        expires_at=utcnow() + timedelta(days=settings.REFRESH_TOKEN_DAYS)))
    user.last_login_at = utcnow()
    db.commit()
    set_refresh_cookie(response, raw)
    return {"access_token": create_access_token(str(user.id), user.role), "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_MINUTES * 60, "user": user_view(user)}


def create_user(db: Session, full_name: str, email: str, password: str | None, coach: bool = False,
                oauth: tuple[str, str] | None = None) -> User:
    user = User(full_name=full_name, email=email.lower(), hashed_password=hash_password(password) if password else None,
                coach_requested=coach)
    if oauth:
        user.oauth_provider, user.oauth_sub = oauth
    user.profile = UserProfile()
    db.add(user)
    db.flush()
    if coach:
        for admin in db.query(User).filter(User.role == "admin", User.is_active.is_(True)).all():
            notify(db, admin.id, "announcement", "Coach approval requested",
                   f"{full_name} ({user.email}) applied to become a Wellness Coach.")
    return user


@router.post("/register", status_code=201, dependencies=[Depends(limit("register", 5, 600))])
def register(payload: RegisterIn, request: Request, response: Response, db: Session = Depends(get_db)):
    problem = password_problem(payload.password)
    if problem:
        raise HTTPException(422, problem)
    if db.query(User.id).filter(User.email == payload.email.lower()).first():
        raise HTTPException(409, "An account with this email already exists.")
    user = create_user(db, payload.full_name, payload.email, payload.password, coach=payload.account_type == "coach")
    audit(db, "register", user, ip=client_ip(request), detail=f"account_type={payload.account_type}")
    return issue_session(db, user, request, response)


@router.post("/login", dependencies=[Depends(limit("login", 15, 60))])
def login(payload: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    ip, now = client_ip(request), utcnow()
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user:
        verify_password(payload.password, _DUMMY_HASH)
        audit(db, "login_failed", target=payload.email.lower()[:120], ip=ip, detail="unknown email")
        db.commit()
        raise HTTPException(401, "Invalid email or password.")
    if user.locked_until and user.locked_until > now:
        mins = int((user.locked_until - now).total_seconds() // 60) + 1
        raise HTTPException(429, f"Too many failed attempts. Try again in {mins} minute(s).")
    if not verify_password(payload.password, user.hashed_password):
        user.failed_logins += 1
        detail = f"attempt {user.failed_logins}"
        if user.failed_logins >= settings.MAX_FAILED_LOGINS:
            user.locked_until, user.failed_logins = now + timedelta(minutes=settings.LOCKOUT_MINUTES), 0
            detail = "account locked"
        audit(db, "login_failed", user, ip=ip, detail=detail)
        db.commit()
        raise HTTPException(401, "Invalid email or password.")
    if not user.is_active:
        raise HTTPException(403, "This account has been deactivated. Contact an administrator.")
    if payload.portal and payload.portal not in PORTALS.get(user.role, set()):
        audit(db, "login_wrong_portal", user, ip=ip, detail=f"portal={payload.portal}")
        db.commit()
        raise HTTPException(403, f"This account doesn't have access to the {payload.portal} portal.")
    user.failed_logins, user.locked_until = 0, None
    audit(db, "login", user, ip=ip)
    return issue_session(db, user, request, response)


@router.post("/refresh", dependencies=[Depends(limit("refresh", 60, 60))])
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    if request.headers.get("x-requested-with") != "XMLHttpRequest":
        raise HTTPException(403, "Missing required header.")
    raw = request.cookies.get(COOKIE)
    if not raw:
        raise HTTPException(401, "No session.")
    row = db.query(RefreshToken).filter(RefreshToken.token_hash == hash_token(raw)).first()
    if not row:
        clear_refresh_cookie(response)
        raise HTTPException(401, "Invalid session.")
    if row.revoked_at is not None:
        # A revoked token being replayed means it may have been stolen: kill every session for this user.
        for t in db.query(RefreshToken).filter(RefreshToken.user_id == row.user_id, RefreshToken.revoked_at.is_(None)):
            t.revoked_at = utcnow()
        audit(db, "refresh_token_reuse", detail=str(row.user_id), ip=client_ip(request))
        db.commit()
        clear_refresh_cookie(response)
        raise HTTPException(401, "Session expired. Please sign in again.")
    user = db.get(User, row.user_id)
    if row.expires_at < utcnow() or not user or not user.is_active:
        clear_refresh_cookie(response)
        raise HTTPException(401, "Session expired. Please sign in again.")
    row.revoked_at = utcnow()  # rotation: every refresh token is single-use
    return issue_session(db, user, request, response)


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    raw = request.cookies.get(COOKIE)
    if raw:
        row = db.query(RefreshToken).filter(RefreshToken.token_hash == hash_token(raw)).first()
        if row and row.revoked_at is None:
            row.revoked_at = utcnow()
            db.commit()
    clear_refresh_cookie(response)
    return {"ok": True}


@router.post("/logout-all")
def logout_all(response: Response, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for t in db.query(RefreshToken).filter(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)):
        t.revoked_at = utcnow()
    db.commit()
    clear_refresh_cookie(response)
    return {"ok": True}


@router.get("/providers")
def providers():
    return {"google": bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)}
