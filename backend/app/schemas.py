"""Request validation schemas (responses are plain dicts serialised with UTC 'Z' datetimes)."""
import re
from datetime import date, time
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models import ALARM_TYPES, CHALLENGE_TYPES, LEVELS, ROLES, SOUNDS, VERIFY_METHODS
from app.services.schedule import days_for_type


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    account_type: Literal["member", "coach"] = "member"

    @field_validator("full_name")
    @classmethod
    def _name(cls, v):
        v = re.sub(r"\s+", " ", v).strip()
        if len(v) < 2 or re.search(r"[<>]", v):
            raise ValueError("Please enter a valid name.")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    portal: Optional[Literal["member", "coach", "admin"]] = None


class PasswordChangeIn(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=10, max_length=128)


class DeleteAccountIn(BaseModel):
    password: str = Field(default="", max_length=128)


class NameIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)


class ProfileIn(BaseModel):
    preferred_wake_time: Optional[time] = None
    bedtime: Optional[time] = None
    sleep_duration_minutes: int = Field(default=450, ge=240, le=720)
    timezone: str = Field(default="Asia/Kolkata", max_length=60)
    productivity_goal: Optional[str] = Field(default=None, max_length=255)
    wake_goal_streak: int = Field(default=21, ge=1, le=365)
    difficulty_preference: str = "auto"
    preferred_challenge_types: list[str] = Field(default_factory=lambda: list(CHALLENGE_TYPES))
    bedtime_reminders: bool = True
    browser_notifications: bool = True

    @field_validator("difficulty_preference")
    @classmethod
    def _diff(cls, v):
        if v != "auto" and v not in LEVELS:
            raise ValueError("Invalid difficulty")
        return v

    @field_validator("preferred_challenge_types")
    @classmethod
    def _types(cls, v):
        v = [t for t in v if t in CHALLENGE_TYPES]
        if not v:
            raise ValueError("Choose at least one challenge type")
        return v

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v):
        from zoneinfo import ZoneInfo
        try:
            ZoneInfo(v)
        except Exception:
            raise ValueError("Unknown time zone")
        return v


class AlarmIn(BaseModel):
    label: str = Field(default="Alarm", min_length=1, max_length=60)
    time: time
    alarm_type: str = "daily"
    repeat_days: Optional[list[int]] = None
    one_time_date: Optional[date] = None
    is_active: bool = True
    sound: str = "classic"
    volume: int = Field(default=80, ge=10, le=100)
    challenge_types: Optional[list[str]] = None
    difficulty_override: Optional[str] = None
    verification_method: str = "puzzle"
    max_snoozes: int = Field(default=2, ge=0, le=5)
    snooze_minutes: int = Field(default=5, ge=1, le=15)
    smart_window_minutes: int = Field(default=20, ge=5, le=45)

    @field_validator("label")
    @classmethod
    def _label(cls, v):
        v = v.strip()
        if not v or re.search(r"[<>]", v):
            raise ValueError("Invalid label")
        return v

    @field_validator("alarm_type")
    @classmethod
    def _type(cls, v):
        if v not in ALARM_TYPES:
            raise ValueError("Invalid alarm type")
        return v

    @field_validator("sound")
    @classmethod
    def _sound(cls, v):
        if v not in SOUNDS:
            raise ValueError("Invalid sound")
        return v

    @field_validator("verification_method")
    @classmethod
    def _vm(cls, v):
        if v not in VERIFY_METHODS:
            raise ValueError("Invalid verification method")
        return v

    @field_validator("difficulty_override")
    @classmethod
    def _dov(cls, v):
        if v in (None, "", "auto"):
            return None
        if v not in LEVELS:
            raise ValueError("Invalid difficulty")
        return v

    @field_validator("challenge_types")
    @classmethod
    def _ct(cls, v):
        if not v:
            return None
        v = [t for t in v if t in CHALLENGE_TYPES]
        return v or None

    @field_validator("repeat_days")
    @classmethod
    def _rd(cls, v):
        return sorted({d for d in v if 0 <= d <= 6}) if v is not None else None

    def resolved_days(self) -> list[int]:
        return self.repeat_days if self.repeat_days else days_for_type(self.alarm_type)


class SleepLogIn(BaseModel):
    log_date: date
    bedtime: time
    wake_time: time
    quality: Optional[int] = Field(default=None, ge=1, le=5)
    productivity: Optional[int] = Field(default=None, ge=1, le=5)


class AnswerIn(BaseModel):
    instance_id: UUID
    answer: str = Field(default="", max_length=255)


class TestRingIn(BaseModel):
    alarm_id: Optional[UUID] = None


class InviteIn(BaseModel):
    email: EmailStr


class MessageIn(BaseModel):
    message: str = Field(min_length=1, max_length=400)


class RoleIn(BaseModel):
    role: Literal["user", "wellness_coach", "admin"]


class AssignIn(BaseModel):
    coach_id: UUID
    member_id: UUID


class AnnouncementIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    body: str = Field(min_length=2, max_length=600)
