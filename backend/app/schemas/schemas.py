from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime


# ── Auth ──────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "USER"

    @field_validator("email")
    @classmethod
    def email_must_contain_at(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email address")
        return v

    @field_validator("role")
    @classmethod
    def role_must_be_allowed(cls, v: str) -> str:
        allowed = {"USER", "WELLNESS_COACH"}
        if v not in allowed:
            raise ValueError("Role must be USER or WELLNESS_COACH")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.strip().lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OAuthCompleteRequest(BaseModel):
    """Submitted after a brand-new Google/GitHub sign-up to finalize the account with a role."""
    signup_token: str
    role: str = "USER"

    @field_validator("role")
    @classmethod
    def role_must_be_allowed(cls, v: str) -> str:
        allowed = {"USER", "WELLNESS_COACH"}
        if v not in allowed:
            raise ValueError("Role must be USER or WELLNESS_COACH")
        return v


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Profile ───────────────────────────────────────────
class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    preferred_wake_up_time: Optional[str] = None
    sleep_duration: Optional[int] = None
    timezone: Optional[str] = None
    productivity_goal: Optional[str] = None
    difficulty_preference: Optional[str] = None
    habit_preferences: Optional[str] = None


# ── Alarms ────────────────────────────────────────────
class AlarmCreate(BaseModel):
    alarm_name: str
    alarm_time: str
    alarm_type: str = "Daily"
    repeat_days: str = ""
    enabled: bool = True
    challenge_difficulty: str = "MEDIUM"
    challenge_count: int = 1
    challenge_type: str = "random"
    max_failed_attempts: int = 5


class AlarmUpdate(BaseModel):
    alarm_name: Optional[str] = None
    alarm_time: Optional[str] = None
    alarm_type: Optional[str] = None
    repeat_days: Optional[str] = None
    enabled: Optional[bool] = None
    challenge_difficulty: Optional[str] = None
    challenge_count: Optional[int] = None
    challenge_type: Optional[str] = None
    max_failed_attempts: Optional[int] = None


class AlarmOut(BaseModel):
    id: int
    user_id: int
    alarm_name: str
    alarm_time: str
    alarm_type: str
    repeat_days: str
    enabled: bool
    challenge_difficulty: str
    challenge_count: int
    challenge_type: str
    max_failed_attempts: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Challenges ────────────────────────────────────────
class ChallengeGenerateRequest(BaseModel):
    alarm_id: int
    difficulty: Optional[str] = None
    challenge_type: Optional[str] = None


class ChallengeOut(BaseModel):
    id: int
    alarm_id: int
    challenge_type: str
    difficulty: str
    question: str
    attempts: int
    score: int
    time_limit_seconds: int
    is_correct: Optional[bool]
    completed_at: Optional[datetime]
    completion_duration_seconds: Optional[float]

    class Config:
        from_attributes = True


class VerifyRequest(BaseModel):
    user_answer: str
    response_time_seconds: Optional[float] = None


class VerifyResponse(BaseModel):
    correct: bool
    score: int
    attempts: int
    message: str
    completed: bool
    response_time_seconds: Optional[float] = None
    completion_duration_seconds: Optional[float] = None


class ChallengeHistoryItem(BaseModel):
    id: int
    alarm_id: int
    challenge_type: str
    difficulty: str
    question: str
    user_answer: Optional[str]
    is_correct: Optional[bool]
    attempts: int
    score: int
    completion_duration_seconds: Optional[float]
    started_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class AnalyticsOut(BaseModel):
    total: int
    completed: int
    correct: int
    success_rate: float
    total_attempts: int
    avg_attempts: float
    avg_completion_seconds: float
    avg_score: float
    by_type: dict
    by_difficulty: dict
    current_difficulty: str
    consecutive_correct: int
    # Wake-up stats
    total_wakeup_sessions: int
    verified_wakeup_sessions: int
    wakeup_verification_rate: float
    avg_wakefulness_score: float
    total_failed_attempts: int


# ── Wake-Up Session ───────────────────────────────────
class WakeUpSessionOut(BaseModel):
    id: int
    alarm_id: int
    status: str
    challenges_required: int
    challenges_completed: int
    total_attempts: int
    failed_attempts: int
    wakefulness_score: float
    started_at: datetime
    verified_at: Optional[datetime]
    dismissed_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Notifications ─────────────────────────────────────
class NotificationOut(BaseModel):
    id: int
    type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListOut(BaseModel):
    unread_count: int
    notifications: List[NotificationOut]


# ── Coach Notes ───────────────────────────────────────
class CoachNoteCreate(BaseModel):
    message: str
    target_user_id: Optional[int] = None


class CoachNoteOut(BaseModel):
    id: int
    coach_id: int
    target_user_id: Optional[int]
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Streak ────────────────────────────────────────────
class StreakOut(BaseModel):
    current_streak: int
    longest_streak: int
    last_verified_date: Optional[str]
