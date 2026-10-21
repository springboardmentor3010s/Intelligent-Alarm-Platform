from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer

from ..database import Base


class LoginEvent(Base):
    __tablename__ = "login_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    logged_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
