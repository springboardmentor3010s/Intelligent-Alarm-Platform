from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey
)

from ..database import Base


class Alarm(Base):

    __tablename__ = "alarms"

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

    title = Column(
        String(120),
        nullable=False
    )

    description = Column(
        String(500),
        default=""
    )

    alarm_time = Column(
        String(5),
        nullable=False
    )

    alarm_type = Column(
        String(30),
        default="daily"
    )

    days = Column(
        String(150),
        default=""
    )

    difficulty = Column(
        String(20),
        default="medium"
    )

    challenge_type = Column(
        String(30),
        default="math"
    )

    is_smart = Column(
        Boolean,
        default=False
    )

    is_active = Column(
        Boolean,
        default=True
    )

    snooze_count = Column(
        Integer,
        default=0
    )

    completed_count = Column(
        Integer,
        default=0
    )

    last_triggered = Column(
        DateTime,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    # Number of questions in the cognitive challenge
    challenge_question_count = Column(
        Integer,
        default=5,
        nullable=False
    )

    # Becomes True only after all challenge questions
    # are answered correctly
    challenge_completed = Column(
        Boolean,
        default=False,
        nullable=False
    )