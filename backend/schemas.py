from pydantic import BaseModel
from typing import Optional, List, Literal


# =========================
# USER REGISTRATION
# =========================

class UserRegister(BaseModel):
    name: str
    email: str
    password: str


# =========================
# USER LOGIN
# =========================

class UserLogin(BaseModel):
    email: str
    password: str


# =========================
# USER PROFILE
# =========================

class UserProfileCreate(BaseModel):
    preferred_wake_up_time: str
    sleep_duration: int
    time_zone: str
    productivity_goal: str
    difficulty_preference: str
    habit_preferences: str


# =========================
# ALARM
# =========================

class AlarmCreate(BaseModel):
    alarm_time: str
    alarm_name: str
    is_active: bool = True

    # Alarm repeat option
    repeat_type: Literal[
        "daily",
        "weekdays",
        "weekends",
        "custom"
    ] = "daily"

    # Used when repeat_type = "custom"
    # Example: ["monday", "wednesday", "friday"]
    repeat_days: List[str] = []


# =========================================================
# MILESTONE 2 - CHALLENGE SCHEMAS
# =========================================================

# Request for generating a challenge
class ChallengeRequest(BaseModel):
    challenge_type: str = "math"
    difficulty: str = "easy"


# Response when a challenge is generated
class ChallengeResponse(BaseModel):
    id: int
    challenge_type: str
    difficulty: str
    question: str
    options: Optional[str] = None


# User's answer to a challenge
class ChallengeAnswer(BaseModel):
    answer: str
    time_taken: Optional[int] = None


# Result returned after checking the answer
class ChallengeResultResponse(BaseModel):
    challenge_id: int
    user_answer: str
    is_correct: bool
    correct_answer: str
    attempts: int
    time_taken: Optional[int] = None