from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AlarmEvent(Base):
    """One alarm interaction: triggered, snoozed or dismissed."""

    __tablename__ = "alarm_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    alarm_id: Mapped[int] = mapped_column(
        ForeignKey("alarms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    event_type: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )

    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
