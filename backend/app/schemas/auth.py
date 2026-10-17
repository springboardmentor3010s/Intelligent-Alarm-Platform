# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Pydantic v2 schemas for authentication module."""

from typing import Optional
from pydantic import BaseModel, Field, EmailStr


class AuthRegisterReq(BaseModel):
    """Request schema for user registration."""
    email: EmailStr = Field(..., description="User email (unique)")
    password: str = Field(..., min_length=8, description="Plaintext password (will be hashed)")
    full_name: Optional[str] = Field(None, description="Optional full name")
    timezone: str = Field("UTC", description="IANA time zone name, e.g. America/Los_Angeles")
    difficulty_preference: str = Field("Medium", description="Difficulty preference: Beginner/Easy/Medium/Hard/Expert")


class AuthLoginReq(BaseModel):
    """Request schema for user login."""
    email: EmailStr = Field(..., description="User email")
    password: str = Field(..., description="Plaintext password for verification")


class UserProfileRes(BaseModel):
    """Response schema for user profile."""
    id: int
    email: str
    full_name: Optional[str] = None
    timezone: str
    difficulty_preference: str
    is_active: bool
    is_verified: bool
    role: str = "User"  # most-privileged role: User / Wellness Coach / Administrator
    created_at: str  # datetime ISO format

    model_config = {"from_attributes": True}


class AuthRes(BaseModel):
    """Response schema for auth endpoints."""
    access_token: str = Field(description="JWT access token")
    refresh_token: str = Field(description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(description="Seconds until access token expiry")
    user: UserProfileRes


# ============================================================
# PHASE 2 SECURITY SCHEMAS
# ============================================================

class RefreshReq(BaseModel):
    """Request body for POST /auth/refresh."""
    refresh_token: str = Field(..., description="JWT refresh token to rotate")


class PasswordResetRequestReq(BaseModel):
    """Request body for POST /auth/password-reset/request."""
    email: EmailStr = Field(..., description="User email (generic response on success)")


class PasswordResetConfirmReq(BaseModel):
    """Request body for POST /auth/password-reset/confirm."""
    token: str = Field(..., min_length=1, description="Single-use reset token received via email")
    new_password: str = Field(..., min_length=8, description="New password (plaintext, will be hashed)")


class EmailVerifyConfirmReq(BaseModel):
    """Request body for POST /auth/verify-email/confirm."""
    token: str = Field(..., min_length=1, description="Single-use verification token received via email")


class RoleUpdateReq(BaseModel):
    """Request body for PUT /dashboard/users/{user_id}/role (admin-only)."""
    role: str = Field(..., pattern=r"^(User|Wellness Coach|Administrator)$",
                      description="New role name (User / Wellness Coach / Administrator)")


# ============================================================
# OAUTH2 LOGIN SCHEMAS (Module 1)
# ============================================================

class OAuthLoginRes(BaseModel):
    """Response for GET /auth/oauth/google/login (start the consent flow)."""
    authorization_url: str = Field(description="Google consent URL to redirect the browser to")
    state: str = Field(description="Opaque CSRF state that must be echoed back on callback")


class OAuthCallbackReq(BaseModel):
    """Request body for POST /auth/oauth/google/callback."""
    code: str = Field(..., min_length=1, description="Authorization code returned by Google")
    redirect_uri: str = Field(..., min_length=1, description="Must match the redirect_uri used at login")
    state: str = Field(..., min_length=1, description="The state value returned by Google (CSRF check)")


class OAuthMobileReq(BaseModel):
    """Request body for POST /auth/oauth/google/mobile (native PKCE flow)."""
    id_token: str = Field(..., min_length=1, description="OIDC id_token from the Google PKCE flow")
