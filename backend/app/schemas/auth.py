from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str 
    email: EmailStr
    password: str = Field(
        min_length=8,
        max_length=128
    )
    role: Optional[str] = "user"


class LoginRequest(BaseModel):
    email: EmailStr

    password: str