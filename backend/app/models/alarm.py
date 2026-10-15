from datetime import datetime, time

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Alarm(Base):
    __tablename__ = "alarms"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    title: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    alarm_time: Mapped[time] = mapped_column(
        Time,
        nullable=False
    )

    recurrence: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="daily"
    )

    challenge_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="math"
    )

    difficulty: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="easy"
    )

    snooze_limit: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=2
    )

    enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False
    )