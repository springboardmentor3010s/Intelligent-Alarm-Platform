from typing import Literal

from pydantic import BaseModel, Field


VerificationMethod = Literal[
    "hold",
    "confirmation",
    "puzzle",
    "multi_step",
    "consecutive",
    "time_based",
    "accuracy",
]


class WakeUpVerificationStartRequest(BaseModel):
    user_id: int | None = Field(
        default=None,
        description="ID of the user (defaults to you)",
    )
    alarm_id: int | None = Field(
        default=None,
        description="ID of the alarm being verified",
    )
    verification_method: VerificationMethod = Field(
        default="hold",
        description="Verification method",
    )


class WakeUpVerificationStartResponse(BaseModel):
    verification_id: int
    status: str
    verification_method: str
    attempt_number: int


class WakeUpVerificationCompleteRequest(BaseModel):
    verification_id: int = Field(
        ...,
        description="ID of the verification session",
    )
    successful: bool = Field(
        ...,
        description="Whether the user successfully completed verification",
    )
    response_time: float = Field(
        ...,
        ge=0,
        description="Time taken to complete verification in seconds",
    )


class WakeUpVerificationCompleteResponse(BaseModel):
    verification_id: int
    successful: bool
    status: str
    message: str
    attempt_number: int