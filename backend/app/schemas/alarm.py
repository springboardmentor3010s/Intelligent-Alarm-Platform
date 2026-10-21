from typing import Optional

from pydantic import BaseModel, ConfigDict


class AlarmCreate(BaseModel):

    title: str

    description: str = ""

    alarm_time: str

    alarm_type: str = "daily"

    days: str = ""

    difficulty: str = "medium"

    challenge_type: str = "math"

    is_smart: bool = False

    is_active: bool = True

    challenge_question_count: int = 5


class AlarmUpdate(BaseModel):

    title: Optional[str] = None

    description: Optional[str] = None

    alarm_time: Optional[str] = None

    alarm_type: Optional[str] = None

    days: Optional[str] = None

    difficulty: Optional[str] = None

    challenge_type: Optional[str] = None

    is_smart: Optional[bool] = None

    is_active: Optional[bool] = None

    challenge_question_count: Optional[int] = None


class AlarmResponse(BaseModel):

    model_config = ConfigDict(
        from_attributes=True
    )

    id: int

    user_id: int

    title: str

    description: str

    alarm_time: str

    alarm_type: str

    days: str

    difficulty: str

    challenge_type: str

    is_smart: bool

    is_active: bool

    snooze_count: int

    completed_count: int

    challenge_question_count: int

    challenge_completed: bool