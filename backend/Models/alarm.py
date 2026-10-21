from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class Alarm(Base):
    __tablename__ = "alarms"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(150), nullable=False, default="Morning Alarm")
    time = Column(String(10), nullable=False)  # e.g., "07:00"
    alarm_type = Column(String(50), nullable=False, default="Daily")  # Daily, Weekday, Weekend, One-Time, Smart Adaptive
    days_of_week = Column(String(100), default="Mon,Tue,Wed,Thu,Fri,Sat,Sun")
    is_active = Column(Boolean, default=True)
    challenge_type = Column(String(50), default="Math Problems")  # Math Problems, Logic Puzzles, Memory Challenges, Word Games, Pattern Recognition, Riddles, Quick Quizzes
    difficulty = Column(String(20), default="Beginner")  # Beginner, Easy, Medium, Hard, Expert
    snooze_limit = Column(Integer, default=3)
    sound_tone = Column(String(50), default="Gentle Chimes")
    reminder_message = Column(String(255), nullable=True)
    num_challenges = Column(Integer, default=1)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="alarms")
