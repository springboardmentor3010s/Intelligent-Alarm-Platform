"""Database models. Datetimes are naive UTC; enums are validated strings (portable across DBs)."""
import uuid

from sqlalchemy import (Boolean, Column, Date, DateTime, Float, ForeignKey, Index, Integer,
                        String, Text, Time, UniqueConstraint, Uuid)
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timeutil import utcnow

ROLES = ("user", "wellness_coach", "admin")
LEVELS = ("beginner", "easy", "medium", "hard", "expert")
CHALLENGE_TYPES = ("math", "logic", "memory", "word", "pattern", "riddle", "quiz")
ALARM_TYPES = ("daily", "weekday", "weekend", "one_time", "smart_adaptive")
VERIFY_METHODS = ("puzzle", "multi_step", "consecutive", "timed", "accuracy_check")
SOUNDS = ("classic", "chime", "pulse", "digital")


def _id():
    return Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)


def _fk(table, nullable=False, ondelete="CASCADE"):
    return Column(Uuid(as_uuid=True), ForeignKey(f"{table}.id", ondelete=ondelete), nullable=nullable, index=True)


class User(Base):
    __tablename__ = "users"
    id = _id()
    full_name = Column(String(120), nullable=False)
    email = Column(String(254), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)  # null for OAuth-only accounts
    role = Column(String(20), default="user", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    coach_requested = Column(Boolean, default=False, nullable=False)  # awaiting admin approval
    failed_logins = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    oauth_provider = Column(String(30), nullable=True)
    oauth_sub = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    __table_args__ = (UniqueConstraint("oauth_provider", "oauth_sub", name="uq_oauth_identity"),)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = _id()
    user_id = _fk("users")
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    user_agent = Column(String(200), nullable=True)


class UserProfile(Base):
    __tablename__ = "user_profiles"
    id = _id()
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    preferred_wake_time = Column(Time, nullable=True)
    bedtime = Column(Time, nullable=True)
    sleep_duration_minutes = Column(Integer, default=450, nullable=False)
    timezone = Column(String(60), default="Asia/Kolkata", nullable=False)
    productivity_goal = Column(String(255), nullable=True)
    wake_goal_streak = Column(Integer, default=21, nullable=False)  # wake-up goal: consecutive days
    difficulty_preference = Column(String(10), default="auto", nullable=False)  # auto | a fixed level
    current_difficulty = Column(String(10), default="easy", nullable=False)
    preferred_challenge_types = Column(String(120), default=",".join(CHALLENGE_TYPES), nullable=False)
    bedtime_reminders = Column(Boolean, default=True, nullable=False)
    browser_notifications = Column(Boolean, default=True, nullable=False)
    onboarded = Column(Boolean, default=False, nullable=False)
    user = relationship("User", back_populates="profile")


class Alarm(Base):
    __tablename__ = "alarms"
    id = _id()
    user_id = _fk("users")
    label = Column(String(60), default="Alarm", nullable=False)
    time = Column(Time, nullable=False)  # local wall-clock time in the user's timezone
    alarm_type = Column(String(20), default="daily", nullable=False)
    repeat_days = Column(String(20), default="0,1,2,3,4,5,6", nullable=False)  # 0=Mon .. 6=Sun
    one_time_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    sound = Column(String(20), default="classic", nullable=False)
    volume = Column(Integer, default=80, nullable=False)
    challenge_types = Column(String(120), nullable=True)  # override; null = use profile preferences
    difficulty_override = Column(String(10), nullable=True)
    verification_method = Column(String(20), default="puzzle", nullable=False)
    max_snoozes = Column(Integer, default=2, nullable=False)
    snooze_minutes = Column(Integer, default=5, nullable=False)
    smart_window_minutes = Column(Integer, default=20, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class WakeSession(Base):
    """One row per alarm ring (the source of truth for ringing, snoozing, dismissal and misses)."""
    __tablename__ = "wake_sessions"
    id = _id()
    user_id = _fk("users")
    alarm_id = _fk("alarms", nullable=True, ondelete="SET NULL")
    is_practice = Column(Boolean, default=False, nullable=False)
    label = Column(String(60), default="Alarm", nullable=False)
    local_date = Column(Date, nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    started_at = Column(DateTime, default=utcnow, nullable=False)
    status = Column(String(12), default="ringing", nullable=False)  # ringing|snoozed|dismissed|missed
    sound = Column(String(20), default="classic", nullable=False)
    volume = Column(Integer, default=80, nullable=False)
    verification_method = Column(String(20), default="puzzle", nullable=False)
    required_correct = Column(Integer, default=1, nullable=False)
    max_questions = Column(Integer, nullable=True)
    correct_count = Column(Integer, default=0, nullable=False)
    consecutive = Column(Integer, default=0, nullable=False)
    questions_asked = Column(Integer, default=0, nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    wrong_count = Column(Integer, default=0, nullable=False)
    snooze_count = Column(Integer, default=0, nullable=False)
    max_snoozes = Column(Integer, default=2, nullable=False)
    snooze_minutes = Column(Integer, default=5, nullable=False)
    snoozed_until = Column(DateTime, nullable=True)
    difficulty = Column(String(10), default="easy", nullable=False)
    last_ring_at = Column(DateTime, default=utcnow, nullable=False)
    dismissed_at = Column(DateTime, nullable=True)
    alertness_score = Column(Float, nullable=True)
    __table_args__ = (UniqueConstraint("alarm_id", "local_date", name="uq_session_alarm_day"),
                      Index("ix_session_user_date", "user_id", "local_date"))


class ChallengeInstance(Base):
    """A concrete question issued to a user. The correct answer never leaves the server."""
    __tablename__ = "challenge_instances"
    id = _id()
    user_id = _fk("users")
    session_id = _fk("wake_sessions", nullable=True)
    challenge_type = Column(String(20), nullable=False)
    difficulty = Column(String(10), nullable=False)
    prompt = Column(Text, nullable=False)
    correct_answer = Column(String(255), nullable=False)
    options = Column(Text, nullable=True)  # JSON list (quiz)
    display = Column(Text, nullable=True)  # memorise-this payload
    reveal_seconds = Column(Integer, default=0, nullable=False)
    time_limit_seconds = Column(Integer, default=60, nullable=False)
    issued_at = Column(DateTime, default=utcnow, nullable=False)
    answered_at = Column(DateTime, nullable=True)
    user_answer = Column(String(255), nullable=True)
    is_correct = Column(Boolean, nullable=True)
    timed_out = Column(Boolean, default=False, nullable=False)
    time_taken_seconds = Column(Float, nullable=True)
    is_practice = Column(Boolean, default=False, nullable=False)


class SleepLog(Base):
    __tablename__ = "sleep_logs"
    id = _id()
    user_id = _fk("users")
    log_date = Column(Date, nullable=False)  # the morning the sleep ended
    bedtime = Column(Time, nullable=False)
    wake_time = Column(Time, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    quality = Column(Integer, nullable=True)  # 1-5
    productivity = Column(Integer, nullable=True)  # 1-5 (rated at end of that day)
    __table_args__ = (UniqueConstraint("user_id", "log_date", name="uq_sleep_user_day"),)


class HabitScore(Base):
    __tablename__ = "habit_scores"
    id = _id()
    user_id = _fk("users")
    score_date = Column(Date, nullable=False)
    wake_consistency = Column(Float, nullable=True)
    challenge_completion = Column(Float, nullable=True)
    snooze_reduction = Column(Float, nullable=True)
    sleep_adherence = Column(Float, nullable=True)
    total = Column(Float, nullable=False, default=0.0)
    __table_args__ = (UniqueConstraint("user_id", "score_date", name="uq_score_user_day"),)


class Recommendation(Base):
    __tablename__ = "recommendations"
    id = _id()
    user_id = _fk("users")
    category = Column(String(24), nullable=False)  # sleep|wake|habit|productivity|challenge
    title = Column(String(150), nullable=False)
    body = Column(Text, nullable=False)
    dedupe_key = Column(String(80), nullable=False)
    is_dismissed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    __table_args__ = (UniqueConstraint("user_id", "dedupe_key", name="uq_rec_dedupe"),)


class Notification(Base):
    __tablename__ = "notifications"
    id = _id()
    user_id = _fk("users")
    kind = Column(String(24), nullable=False)  # bedtime|wake|habit|challenge|progress|announcement
    title = Column(String(150), nullable=False)
    body = Column(Text, nullable=False)
    dedupe_key = Column(String(80), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)
    __table_args__ = (UniqueConstraint("user_id", "dedupe_key", name="uq_notif_dedupe"),)


class CoachLink(Base):
    """Coach <-> member relationship. Members must consent (accept) before a coach can see their data."""
    __tablename__ = "coach_links"
    id = _id()
    coach_id = _fk("users")
    member_id = _fk("users")
    status = Column(String(12), default="pending", nullable=False)  # pending|active|declined|revoked
    invited_by = Column(String(10), default="coach", nullable=False)  # coach | admin
    created_at = Column(DateTime, default=utcnow, nullable=False)
    __table_args__ = (UniqueConstraint("coach_id", "member_id", name="uq_coach_member"),)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = _id()
    actor_id = Column(Uuid(as_uuid=True), nullable=True, index=True)
    actor_email = Column(String(254), nullable=True)
    action = Column(String(60), nullable=False, index=True)
    target = Column(String(120), nullable=True)
    ip = Column(String(64), nullable=True)
    detail = Column(String(300), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)
