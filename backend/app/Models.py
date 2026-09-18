# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""SQLAlchemy 2.0 model definitions for Intelligent Cognitive Alarm Platform (SQLite-compatible)."""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    Index,
    JSON,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(String(100), nullable=True)
    __table_args__ = (Index("ix_roles_name", "name"),)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(254), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=True)
    hashed_password = Column(String(256), nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    timezone = Column(String(50), nullable=True, default="UTC")
    difficulty_preference = Column(String(20), nullable=True, default="Medium")
    settings = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    # Relationship to roles via junction table
    user_roles = relationship("UserRole", back_populates="user")
    # Read-only convenience relationship through the association table
    roles = relationship("Role", secondary="user_roles", viewonly=True)
    # Relationship to alarms owned
    alarms = relationship("Alarm", back_populates="user", cascade="all, delete-orphan")
    # Relationship to challenge attempts
    challenge_attempts = relationship("ChallengeAttempt", back_populates="user", cascade="all, delete-orphan")
    # Relationship to habit scores
    habit_scores = relationship("HabitScore", back_populates="user", cascade="all, delete-orphan")
    # Relationship to push notification tokens
    push_tokens = relationship("PushToken", back_populates="user", cascade="all, delete-orphan")
    # Relationship to refresh / password-reset / email-verification tokens
    auth_tokens = relationship("AuthToken", back_populates="user", cascade="all, delete-orphan")
    __table_args__ = (Index("ix_users_email_lower", func.lower(email)),)


class UserRole(Base):
    __tablename__ = "user_roles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    # Relationship back to user
    user = relationship("User", back_populates="user_roles")
    __table_args__ = (Index("ix_user_roles_user_id", "user_id"), Index("ix_user_roles_role_id", "role_id"))


class Alarm(Base):
    __tablename__ = "alarms"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    alarm_type = Column(String(50), nullable=False)
    next_trigger = Column(DateTime(timezone=True))
    is_enabled = Column(Boolean, default=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id", ondelete="CASCADE"), nullable=True)
    times_snoozed = Column(Integer, default=0)
    recurrence = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    # Relationships
    user = relationship("User", back_populates="alarms")
    challenge = relationship("Challenge", back_populates="alarm")
    __table_args__ = (Index("ix_alarms_user_id", "user_id"), Index("ix_alarms_next_trigger", "next_trigger"))


class Challenge(Base):
    __tablename__ = "challenges"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    challenge_type = Column(String(50), nullable=False)
    difficulty = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    generated_at = Column(DateTime(timezone=True), nullable=True)
    # Relationships
    alarm = relationship("Alarm", back_populates="challenge", cascade="all, delete-orphan")
    attempts = relationship("ChallengeAttempt", back_populates="challenge", cascade="all, delete-orphan")
    __table_args__ = (Index("ix_challenges_type_difficulty", "challenge_type", "difficulty"),)


class ChallengeAttempt(Base):
    __tablename__ = "challenge_attempts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    challenge_id = Column(Integer, ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False)
    attempt_number = Column(Integer, default=1)
    completed = Column(Boolean, default=False)
    correct_answers = Column(Integer, default=0)
    total_questions = Column(Integer, default=0)
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    time_taken_seconds = Column(Integer, nullable=True)
    # Server-authoritative puzzle snapshot. `puzzle_payload` is what was sent to
    # the client (questions/options/timeout — never the answers). `expected_answers`
    # is kept server-side only for verification at /challenges/submit. `user_answers`
    # stores what the client submitted. `answer_meta` holds server-only per-question
    # metadata (answer type + explanation) used for authoritative comparison and
    # post-submission feedback; it is never serialized to clients.
    puzzle_payload = Column(JSON, nullable=True)
    expected_answers = Column(JSON, nullable=True)
    user_answers = Column(JSON, nullable=True)
    answer_meta = Column(JSON, nullable=True)
    # Expiry bounds how long a pending attempt may be submitted (anti-replay).
    expires_at = Column(DateTime(timezone=True), nullable=True)
    # Set once an attempt has been redeemed to dismiss an alarm; blocks reuse.
    consumed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Relationships
    user = relationship("User", back_populates="challenge_attempts")
    challenge = relationship("Challenge", back_populates="attempts")
    __table_args__ = (
        Index("ix_attempts_user_challenge", "user_id", "challenge_id"),
        Index("ix_attempts_completed", "completed"),
        Index("ix_attempts_expires_at", "expires_at"),
        # Unique constraint for idempotent sync: one attempt per user/challenge/date
        # Note: full unique constraint added in migration/ddl
    )


class HabitScore(Base):
    __tablename__ = "habit_scores"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(String(10), nullable=False)
    wake_up_consistency = Column(Integer, nullable=False)
    challenge_completion = Column(Integer, nullable=False)
    snooze_reduction = Column(Integer, nullable=False)
    sleep_schedule_adherence = Column(Integer, nullable=False)
    overall_score = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Relationships
    user = relationship("User", back_populates="habit_scores")
    __table_args__ = (
        Index("ix_habit_scores_user_date", "user_id", "date"),
        Index("ix_habit_scores_date", "date"),
    )


class PushToken(Base):
    __tablename__ = "push_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(512), nullable=False)
    platform = Column(String(50), nullable=False, default="android")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Relationships
    user = relationship("User", back_populates="push_tokens")
    __table_args__ = (
        Index("ix_push_tokens_user_id", "user_id"),
        Index("ix_push_tokens_token", "token"),
        UniqueConstraint("token", name="uq_push_tokens_token"),
    )


class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category = Column(String(30), nullable=False, default="suggestion")
    rating = Column(Integer, nullable=True)  # 1-5
    message = Column(Text, nullable=False)
    contact_email = Column(String(254), nullable=True)
    status = Column(String(20), nullable=False, default="new")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Relationships
    user = relationship("User")
    __table_args__ = (
        Index("ix_feedback_user_id", "user_id"),
        Index("ix_feedback_status", "status"),
    )


class AlarmRole(Base):
    __tablename__ = "alarm_roles"
    id = Column(Integer, primary_key=True, index=True)
    alarm_id = Column(Integer, ForeignKey("alarms.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)


class CoachAssignment(Base):
    """Wellness-coach cohort scope: which users a coach may view and support.

    A coach sees only users assigned to them (plus nothing else); admins manage
    assignments and retain full visibility. One row per (coach, user) pair.
    """
    __tablename__ = "coach_assignments"
    id = Column(Integer, primary_key=True, index=True)
    coach_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    coach = relationship("User", foreign_keys=[coach_id])
    user = relationship("User", foreign_keys=[user_id])
    __table_args__ = (
        Index("ix_coach_assignments_coach_id", "coach_id"),
        Index("ix_coach_assignments_user_id", "user_id"),
        UniqueConstraint("coach_id", "user_id", name="uq_coach_assignments_coach_user"),
    )


class AuthToken(Base):
    """Server-side store for refresh / password-reset / email-verification tokens.

    Only SHA-256 hashes of tokens are persisted (never the plaintext), so a DB
    leak cannot be replayed. Rows carry an expiry and can be marked revoked /
    single-use (used_at) for rotation and one-time redemption.
    """
    __tablename__ = "auth_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kind = Column(String(40), nullable=False)  # refresh | password_reset | email_verification
    token_hash = Column(String(64), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Relationships
    user = relationship("User", back_populates="auth_tokens")
    __table_args__ = (
        Index("ix_auth_tokens_user_id", "user_id"),
        Index("ix_auth_tokens_kind", "kind"),
        Index("ix_auth_tokens_token_hash", "token_hash"),
        UniqueConstraint("token_hash", name="uq_auth_tokens_token_hash"),
    )


class ProductivityLog(Base):
    """Manual daily productivity log (Phase 7, FR-BA-003/FR-REP-004).

    The application cannot measure productivity itself, so this table stores
    only what the user explicitly enters: a 0-100 day score plus an optional
    note. `source` is always "user-entered". One row per (user, date); later
    submissions overwrite the same day (upsert), never duplicate.
    """
    __tablename__ = "productivity_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(String(10), nullable=False)
    score = Column(Integer, nullable=False)
    note = Column(Text, nullable=True)
    source = Column(String(20), nullable=False, default="user-entered")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user = relationship("User")
    __table_args__ = (
        Index("ix_productivity_logs_user_date", "user_id", "date"),
        UniqueConstraint("user_id", "date", name="uq_productivity_logs_user_date"),
    )


class AuditLog(Base):
    """Security-relevant audit trail (login outcomes, role changes, resets)."""
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    event = Column(String(60), nullable=False)
    actor_email = Column(String(254), nullable=True)
    ip_address = Column(String(45), nullable=True)
    detail = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    __table_args__ = (
        Index("ix_audit_logs_user_id", "user_id"),
        Index("ix_audit_logs_event", "event"),
        Index("ix_audit_logs_created_at", "created_at"),
    )
