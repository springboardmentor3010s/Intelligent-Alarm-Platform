from datetime import datetime

from pydantic import BaseModel


class SessionResponse(BaseModel):
    id: int
    alarm_id: int
    challenge_id: int | None
    user_answer: str | None
    is_correct: bool | None
    session_status: str
    started_at: datetime
    completed_at: datetime | None
    snooze_count: int = 0
    response_time_seconds: int | None = None
    dismissal_status: str = "dismissed"
    adaptive_difficulty: dict | None = None

    class Config:
        from_attributes = True
class SessionAnswer(BaseModel):
    answer: str