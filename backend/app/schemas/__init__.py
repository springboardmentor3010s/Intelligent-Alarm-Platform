# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Pydantic v2 schemas for Intelligent Cognitive Alarm Platform."""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator
from datetime import datetime


# ============================================================
# USER PROFILE / SETTINGS SCHEMAS
# ============================================================

class UserProfileUpdateReq(BaseModel):
    """Request schema for updating the current user's profile."""
    full_name: Optional[str] = Field(None, description="Full name")
    timezone: Optional[str] = Field(None, description="IANA time zone name")
    difficulty_preference: Optional[str] = Field(
        None,
        description="Beginner/Easy/Medium/Hard/Expert",
    )


class SettingsUpdateReq(BaseModel):
    """Request schema for updating app preferences (persisted in User.settings JSON)."""
    notifications: Optional[bool] = None
    auto_dismiss: Optional[bool] = None
    vibrate: Optional[bool] = None
    time_format: Optional[str] = Field(
        None,
        description="Hour display format: '12' (AM/PM) or '24'",
    )


# ============================================================
# ALARM SCHEMAS
# ============================================================

class AlarmCreateReq(BaseModel):
    """Request schema for creating an alarm."""
    title: str = Field(..., min_length=1, max_length=200, description="Alarm title/label")
    type: str = Field(..., description="Daily/Weekday/Weekend/One-Time/Smart Adaptive")
    time: Optional[str] = Field(None, description="Wake-up time as HH:MM (24h). Used to compute next_trigger.")
    recurrence: Optional[str] = Field(None, description="Recurrence rule (iCalendar format) or short name")
    challenge_type: Optional[str] = Field(None, description="Math/Logic/Memory/Word/Pattern/Riddle/QuickQuiz")
    difficulty: Optional[str] = Field(None, description="Beginner/Easy/Medium/Hard/Expert")
    question_count: Optional[int] = Field(
        None, ge=1, le=5, description="Override the number of questions for this alarm's challenge"
    )
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
    challenge_type: Optional[str] = None
    difficulty: Optional[str] = None
    recurrence: Optional[str] = None
    time: Optional[str] = None  # wake-up time HH:MM in the user's timezone
    times_snoozed: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class DismissRes(BaseModel):
    """Response schema for alarm dismissal."""
    alarm_id: int
    successfully_dismissed: bool
    new_habit_score_update: bool = False
    next_trigger: Optional[str] = None  # ISO datetime string of next trigger


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
    """Response schema for a served challenge (must never expose answers).

    `puzzle_payload` contains only prompts/options/timeout for the client.
    `challenge_attempt_id` is the pending attempt created server-side by
    `/challenges/next`, used to submit and then dismiss the alarm.
    """
    id: int
    title: str
    description: Optional[str] = None
    challenge_type: str
    difficulty: str
    generated_at: Optional[datetime] = None
    challenge_attempt_id: Optional[int] = None
    puzzle_payload: Dict[str, Any] = Field(..., description="Challenge data sent to mobile client (no answers)")

    model_config = {"from_attributes": True}


class ChallengeSubmitReq(BaseModel):
    """Request schema for submitting answers to a served challenge."""
    challenge_id: int = Field(..., description="Challenge id returned by /challenges/next")
    challenge_attempt_id: int = Field(..., description="Pending attempt id returned by /challenges/next")
    user_answer: Optional[str] = Field(None, description="Single answer (single-question challenges)")
    user_answers: Optional[List[str]] = Field(None, description="Ordered answers (multi-question challenges)")
    time_taken_seconds: int = Field(..., ge=0, description="Time from challenge start to submission")

    @field_validator("user_answer", mode="before")
    @classmethod
    def _coerce_single_answer(cls, value: Any) -> Any:
        """Accept a bare number as a valid answer format (normalize to text)."""
        if value is None or isinstance(value, str):
            return value
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return str(value)
        return value

    @field_validator("user_answers", mode="before")
    @classmethod
    def _coerce_multi_answers(cls, value: Any) -> Any:
        """Accept numbers inside the answer list and normalize each to text."""
        if value is None or not isinstance(value, (list, tuple)):
            return value
        return ["" if item is None else (item if isinstance(item, str) else str(item)) for item in value]


class ChallengeQuestionResultRes(BaseModel):
    """Per-question verification result (never reveals an incorrect answer)."""
    index: int
    correct: bool
    answer_type: str
    feedback: str


class ChallengeSubmitRes(BaseModel):
    """Response schema for a challenge submission."""
    challenge_id: int
    challenge_attempt_id: int
    correct: bool = Field(..., description="Whether the full attempt passed (all answers correct)")
    completed: bool = Field(..., description="Attempt marked complete after verification")
    correct_answers: int = Field(..., ge=0)
    total_questions: int = Field(..., gt=0)
    results: List[ChallengeQuestionResultRes] = Field(default_factory=list)
    message: str = ""


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


# ============================================================
# PRODUCTIVITY SCHEMAS (Phase 7 — manual user-entered tracking)
# ============================================================

class ProductivityLogReq(BaseModel):
    """Request schema for logging one day of productivity (user-entered only)."""
    date: Optional[str] = Field(None, description="YYYY-MM-DD; defaults to today (UTC)")
    score: int = Field(..., ge=0, le=100, description="Self-assessed day score 0-100")
    note: Optional[str] = Field(None, max_length=500, description="Optional free-text note")


class ProductivityLogRes(BaseModel):
    """Response schema for a productivity log entry."""
    id: int
    date: str
    score: int
    note: Optional[str] = None
    source: str = "user-entered"

    model_config = {"from_attributes": True}


class RecommendationRes(BaseModel):
    """Response schema for a personalized recommendation (M3, Phase 6).

    Every recommendation explains itself: `reason` states in plain language
    why it fired, and `source_metric` points at the driving measurement
    (`{"key": ..., "value": ...}`) so clients and coaches can audit it.
    """
    id: int
    category: str  # "sleep" | "wake_up" | "habit" | "challenge"
    priority: str  # "high" | "medium" | "low"
    title: str
    message: str
    suggested_action: Optional[str] = None
    metrics: Dict[str, Any] = Field(default_factory=dict)
    reason: Optional[str] = None
    source_metric: Optional[Dict[str, Any]] = None


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
    """Response schema for admin analytics.

    `system_uptime_percentage` is a measured lifetime API success ratio (100.0
    when idle-but-healthy, 0.0 when the database is unreachable) — never a
    hard-coded constant. See `services.system_status`.
    """
    total_users: int = 0
    active_users_today: int = 0
    new_users_this_week: int = 0
    alarm_dismissal_success_rate: float = 0.0
    platform_habit_score_avg: float = 0.0
    top_challenge_types: List[Dict[str, Any]] = Field(default_factory=list)
    system_uptime_percentage: float = 0.0
    uptime_seconds: float = 0.0
    db_connected: bool = False


class CoachAssignmentReq(BaseModel):
    """Request schema for assigning a user to a coach's cohort (admin only)."""
    coach_id: int = Field(..., description="User id of the Wellness Coach")
    user_id: int = Field(..., description="User id to place in the coach's cohort")


class CoachAssignmentRes(BaseModel):
    """Response schema for a coach cohort assignment."""
    id: int
    coach_id: int
    user_id: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ============================================================
# FEEDBACK SCHEMAS
# ============================================================

class FeedbackSubmitReq(BaseModel):
    """Request schema for submitting user feedback (mobile app)."""
    category: str = Field(
        "suggestion",
        pattern="^(suggestion|bug_report|compliment|other)$",
        description="suggestion / bug_report / compliment / other",
    )
    rating: Optional[int] = Field(
        None, ge=1, le=5, description="Optional 1-5 star rating"
    )
    message: str = Field(..., min_length=1, max_length=2000, description="Feedback message")
    contact_email: Optional[str] = Field(
        None, max_length=254, description="Reply address (defaults to the user's email)"
    )

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("message cannot be blank")
        return stripped


class FeedbackRes(BaseModel):
    """Response schema for a feedback record."""
    id: int
    user_id: int
    category: str
    rating: Optional[int] = None
    message: str
    contact_email: Optional[str] = None
    status: str = "new"
    created_at: datetime

    model_config = {"from_attributes": True}
