from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List

class Register(BaseModel):
    name: str
    username: Optional[str] = None
    email: EmailStr
    password: str = Field(min_length=6)
    confirm_password: str
    timezone: str = "Asia/Kolkata"
    role: Optional[str] = "USER"
    security_code: Optional[str] = None

class Login(BaseModel):
    username_or_email: Optional[str] = None
    email: Optional[str] = None # Accepts either username or email
    password: str
    role: Optional[str] = None


class AlarmCreate(BaseModel):
    title: str
    alarm_time: str
    timezone: str = "Asia/Kolkata"
    repeat_type: str = "daily" # "once" | "daily" | "weekly" | "monthly"
    repeat_days: List[str] = []
    enabled: bool = True
    sound: str = "default"
    volume: int = Field(default=80, ge=0, le=100)
    snooze_enabled: bool = False
    snooze_duration: int = Field(default=5, ge=1)
    max_snoozes: int = Field(default=2, ge=0)
    challenge_type: str = "MATH"
    difficulty: str = "AUTO"  # EASY | MEDIUM | HARD | AUTO
    number_of_challenges: int = Field(default=3, ge=1, le=10)
    alarm_role: str = "STANDARD"
    is_mandatory: bool = False
    assigned_to: Optional[str] = None

class ChallengeSubmit(BaseModel):
    answer: str
    response_time: float = 0

class RoleUpdate(BaseModel):
    role: str

class WellnessCoachAssignment(BaseModel):
    wellness_coach_id: Optional[str] = None
