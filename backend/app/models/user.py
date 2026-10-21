from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Float
)

from ..database import Base


class User(Base):

    __tablename__ = "users"

    # ============================================================
    # BASIC USER INFORMATION
    # ============================================================

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String(100),
        nullable=False
    )

    email = Column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )

    password_hash = Column(
        String(255),
        nullable=False
    )

    # ============================================================
    # SYSTEM ROLE
    # ============================================================

    role = Column(
        String(30),
        default="user",
        nullable=False
    )

    # ============================================================
    # PROFILE / HABIT INFORMATION
    # ============================================================

    preferred_wake_time = Column(
        String(5),
        default="07:00"
    )

    sleep_duration = Column(
        Float,
        default=8.0
    )

    timezone = Column(
        String(100),
        default="Asia/Kolkata"
    )

    productivity_goal = Column(
        String(255),
        default=""
    )

    difficulty_preference = Column(
        String(20),
        default="medium"
    )

    habit_preferences = Column(
        String(500),
        default=""
    )

    # ============================================================
    # NEW: ROLE PREFERENCE
    # ============================================================

    role_preference = Column(
        String(50),
        nullable=True,
        default=None
    )

    # ============================================================
    # CREATED DATE
    # ============================================================

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )