from datetime import datetime
from pydantic import BaseModel


# =========================================================
# CHALLENGE RESPONSE
# Sent to frontend
# NEVER expose correct_answer here
# =========================================================

class ChallengeResponse(BaseModel):
    id: int
    alarm_id: int
    challenge_type: str
    question: str
    difficulty: str

    class Config:
        from_attributes = True


# =========================================================
# SUBMIT ANSWER
# =========================================================

class ChallengeAnswer(BaseModel):
    answer: str


# =========================================================
# ANSWER RESULT
# =========================================================

class ChallengeResult(BaseModel):
    correct: bool
    message: str
    session_id: int
    challenge_id: int
    session_status: str
    completed_at: datetime