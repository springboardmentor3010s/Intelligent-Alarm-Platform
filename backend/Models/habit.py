from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class Habit(Base):
    __tablename__ = "habits"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    category = Column(String(50), default="Health & Fitness")
    frequency = Column(String(50), default="Daily")
    target_duration_minutes = Column(Integer, default=15)
    description = Column(Text, default="")
    priority = Column(String(20), default="Medium")  # High, Medium, Low
    time_of_day = Column(String(30), default="Morning")  # Morning, Afternoon, Evening, Bedtime
    reminder_time = Column(String(5), nullable=True)
    start_date = Column(Date, nullable=True)
    target_date = Column(Date, nullable=True)
    goal_target = Column(String(255), default="")
    notes = Column(Text, default="")
    is_enabled = Column(Boolean, default=True, nullable=False)
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="habits")
