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


class ProductivityLog(Base):
    """A daily productivity check-in written by the user."""

    __tablename__ = "productivity_logs"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "log_date", name="uq_productivity_user_date"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    log_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Self-rated productivity from 1 (low) to 10 (high).
    rating: Mapped[int] = mapped_column(Integer, nullable=False)

    tasks_planned: Mapped[int | None] = mapped_column(Integer, nullable=True)

    tasks_completed: Mapped[int | None] = mapped_column(Integer, nullable=True)

    focus_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
