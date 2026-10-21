from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Float,
    ForeignKey
)

from ..database import Base


class Challenge(Base):

    __tablename__ = "challenges"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    alarm_id = Column(
        Integer,
        ForeignKey("alarms.id"),
        nullable=False,
        index=True
    )

    session_id = Column(
        String(64),
        nullable=False,
        index=True
    )

    question_number = Column(
        Integer,
        nullable=False
    )

    question = Column(
        String(500),
        nullable=False
    )

    answer = Column(
        String(255),
        nullable=False
    )

    user_answer = Column(
        String(255),
        nullable=True
    )

    challenge_type = Column(
        String(30),
        default="math",
        nullable=False
    )

    difficulty = Column(
        String(20),
        default="medium",
        nullable=False
    )

    is_correct = Column(
        Boolean,
        nullable=True
    )

    is_completed = Column(
        Boolean,
        default=False,
        nullable=False
    )

    response_time = Column(
        Float,
        default=0
    )

    attempt_count = Column(
        Integer,
        default=0,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )