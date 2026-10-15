from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime

from app.db.base import Base


class RLQValue(Base):
    __tablename__ = "rl_q_values"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, nullable=False, index=True)

    state = Column(String, nullable=False)
    action = Column(String, nullable=False)

    q_value = Column(Float, nullable=False, default=0.0)

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )