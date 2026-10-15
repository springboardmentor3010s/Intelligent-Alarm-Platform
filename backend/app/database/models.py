from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Time,
    DateTime,
    ForeignKey,
    Text
)

from sqlalchemy.orm import relationship

from app.database.connection import Base


class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    name = Column(
        String(100),
        nullable=False,
    )

    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    password_hash = Column(
        String(255),
        nullable=False,
    )

    role = Column(
        String(50),
        default="user",
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)  ,
    )

    profile = relationship(
        "UserProfile",
        back_populates="user",
        uselist=False,
    )

    habits = relationship(
        "Habit",
        back_populates="user",
    )

    alarms = relationship(
        "Alarm",
        back_populates="user",
    )

    notifications = relationship(
        "UserNotification",
        back_populates="user",
        cascade="all, delete-orphan",
    )
class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
    )

    preferred_wake_time = Column(Time)

    sleep_duration = Column(Integer)

    time_zone = Column(String(100))

    difficulty_preference = Column(
        String(50),
        default="medium",
    )

    user = relationship(
        "User",
        back_populates="profile",
    )


class Habit(Base):
    __tablename__ = "habits"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    wake_up_goal = Column(String(255))

    productivity_goals = Column(Text)

    habit_preferences = Column(Text)

    user = relationship(
        "User",
        back_populates="habits",
    )
class Alarm(Base):
    __tablename__ = "alarms"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    name = Column(
        String(100),
        nullable=False,
    )

    alarm_time = Column(
        Time,
        nullable=False,
    )

    alarm_type = Column(
        String(50),
        default="daily",
    )

    repeat_pattern = Column(
        String(100),
        nullable=True,
    )

    is_active = Column(
        Boolean,
        default=True,
    )

    # =====================================================
    # COGNITIVE CHALLENGE PREFERENCES
    # These are selected BEFORE the alarm rings.
    # =====================================================

    challenge_type = Column(
        String(50),
        default="math",
        nullable=False,
    )

    difficulty = Column(
        String(50),
        default="medium",
        nullable=False,
    )

    # =====================================================
    # RELATIONSHIPS
    # =====================================================

    user = relationship(
        "User",
        back_populates="alarms",
    )

    sessions = relationship(
        "AlarmSession",
        back_populates="alarm",
        cascade="all, delete-orphan",
    )
class CognitiveChallenge(Base):
    __tablename__ = "cognitive_challenges"

    id = Column(Integer, primary_key=True, index=True)

    alarm_id = Column(
        Integer,
        ForeignKey("alarms.id"),
        nullable=False
    )

    challenge_type = Column(
        String,
        nullable=False
    )

    question = Column(
        Text,
        nullable=False
    )

    correct_answer = Column(
        String,
        nullable=False
    )

    difficulty = Column(
        String,
        default="medium"
    )

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class AlarmSession(Base):
    __tablename__ = "alarm_sessions"

    id = Column(Integer, primary_key=True, index=True)

    alarm_id = Column(
        Integer,
        ForeignKey("alarms.id"),
        nullable=False
    )

    challenge_id = Column(
        Integer,
        ForeignKey("cognitive_challenges.id"),
        nullable=True
    )

    user_answer = Column(
        String,
        nullable=True
    )

    is_correct = Column(
        Boolean,
        nullable=True
    )

    session_status = Column(
        String,
        default="started",
        nullable=False
    )

    started_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    completed_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    snooze_count = Column(
        Integer,
        default=0,
        nullable=False,
    )

    response_time_seconds = Column(
        Integer,
        nullable=True,
    )

    dismissal_status = Column(
        String(50),
        default="dismissed",
    )
    # =====================================================
    # RELATIONSHIPS
    # =====================================================

    alarm = relationship(
        "Alarm",
        back_populates="sessions",
    )


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    priority = Column(String(50), default="info", nullable=False)  # info, warning, urgent
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    creator = relationship("User")


class UserNotification(Base):
    __tablename__ = "user_notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category = Column(String(50), nullable=False)  # bedtime, wake_advance, habit, challenge, progress, announcement
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    priority = Column(String(50), default="normal", nullable=False)  # normal, high, urgent
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="notifications")