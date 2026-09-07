"""Pydantic v2 schemas for authentication module."""

from typing import Optional
from pydantic import BaseModel, Field


class AuthRegisterReq(BaseModel):
    """Request schema for user registration."""
    email: str = Field(..., description="User email (unique)")
    password: str = Field(..., min_length=8, description="Plaintext password (will be hashed)")
    full_name: Optional[str] = Field(None, description="Optional full name")
    timezone: str = Field("UTC", description="IANA time zone name, e.g. America/Los_Angeles")
    difficulty_preference: str = Field("Medium", description="Difficulty preference: Beginner/Easy/Medium/Hard/Expert")


class AuthLoginReq(BaseModel):
    """Request schema for user login."""
    email: str = Field(..., description="User email")
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
    created_at: str  # datetime ISO format

    model_config = {"from_attributes": True}


class AuthRes(BaseModel):
    """Response schema for auth endpoints."""
    access_token: str = Field(description="JWT access token")
    refresh_token: str = Field(description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(description="Seconds until access token expiry")
    user: UserProfileRes
