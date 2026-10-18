from sqlalchemy import Column, Integer, String, Text, DateTime, Time, ForeignKey, Boolean
from sqlalchemy.sql import func
from database import Base


# =========================
# USER
# =========================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String(30), default="user")
    fcm_token = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


# =========================
# USER PROFILE
# =========================

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False
    )

    preferred_wake_up_time = Column(Time)
    sleep_duration = Column(Integer)
    time_zone = Column(String(100))
    productivity_goal = Column(Text)
    difficulty_preference = Column(String(30))
    habit_preferences = Column(Text)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now())



# =========================
# ALARM
# =========================

class Alarm(Base):
    __tablename__ = "alarms"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    alarm_time = Column(Time, nullable=False)
    alarm_name = Column(String(100))
    is_active = Column(Boolean, default=True)

    # Alarm repetition
    # daily, weekdays, weekends, custom
    repeat_type = Column(
        String(20),
        default="daily",
        nullable=False
    )

    # For custom repetition.
    # Example: ["monday", "wednesday", "friday"]
    repeat_days = Column(
        Text,
        nullable=True
    )

    created_at = Column(DateTime, server_default=func.now())

# =========================
# RECOMMENDATION
# =========================

class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    coach_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    recommendation = Column(Text, nullable=False)

    created_at = Column(DateTime, server_default=func.now())


# =========================================================
# MILESTONE 2 - COGNITIVE CHALLENGE
# =========================================================

class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True, index=True)

    # Type of challenge:
    # math, logic, memory, word, pattern, riddle, quiz
    challenge_type = Column(String(50), nullable=False)

    # Difficulty:
    # easy, medium, hard
    difficulty = Column(String(30), nullable=False)

    # Question displayed to the user
    question = Column(Text, nullable=False)

    # Correct answer stored on the server
    correct_answer = Column(String(255), nullable=False)

    # Optional choices for multiple-choice questions
    options = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())


# =========================================================
# MILESTONE 2 - CHALLENGE RESULT
# =========================================================

class ChallengeResult(Base):
    __tablename__ = "challenge_results"

    id = Column(Integer, primary_key=True, index=True)

    # User who attempted the challenge
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    # Challenge that was attempted
    challenge_id = Column(
        Integer,
        ForeignKey("challenges.id", ondelete="CASCADE"),
        nullable=False
    )

    # Answer submitted by the user
    user_answer = Column(String(255), nullable=False)

    # Whether the answer was correct
    is_correct = Column(Boolean, default=False)

    # Number of attempts
    attempts = Column(Integer, default=1)

    # Time taken to solve the challenge in seconds
    time_taken = Column(Integer, nullable=True)

    # When the challenge was completed
    completed_at = Column(DateTime, server_default=func.now())