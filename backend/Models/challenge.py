from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class WakeUpEvent(Base):
    __tablename__ = "wake_up_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    alarm_id = Column(Integer, ForeignKey("alarms.id"), nullable=False)

    started_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)

    status = Column(
        String(30),
        nullable=False,
        default="in_progress"
    )

    required_challenges = Column(Integer, nullable=False, default=1)
    completed_challenges = Column(Integer, nullable=False, default=0)
    total_attempts = Column(Integer, nullable=False, default=0)

    verification_status = Column(
        String(30),
        nullable=False,
        default="pending"
    )

    snoozes = Column(Integer, default=0)
    difficulty_adapted = Column(Boolean, default=False)

    user = relationship("User")
    alarm = relationship("Alarm")
    challenges = relationship(
        "Challenge",
        back_populates="wake_up_event"
    )


class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    alarm_id = Column(
        Integer,
        ForeignKey("alarms.id"),
        nullable=False
    )

    wake_up_event_id = Column(
        Integer,
        ForeignKey("wake_up_events.id"),
        nullable=True
    )

    challenge_type = Column(
        String(50),
        nullable=False
    )

    difficulty = Column(
        String(20),
        nullable=False,
        default="Medium"
    )

    question = Column(
        Text,
        nullable=False
    )

    options = Column(
        Text,
        nullable=True
    )

    correct_answer = Column(
        String(255),
        nullable=False
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    expires_at = Column(
        DateTime,
        nullable=True
    )

    status = Column(
        String(20),
        default="pending"
    )

    user = relationship("User")
    alarm = relationship("Alarm")

    wake_up_event = relationship(
        "WakeUpEvent",
        back_populates="challenges"
    )

    attempts = relationship(
        "ChallengeAttempt",
        back_populates="challenge",
        cascade="all, delete-orphan"
    )


class ChallengeAttempt(Base):
    __tablename__ = "challenge_attempts"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    challenge_id = Column(
        Integer,
        ForeignKey("challenges.id"),
        nullable=False
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    attempt_number = Column(
        Integer,
        nullable=False
    )

    user_answer = Column(
        String(255),
        nullable=True
    )

    is_correct = Column(
        Boolean,
        default=False
    )

    score = Column(
        Integer,
        default=0
    )

    solve_time = Column(
        Integer,
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    challenge = relationship(
        "Challenge",
        back_populates="attempts"
    )

    user = relationship("User")