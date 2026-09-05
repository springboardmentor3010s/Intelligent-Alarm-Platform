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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Relationships
    user = relationship("User", back_populates="challenge_attempts")
    challenge = relationship("Challenge", back_populates="attempts")
    __table_args__ = (
        Index("ix_attempts_user_challenge", "user_id", "challenge_id"),
        Index("ix_attempts_completed", "completed"),
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


class AlarmRole(Base):
    __tablename__ = "alarm_roles"
    id = Column(Integer, primary_key=True, index=True)
    alarm_id = Column(Integer, ForeignKey("alarms.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)