"""Challenge routes for Intelligent Cognitive Alarm Platform."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..Models import User, Challenge, ChallengeAttempt
from ..schemas import ChallengeListRes, ChallengeRes
from ..services.challenge_service import ChallengeService
from ..api.deps import oauth2_scheme, get_current_user

router = APIRouter(prefix="/challenges", tags=["challenges"])


@router.get("", response_model=list[ChallengeListRes])
def list_challenges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    difficulty: str = None,
    challenge_type: str = None,
):
    """List available challenges with optional filtering."""
    challenges = db.query(Challenge).filter(Challenge.is_active == True).all()

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
):
    """Get next adaptive challenge for the user based on performance history."""
    # Use the ChallengeService adaptive engine
    challenge = await ChallengeService.get_adaptive_challenge(db, current_user.id)

    if not challenge:
        raise HTTPException(status_code=404, detail="No available challenges")

    # Generate puzzle payload using the challenge service
    payload = ChallengeService._generate_payload(challenge.challenge_type)

    return ChallengeRes(
        id=challenge.id,
        title=challenge.title,
        description=challenge.description,
        challenge_type=challenge.challenge_type,
        difficulty=challenge.difficulty,
        generated_at=challenge.generated_at,
        puzzle_payload=payload,
    )