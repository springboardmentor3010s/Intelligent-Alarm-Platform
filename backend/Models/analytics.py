from sqlalchemy import Column, Integer, Float, ForeignKey, Date, String, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import date

from database import Base

class SleepLog(Base):
    __tablename__ = "sleep_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    date = Column(Date, default=date.today, nullable=False, index=True)
    
    target_sleep_time = Column(String(5), nullable=True) # "22:30"
    target_wake_time = Column(String(5), nullable=True)  # "06:30"
    
    actual_sleep_time = Column(String(5), nullable=True) # "23:00"
    actual_wake_time = Column(String(5), nullable=True)  # "07:00"
    
    user = relationship("User")

class BehaviorProfile(Base):
    __tablename__ = "behavior_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Store just the date part (e.g., '2026-09-17') so we have one profile per user per day.
    date = Column(Date, default=date.today, nullable=False, index=True)
    
    # Total combined score out of 100
    habit_score = Column(Integer, default=0)
    
    # 0-35 points
    wake_up_consistency_score = Column(Integer, default=0)
    
    # 0.0 to 1.0 representation of challenge success rate
    challenge_completion_rate = Column(Float, default=0.0)
    
    # Number of times snoozed today
    snooze_count = Column(Integer, default=0)
    
    # 0-20 points
    sleep_adherence_score = Column(Integer, default=0)

    user = relationship("User")

class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    date = Column(Date, default=date.today, nullable=False, index=True)
    
    category = Column(String(50), nullable=False) # "Sleep", "Wake-up", "Habit", "Productivity", "Challenge"
    message = Column(Text, nullable=False)
    priority = Column(String(20), default="Medium") # "High", "Medium", "Low"
    is_read = Column(Boolean, default=False)

    user = relationship("User")
