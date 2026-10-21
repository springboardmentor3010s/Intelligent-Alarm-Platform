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


class AlarmPerformance(Base):
    __tablename__ = "alarm_performance"
    __table_args__ = (
        UniqueConstraint(
            "completion_activity_id",
            name="uq_alarm_performance_completion_activity",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    alarm_id = Column(
        Integer,
        ForeignKey("alarms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    completion_activity_id = Column(
        Integer,
        ForeignKey("activities.id", ondelete="CASCADE"),
        nullable=False,
    )
    session_id = Column(String(64), nullable=True, index=True)
    alarm_title = Column(String(120), nullable=False)
    challenge_type = Column(String(30), nullable=True)
    difficulty = Column(String(20), nullable=True)
    total_questions = Column(Integer, nullable=False, default=0)
    correct_answers = Column(Integer, nullable=False, default=0)
    accuracy_pct = Column(Float, nullable=True)
    average_response_time_seconds = Column(Float, nullable=True)
    snoozes_before_completion = Column(Integer, nullable=True)
    challenge_completed = Column(Boolean, nullable=False, default=False)
    completed_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    recommendation_id = Column(Integer, ForeignKey("recommendations.id"), nullable=True)
    recommendation_title = Column(String(200), nullable=False)
    recommendation_reason = Column(String(1000), nullable=False)
    suggested_action = Column(String(500), nullable=False)
    recommendation_priority = Column(String(20), nullable=False, default="medium")
