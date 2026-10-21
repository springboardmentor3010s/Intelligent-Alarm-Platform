from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(30), nullable=False, default="user")  # 'user', 'wellness_coach', 'admin'
    created_at = Column(DateTime, server_default=func.now())

    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    habits = relationship("Habit", back_populates="user", cascade="all, delete-orphan")
    alarms = relationship("Alarm", back_populates="user", cascade="all, delete-orphan")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    preferred_wakeup_time = Column(String(20), default="06:30 AM")
    sleep_duration = Column(Float, default=7.5)  # in hours
    time_zone = Column(String(50), default="UTC+05:30")
    productivity_goals = Column(Text, default="Morning meditation, Deep work session")
    difficulty_preference = Column(String(20), default="Beginner")  # Beginner, Easy, Medium, Hard, Expert
    habit_preferences = Column(Text, default="Morning Routine, Sleep Optimization")
    sleep_schedule_start = Column(String(20), default="22:30")
    sleep_schedule_end = Column(String(20), default="06:30")

    user = relationship("User", back_populates="profile")
