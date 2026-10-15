from typing import Literal

from pydantic import BaseModel, Field


# once = One-Time Alarm, daily = Daily Alarm, weekdays = Weekday Alarm,
# weekends = Weekend Alarm, smart = Smart Adaptive Alarm.
RecurrenceType = Literal[
    "once",
    "daily",
    "weekdays",
    "weekends",
    "smart",
]

ChallengeType = Literal[
    "math",
    "logic",
    "memory",
    "word",
    "pattern",
    "riddle",
    "quiz",
]

DifficultyLevel = Literal[
    "beginner",
    "easy",
    "medium",
    "hard",
    "expert",
]


class AlarmCreateRequest(BaseModel):
    user_id: int | None = Field(
        default=None,
        description="ID of the user creating the alarm (defaults to you)",
    )
    title: str = Field(
        default="Morning Alarm",
        min_length=1,
        max_length=100
    )
    alarm_time: str = Field(
        ...,
        description="Alarm time in HH:MM format"
    )
    recurrence: RecurrenceType = Field(default="daily")
    challenge_type: ChallengeType = Field(default="math")
    difficulty: DifficultyLevel = Field(default="easy")
    snooze_limit: int = Field(
        default=2,
        ge=0,
        le=10
    )


class AlarmUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=100)
    alarm_time: str | None = Field(default=None, description="HH:MM")
    recurrence: RecurrenceType | None = None
    challenge_type: ChallengeType | None = None
    difficulty: DifficultyLevel | None = None
    snooze_limit: int | None = Field(default=None, ge=0, le=10)
    enabled: bool | None = None


class AlarmResponse(BaseModel):
    id: int
    user_id: int
    title: str
    alarm_time: str
    recurrence: str
    challenge_type: str
    difficulty: str
    snooze_limit: int
    enabled: bool
    next_trigger: str | None = None


class AlarmToggleRequest(BaseModel):
    enabled: bool


class AlarmMessageResponse(BaseModel):
    message: str


class AlarmDismissRequest(BaseModel):
    verification_id: int = Field(
        ...,
        description="A successful wake-up verification for this alarm",
    )
