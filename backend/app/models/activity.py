from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Float,
    ForeignKey
)

from ..database import Base


class Activity(Base):

    __tablename__ = "activities"

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
        nullable=True
    )

    activity_type = Column(
        String(40),
        nullable=False
    )

    value = Column(
        Float,
        default=0
    )

    metadata_json = Column(
        String(1000),
        default="{}"
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )