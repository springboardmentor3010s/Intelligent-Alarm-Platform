from typing import Literal

from pydantic import BaseModel, Field


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


class ChallengeGenerateRequest(BaseModel):
    user_id: int | None = Field(
        default=None,
        description="ID of the user requesting the challenge (defaults to you)",
    )

    challenge_type: ChallengeType = Field(
        default="math",
        description="Type of cognitive challenge",
    )

    difficulty: DifficultyLevel | None = Field(
        default=None,
        description=(
            "Starting level. Leave empty to let the adaptive engine "
            "choose from the user's recent performance."
        ),
    )


class ChallengeResponse(BaseModel):
    id: int
    challenge_type: ChallengeType
    difficulty: DifficultyLevel
    question: str
    options: list[str] | None = None


class ChallengeAnswerRequest(BaseModel):
    challenge_id: int = Field(
        ...,
        description="ID of the challenge being answered",
    )

    user_id: int | None = Field(
        default=None,
        description="ID of the user answering the challenge (defaults to you)",
    )

    answer: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Answer submitted by the user",
    )

    response_time: float = Field(
        ...,
        ge=0,
        description="Time taken by the user to answer in seconds",
    )


class ChallengeAnswerResponse(BaseModel):
    correct: bool
    message: str
    attempt_number: int