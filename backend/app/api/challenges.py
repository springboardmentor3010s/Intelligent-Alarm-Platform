"""Challenge routes for Intelligent Cognitive Alarm Platform."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..Models import User, Challenge, ChallengeAttempt
from ..schemas import ChallengeListRes, ChallengeRes, ChallengeSubmitReq, ChallengeSubmitRes
from ..services.challenge_service import ChallengeService
from ..api.deps import get_current_user

router = APIRouter(prefix="/challenges", tags=["challenges"])


@router.get("", response_model=list[ChallengeListRes])
def list_challenges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    difficulty: str = None,
    challenge_type: str = None,
):
    """List available challenges with optional filtering."""
    challenges = db.query(Challenge).filter(Challenge.is_active).all()

    if difficulty:
        challenges = [c for c in challenges if c.difficulty == difficulty]
    if challenge_type:
        challenges = [c for c in challenges if c.challenge_type == challenge_type]

    return [
        ChallengeListRes(
            id=c.id,
            title=c.title,
            challenge_type=c.challenge_type,
            difficulty=c.difficulty,
            is_active=c.is_active,
        )
        for c in challenges
    ]


@router.get("/next", response_model=ChallengeRes)
async def get_next_challenge(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    challenge_type: str = None,
    difficulty: str = None,
    question_count: int = None,
):
    """Get the next adaptive challenge and create a pending, server-verified attempt.

    The returned `puzzle_payload` contains only prompts/options/timeout — the
    expected answers stay server-side on the pending attempt.
    """
    challenge, attempt = await ChallengeService.get_adaptive_challenge(
        db,
        current_user.id,
        current_difficulty=difficulty,
        challenge_type=challenge_type,
        question_count=question_count,
    )

    return ChallengeRes(
        id=challenge.id,
        title=challenge.title,
        description=challenge.description,
        challenge_type=challenge.challenge_type,
        difficulty=challenge.difficulty,
        generated_at=challenge.generated_at,
        challenge_attempt_id=attempt.id,
        puzzle_payload=ChallengeService.payload_for(attempt),
    )


@router.post("/submit", response_model=ChallengeSubmitRes)
def submit_challenge(
    request: ChallengeSubmitReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Authoritative server-side verification of a challenge attempt."""
    try:
        attempt = ChallengeService.submit_attempt(
            db,
            current_user.id,
            request.challenge_id,
            request.challenge_attempt_id,
            user_answer=request.user_answer,
            user_answers=request.user_answers,
            time_taken_seconds=request.time_taken_seconds,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    attempt = db.query(ChallengeAttempt).filter(ChallengeAttempt.id == attempt.id).first()
    return ChallengeSubmitRes(
        challenge_id=request.challenge_id,
        challenge_attempt_id=attempt.id,
        correct=attempt.completed,
        completed=attempt.completed,
        correct_answers=attempt.correct_answers,
        total_questions=attempt.total_questions,
    )
