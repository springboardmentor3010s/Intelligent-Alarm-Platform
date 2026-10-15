from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)  # nullable: OAuth-only accounts have no password
    role = Column(String, default="USER")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Social login linkage (Module: OAuth2 social login)
    oauth_provider = Column(String, nullable=True)  # "google" | "github" | None
    oauth_id = Column(String, nullable=True)         # provider's unique subject/user id

    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    alarms = relationship("Alarm", back_populates="user", cascade="all, delete-orphan")
    challenges = relationship("CognitiveChallenge", back_populates="user", cascade="all, delete-orphan")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    preferred_wake_up_time = Column(String, default="07:00")
    sleep_duration = Column(Integer, default=8)
    timezone = Column(String, default="Asia/Kolkata")
    productivity_goal = Column(String, default="")
    difficulty_preference = Column(String, default="Medium")
    habit_preferences = Column(Text, default="")

    user = relationship("User", back_populates="profile")


class Alarm(Base):
    __tablename__ = "alarms"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    alarm_name = Column(String, nullable=False)
    alarm_time = Column(String, nullable=False)
    alarm_type = Column(String, default="Daily")
    repeat_days = Column(String, default="")
    enabled = Column(Boolean, default=True)
    challenge_difficulty = Column(String, default="MEDIUM")
    challenge_count = Column(Integer, default=1)
    challenge_type = Column(String, default="random")
    max_failed_attempts = Column(Integer, default=5)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="alarms")
    challenges = relationship("CognitiveChallenge", back_populates="alarm", cascade="all, delete-orphan")


class CognitiveChallenge(Base):
    __tablename__ = "cognitive_challenges"

    id = Column(Integer, primary_key=True, index=True)
    alarm_id = Column(Integer, ForeignKey("alarms.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    challenge_type = Column(String, nullable=False)
    difficulty = Column(String, nullable=False)
    question = Column(Text, nullable=False)
    correct_answer = Column(String, nullable=False)
    user_answer = Column(String, nullable=True)
    is_correct = Column(Boolean, nullable=True)   # None=unanswered, True=correct, False=wrong (last attempt)
    attempts = Column(Integer, default=0)
    score = Column(Integer, default=0)             # 0-100
    time_limit_seconds = Column(Integer, default=120)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    completion_duration_seconds = Column(Float, nullable=True)  # set on correct answer
    last_attempt_duration_seconds = Column(Float, nullable=True)  # updated on every attempt

    alarm = relationship("Alarm", back_populates="challenges")
    user = relationship("User", back_populates="challenges")


class WakeUpSession(Base):
    """
    Tracks one alarm-ring event: verification state, wakefulness score,
    challenges completed, snooze/retry attempts.
    """
    __tablename__ = "wakeup_sessions"

    id = Column(Integer, primary_key=True, index=True)
    alarm_id = Column(Integer, ForeignKey("alarms.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Verification state: NOT_VERIFIED | PARTIALLY_VERIFIED | WAKE_UP_VERIFIED
    status = Column(String, default="NOT_VERIFIED")
    challenges_required = Column(Integer, default=1)
    challenges_completed = Column(Integer, default=0)
    total_attempts = Column(Integer, default=0)
    failed_attempts = Column(Integer, default=0)
    wakefulness_score = Column(Float, default=0.0)   # 0-100

    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    verified_at = Column(DateTime, nullable=True)
    dismissed_at = Column(DateTime, nullable=True)

    alarm = relationship("Alarm")
    user = relationship("User")


class CoachNote(Base):
    """Coaching note saved by a WELLNESS_COACH or ADMINISTRATOR."""
    __tablename__ = "coach_notes"

    id = Column(Integer, primary_key=True, index=True)
    coach_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # None = general note
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    coach = relationship("User", foreign_keys=[coach_id])


class Notification(Base):
    """In-app reminder/alert generated by the scheduler or triggered by user activity."""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # BEDTIME_REMINDER | WAKEUP_REMINDER | HABIT_ALERT | MISSED_ALARM | PROGRESS
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User")
