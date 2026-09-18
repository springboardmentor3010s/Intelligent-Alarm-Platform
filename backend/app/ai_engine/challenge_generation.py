# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Challenge generation engine (AI/ML).

Concrete adapter over `services.challenge_service` implementing the
`ChallengeGenerator` interface. The generated attempt carries the answers
server-side only (no answer leakage); `/next` returns prompts/options alone.
"""

from typing import Any, Dict, Optional, Tuple

from sqlalchemy.orm import Session


async def generate_adaptive_challenge(
    db: Session,
    user_id: int,
    current_difficulty: str = "Medium",
    challenge_type: Optional[str] = None,
    question_count: Optional[int] = None,
) -> Tuple[Any, Any]:
    """Select/generate the next adaptive challenge and a pending attempt."""
    from ..services.challenge_service import ChallengeService

    return await ChallengeService.get_adaptive_challenge(
        db,
        user_id,
        current_difficulty=current_difficulty,
        challenge_type=challenge_type,
        question_count=question_count,
    )


def build_payload(attempt: Any) -> Dict[str, Any]:
    """Build the client puzzle payload (prompts/options/timeout, no answers)."""
    from ..services.challenge_service import ChallengeService

    return ChallengeService.payload_for(attempt)


def verify_submission(
    db: Session,
    user_id: int,
    challenge_id: int,
    challenge_attempt_id: int,
    user_answer: Any = None,
    user_answers: Any = None,
    time_taken_seconds: Optional[int] = None,
) -> Any:
    """Verify a submission against the stored attempt (server-authoritative)."""
    from ..services.challenge_service import ChallengeService

    return ChallengeService.submit_attempt(
        db,
        user_id,
        challenge_id,
        challenge_attempt_id,
        user_answer=user_answer,
        user_answers=user_answers,
        time_taken_seconds=time_taken_seconds,
    )
