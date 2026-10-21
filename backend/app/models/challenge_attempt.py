from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)

from ..database import Base


class ChallengeAttempt(Base):
    __tablename__ = "challenge_attempts"
    __table_args__ = (
        UniqueConstraint(
            "challenge_id",
            "attempt_number",
            name="uq_challenge_attempt_number",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    challenge_id = Column(
        Integer,
        ForeignKey("challenges.id"),
        nullable=False,
        index=True,
    )
    attempt_number = Column(Integer, nullable=False)
    difficulty = Column(String(20), nullable=False)
    challenge_type = Column(String(30), nullable=False)
    user_answer = Column(String(255), nullable=False)
    is_correct = Column(Boolean, nullable=False)
    is_completed = Column(Boolean, nullable=False)
    response_time = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
