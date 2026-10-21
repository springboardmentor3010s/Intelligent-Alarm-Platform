from pydantic import BaseModel


class ChallengeAnswerRequest(BaseModel):

    answer: str

    response_time_seconds: float = 0


class ChallengeQuestionResponse(BaseModel):

    id: int

    question_number: int

    question: str


class ChallengeSessionResponse(BaseModel):

    session_id: str

    alarm_id: int

    challenge_type: str

    difficulty: str

    total_questions: int

    questions: list[ChallengeQuestionResponse]