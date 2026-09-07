"""Challenge verification service.

Server-authoritative checks that gate dismissals on completed, all-correct
attempts. Raised errors map to the same HTTP codes/detail strings the API
always returned so existing clients and smoke tests are unaffected.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..Models import ChallengeAttempt


def verify_finished_attempt(
    db: Session, user_id: int, attempt_id: int
) -> ChallengeAttempt:
    """Return the attempt only when it belongs to the user and was fully solved.

    Raises:
        HTTPException 404 - attempt missing or owned by another user
        HTTPException 400 - attempt incomplete / not all questions correct
    """
    attempt = db.query(ChallengeAttempt).filter(
        ChallengeAttempt.id == attempt_id,
        ChallengeAttempt.user_id == user_id,
    ).first()

    if not attempt:
        raise HTTPException(status_code=404, detail="Challenge attempt not found")

    if not attempt.completed or attempt.correct_answers < attempt.total_questions:
        raise HTTPException(
            status_code=400,
            detail="Challenge not completed successfully. All questions must be answered correctly.",
        )

    return attempt
