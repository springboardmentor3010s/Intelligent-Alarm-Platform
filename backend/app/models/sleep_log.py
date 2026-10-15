from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SleepLog(Base):
    """A night of sleep recorded by the user."""

    __tablename__ = "sleep_logs"
    __table_args__ = (
        UniqueConstraint("user_id", "sleep_date", name="uq_sleep_user_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # The calendar date of the morning the user woke up.
    sleep_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    bed_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    wake_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)

    quality: Mapped[int | None] = mapped_column(Integer, nullable=True)

    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
