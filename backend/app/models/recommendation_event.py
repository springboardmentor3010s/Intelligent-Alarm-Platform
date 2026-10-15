from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RecommendationEvent(Base):
    """Records whether a user viewed, accepted or dismissed a recommendation."""

    __tablename__ = "recommendation_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    recommendation_id: Mapped[str] = mapped_column(String(80), nullable=False)

    source: Mapped[str] = mapped_column(
        String(30), nullable=False, default="dashboard"
    )

    action: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
