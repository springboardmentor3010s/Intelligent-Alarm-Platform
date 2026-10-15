from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import User, UserProfile
from app.core.config import settings
from app.core.security import (
    create_access_token, create_oauth_state_token, verify_oauth_state_token,
    create_oauth_signup_token, verify_oauth_signup_token,
)
from app.core.oauth import PROVIDERS, build_authorize_url, fetch_profile, is_configured
from app.schemas.schemas import OAuthCompleteRequest, TokenResponse

router = APIRouter(prefix="/auth/oauth", tags=["OAuth"])


@router.get("/providers")
def list_providers():
    """Lets the frontend know which social login buttons to show."""
    return {name: is_configured(name) for name in PROVIDERS}


@router.get("/{provider}/login")
def oauth_login(provider: str):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown OAuth provider")
    if not is_configured(provider):
        raise HTTPException(
            status_code=400,
            detail=f"{provider.title()} login is not configured on this server. "
                   f"Set {provider.upper()}_CLIENT_ID / {provider.upper()}_CLIENT_SECRET.",
        )
    state = create_oauth_state_token()
    return RedirectResponse(build_authorize_url(provider, state))


@router.get("/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    if provider not in PROVIDERS or not is_configured(provider):
        return RedirectResponse(f"{settings.FRONTEND_URL}/oauth/callback?error=provider_not_configured")
    if not verify_oauth_state_token(state):
        return RedirectResponse(f"{settings.FRONTEND_URL}/oauth/callback?error=invalid_state")

    try:
        profile = await fetch_profile(provider, code)
    except Exception:
        return RedirectResponse(f"{settings.FRONTEND_URL}/oauth/callback?error=oauth_exchange_failed")

    email = (profile.get("email") or "").strip().lower()
    if not email:
        return RedirectResponse(f"{settings.FRONTEND_URL}/oauth/callback?error=no_email_from_provider")

    user = (
        db.query(User)
        .filter(User.oauth_provider == provider, User.oauth_id == profile["provider_id"])
        .first()
    )
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            # Existing password account with a matching email — link this provider to it
            user.oauth_provider = provider
            user.oauth_id = profile["provider_id"]
            db.commit()
            db.refresh(user)
        else:
            # Brand-new identity — let the frontend collect a role before the account is created
            signup_token = create_oauth_signup_token(
                provider, profile["provider_id"], email,
                profile.get("name") or email.split("@")[0],
            )
            return RedirectResponse(f"{settings.FRONTEND_URL}/oauth/callback?signup_token={signup_token}")

    token = create_access_token({"sub": str(user.id)})
    return RedirectResponse(f"{settings.FRONTEND_URL}/oauth/callback?token={token}")


@router.post("/complete-registration", response_model=TokenResponse)
def complete_registration(data: OAuthCompleteRequest, db: Session = Depends(get_db)):
    """Finalizes a brand-new Google/GitHub sign-up once the user has picked a role."""
    payload = verify_oauth_signup_token(data.signup_token)
    if not payload:
        raise HTTPException(status_code=400, detail="Signup session expired. Please sign in again.")

    email = payload["email"]
    provider = payload["provider"]
    provider_id = payload["provider_id"]

    # Guard against a race: the email or provider identity may have been claimed meanwhile
    existing = db.query(User).filter(
        (User.email == email) |
        ((User.oauth_provider == provider) & (User.oauth_id == provider_id))
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists. Please sign in instead.")

    user = User(
        name=payload["name"],
        email=email,
        password_hash=None,
        role=data.role,
        oauth_provider=provider,
        oauth_id=provider_id,
    )
    db.add(user)
    db.flush()
    db.add(UserProfile(user_id=user.id))
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}
