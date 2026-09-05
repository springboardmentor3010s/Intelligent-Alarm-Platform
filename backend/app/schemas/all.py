"""Pydantic v2 schemas for Intelligent Cognitive Alarm Platform."""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, str
from datetime import datetime


# ============================================================
# AUTHENTICATION SCHEMAS
# ============================================================

class AuthRegisterReq(BaseModel):
    """Request schema for user registration."""
    email: str = Field(..., description="User email (unique)")
    password: str = Field(..., min_length=8, description="Plaintext password (will be hashed)")
    full_name: Optional[str] = Field(None, description="Optional full name")
    timezone: str = Field("UTC", description="IANA time zone name, e.g. America/Los_Angeles")


class AuthLoginReq(BaseModel):
    """Request schema for user login."""
    email: str = Field(..., description="User email")
    password: str = Field(..., description="Plaintext password for verification")


class AuthRes(BaseModel):
    """Response schema for auth endpoints."""
    access_token: str = Field(description="JWT access token")
    refresh_token: str = Field(description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(description="Seconds until access token expiry")
    user: "UserProfileRes"


class UserProfileRes(BaseModel):
    """Response schema for user profile."""
    id: int
    email: str
    full_name: Optional[str] = None
    timezone: str
    is_active: bool
    is_verified: bool
    created_at: str  # datetime ISO format

    model_config = {"from_attributes": True}


# ============================================================
# ALARM SCHEMAS
# ============================================================

class AlarmCreateReq(BaseModel):
    """Request schema for creating an alarm."""
    title: str = Field(..., min_length=1, max_length=200, description="Alarm title/label")
    type: str = Field(..., description="Daily/Weekday/Weekend/One-Time/Smart Adaptive")
    recurrence: Optional[str] = Field(None, description="Recurrence rule (iCalendar format)")
    challenge_type: Optional[str] = Field(None, description="Math/Logic/Memory/Word/Pattern/Riddle/QuickQuiz")
    difficulty: Optional[str] = Field(None, description="Beginner/Easy/Medium/Hard/Expert")
    next_trigger: Optional[datetime] = Field(None, description="Override computed next trigger")


class AlarmDismissReq(BaseModel):
    """Request schema for dismissing an alarm with challenge."""
    challenge_attempt_id: int = Field(..., description="ID of challenge_attempt that was completed")
    correct_answers: int = Field(..., ge=0, description="Number of correct answers given")
    total_questions: int = Field(..., gt=0, description="Total questions in challenge")
    time_taken_seconds: int = Field(..., ge=0, description="Time from challenge start to dismissal")


class AlarmRes(BaseModel):
    """Response schema for alarm data."""
    id: int
    user_id: int
    title: str
    alarm_type: str
    next_trigger: Optional[datetime] = None
    is_enabled: bool
    challenge_id: Optional[int] = None
    times_snoozed: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class DismissRes(BaseModel):
    """Response schema for alarm dismissal."""
    alarm_id: int
    successfully_dismissed: bool
    new_habit_score_update: bool = False
    next_trigger: datetime


# ============================================================
# CHALLENGE SCHEMAS
# ============================================================

class ChallengeListRes(BaseModel):
    """Response schema for challenge list."""
    id: int
    title: str
    challenge_type: str  # Math/Logic/Memory/Word/Pattern/Riddle/QuickQuiz
    difficulty: str  # Beginner/Easy/Medium/Hard/Expert
    is_active: bool

    model_config = {"from_attributes": True}


class ChallengeRes(BaseModel):
    """Response schema for challenge data."""
    id: int
    title: str
    description: Optional[str] = None
    challenge_type: str
    difficulty: str
    generated_at: datetime
    puzzle_payload: Dict[str, Any] = Field(..., description="Challenge data sent to mobile client")

    model_config = {"from_attributes": True}


# ============================================================
# HABIT/SCORING SCHEMAS
# ============================================================

class HabitScoreRes(BaseModel):
    """Response schema for habit score."""
    date: str  # YYYY-MM-DD
    wake_up_consistency: int = Field(..., ge=0, le=100, description="0-100")
    challenge_completion: int = Field(..., ge=0, le=100, description="0-100")
    snooze_reduction: int = Field(..., ge=0, le=100, description="0-100")
    sleep_schedule_adherence: int = Field(..., ge=0, le=100, description="0-100")
    overall_score: int = Field(..., ge=0, le=100, description="Weighted composite 0-100")

    model_config = {"from_attributes": True}


class AnalyticsRes(BaseModel):
    """Response schema for user analytics."""
    user_id: int
    total_alarms: int = 0
    total_dismissals: int = 0
    average_snooze_count: float = 0.0
    wake_up_consistency_trend: str = "stable"  # improving/stable/declining
    challenge_accuracy: float = 0.0  # overall correct/total ratio
    sleep_duration_avg: float = 0.0  # average hours/night
    recent_activity: Dict[str, Any] = Field(default_factory=dict)


# ============================================================
# SYNC SCHEMAS (Mobile Offline-First)
# ============================================================

class SyncRecordReq(BaseModel):
    """Request schema for sync pending records."""
    table_name: str  # "alarms", "challenge_attempts", "habit_scores"
    record_id: int
    operation: str  # "insert", "update", "delete"
    payload: Dict[str, Any]
    local_timestamp: datetime


class SyncRecordRes(BaseModel):
    """Response schema for sync record."""
    record_id: int
    table_name: str
    server_etag: str
    synced: bool


class SyncPendingReq(BaseModel):
    """Request schema for sync pending."""
    records: List[SyncRecordReq]


class SyncRes(BaseModel):
    """Response schema for sync operation."""
    synced_count: int
    failed_count: int
    failed_record_ids: List[int]


# ============================================================
# DASHBOARD SCHEMAS
# ============================================================

class AdminUserRes(BaseModel):
    """Response schema for admin user list."""
    id: int
    email: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    role: str  # "User"/"Wellness Coach"/"Administrator"

    model_config = {"from_attributes": True}


class AdminAnalyticsRes(BaseModel):
    """Response schema for admin analytics."""
    total_users: int = 0
    active_users_today: int = 0
    new_users_this_week: int = 0
    alarm_dismissal_success_rate: float = 0.0
    platform_habit_score_avg: float = 0.0
    top_challenge_types: List[Dict[str, Any]] = Field(default_factory=list)
    system_uptime_percentage: float = 0.0


# ============================================================
# NOTIFICATION SCHEMAS
# ============================================================

class NotificationReq(BaseModel):
    """Request schema for sending notifications."""
    user_id: int
    title: str
    body: str
    type: str  # "bedtime", "wake_up", "habit_alert", "challenge_reminder"
    data: Optional[Dict[str, Any]] = None


class NotificationRes(BaseModel):
    """Response schema for notification send."""
    message_id: str
    status: str  # "sent", "failed", "pending"


# ============================================================
# REPORT SCHEMAS
# ============================================================

class ReportExportReq(BaseModel):
    """Request schema for report export."""
    report_type: str  # "habit", "wake_up", "challenge", "productivity", "sleep"
    format: str  # "pdf", "excel"
    date_range: Optional[str] = None  # "7d", "30d", "all"


class ReportExportRes(BaseModel):
    """Response schema for report export."""
    download_url: str
    filename: str
    generated_at: datetime