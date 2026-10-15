from __future__ import annotations

from datetime import datetime, time
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


if TYPE_CHECKING:
    from app.models.user import User


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    sleep_target: Mapped[time | None] = mapped_column(
        Time,
        nullable=True,
    )

    wake_target: Mapped[time | None] = mapped_column(
        Time,
        nullable=True,
    )

    preferred_challenge: Mapped[str] = mapped_column(
        String(30),
        default="math",
        server_default="math",
        nullable=False,
    )

    current_difficulty: Mapped[str] = mapped_column(
        String(20),
        default="easy",
        server_default="easy",
        nullable=False,
    )

    daily_sleep_goal_minutes: Mapped[int] = mapped_column(
        Integer,
        default=480,
        server_default="480",
        nullable=False,
    )

    productivity_goals: Mapped[list[str] | None] = mapped_column(
        JSON,
        nullable=True,
    )

    habit_preferences: Mapped[list[str] | None] = mapped_column(
        JSON,
        nullable=True,
    )

    wake_up_goal: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    wake_goal_days_per_week: Mapped[int] = mapped_column(
        Integer,
        default=5,
        server_default="5",
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped[User] = relationship(
        back_populates="profile",
    )