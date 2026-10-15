from datetime import time

from pydantic import BaseModel, Field


class AlarmCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    alarm_time: time
    alarm_type: str = "daily"
    repeat_pattern: str | None = None

    # Cognitive challenge preferences
    challenge_type: str = "math"
    difficulty: str = "medium"


class AlarmUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    alarm_time: time
    alarm_type: str = "daily"
    repeat_pattern: str | None = None
    is_active: bool = True

    # Cognitive challenge preferences
    challenge_type: str = "math"
    difficulty: str = "medium"


class AlarmResponse(BaseModel):
    id: int
    name: str
    alarm_time: time
    alarm_type: str
    repeat_pattern: str | None
    is_active: bool

    # Cognitive challenge preferences
    challenge_type: str
    difficulty: str

    class Config:
        from_attributes = True