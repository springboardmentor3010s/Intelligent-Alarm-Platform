from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    field_validator,
)


# ============================================================
# REGISTER
# ============================================================

class UserCreate(BaseModel):

    name: str

    email: EmailStr

    password: str

    role: str = "user"

    preferred_wake_time: str = "07:00"

    sleep_duration: float = 8.0

    timezone: str = "Asia/Kolkata"

    productivity_goal: str = ""

    difficulty_preference: str = "medium"

    habit_preferences: str = ""

    # New field
    role_preference: Optional[str] = None

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise ValueError("timezone must be a valid IANA time zone") from error
        return value


# ============================================================
# LOGIN
# ============================================================

class UserLogin(BaseModel):

    email: EmailStr

    password: str


# ============================================================
# USER RESPONSE
# ============================================================

class UserResponse(BaseModel):

    model_config = ConfigDict(
        from_attributes=True
    )

    id: int

    name: str

    email: EmailStr

    role: str

    preferred_wake_time: str

    sleep_duration: float

    timezone: str

    productivity_goal: str

    difficulty_preference: str

    habit_preferences: str

    # New field
    role_preference: Optional[str] = None


# ============================================================
# PROFILE UPDATE
# ============================================================

class ProfileUpdate(BaseModel):

    name: Optional[str] = None

    preferred_wake_time: Optional[str] = None

    sleep_duration: Optional[float] = None

    timezone: Optional[str] = None

    productivity_goal: Optional[str] = None

    difficulty_preference: Optional[str] = None

    habit_preferences: Optional[str] = None

    # New field
    role_preference: Optional[str] = None

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value):
        if value is None:
            return value
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise ValueError("timezone must be a valid IANA time zone") from error
        return value