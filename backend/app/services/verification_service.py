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
    """Return the attempt only when it belongs to the user, was fully solved,
    and has not already been redeemed to dismiss an alarm.

    Raises:
        HTTPException 404 - attempt missing or owned by another user
        HTTPException 409 - attempt already consumed by a previous dismissal
        HTTPException 400 - attempt incomplete / not all questions correct
    """
    attempt = db.query(ChallengeAttempt).filter(
        ChallengeAttempt.id == attempt_id,
        ChallengeAttempt.user_id == user_id,
    ).first()

    if not attempt:
        raise HTTPException(status_code=404, detail="Challenge attempt not found")

    if attempt.consumed_at is not None:
        raise HTTPException(
            status_code=409,
            detail="This challenge attempt has already been used to dismiss an alarm",
        )

    if not attempt.completed or attempt.correct_answers < attempt.total_questions:
        raise HTTPException(
            status_code=400,
            detail="Challenge not completed successfully. All questions must be answered correctly.",
        )

    return attempt
