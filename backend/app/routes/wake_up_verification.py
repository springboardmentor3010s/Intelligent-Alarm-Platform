from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import (
    ensure_access,
    ensure_owner_or_admin,
    get_current_user,
    user_scope,
)
from app.db.database import get_db
from app.models.alarm import Alarm
from app.models.challenge_attempt import ChallengeAttempt
from app.models.user import User
from app.models.wake_up_verification import WakeUpVerification
from app.schemas.wake_up_verification import (
    WakeUpVerificationCompleteRequest,
    WakeUpVerificationCompleteResponse,
    WakeUpVerificationStartRequest,
    WakeUpVerificationStartResponse,
)
from app.services import verification_rules as rules

router = APIRouter(
    prefix="/wake-up-verification",
    tags=["Wake-Up Verification"],
    dependencies=[Depends(user_scope)],
)


def _attempts_since(db: Session, verification: WakeUpVerification):
    # challenge_attempts.created_at is stored as naive UTC.
    started = verification.created_at
    if started.tzinfo is not None:
        started = started.astimezone(timezone.utc).replace(tzinfo=None)

    rows = db.execute(
        select(ChallengeAttempt)
        .where(
            ChallengeAttempt.user_id == verification.user_id,
            ChallengeAttempt.created_at >= started,
        )
        .order_by(ChallengeAttempt.created_at, ChallengeAttempt.id)
    ).scalars().all()
    return [
        rules.Attempt(r.challenge_id, bool(r.is_correct), r.response_time)
        for r in rows
    ]


def _verification_for(
    db: Session, verification_id: int, current: User, write: bool
) -> WakeUpVerification:
    verification = db.get(WakeUpVerification, verification_id)
    if verification is None:
        raise HTTPException(
            status_code=404,
            detail="Wake-up verification not found.",
        )
    ensure_access(db, current, verification.user_id)
    if write:
        ensure_owner_or_admin(current, verification.user_id)
    return verification


@router.get("/methods")
def list_methods():
    """The verification methods and what each one asks the user to do."""
    return {
        "methods": [
            {
                "id": method,
                "description": rules.DESCRIPTIONS[method],
                "uses_challenges": method in rules.COGNITIVE_METHODS,
            }
            for method in rules.ALL_METHODS
        ]
    }


@router.post(
    "/start",
    response_model=WakeUpVerificationStartResponse,
)
def start_verification(
    request: WakeUpVerificationStartRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = request.user_id or current.id

    # Check whether the user exists
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    if request.alarm_id is not None:
        alarm = db.get(Alarm, request.alarm_id)
        if alarm is None or alarm.user_id != user_id:
            raise HTTPException(
                status_code=404,
                detail="Alarm not found.",
            )

    # Find previous verification attempts for this user/alarm
    query = select(func.count(WakeUpVerification.id)).where(
        WakeUpVerification.user_id == user_id,
    )

    if request.alarm_id is not None:
        query = query.where(
            WakeUpVerification.alarm_id == request.alarm_id
        )

    previous_attempts = db.scalar(query) or 0

    attempt_number = previous_attempts + 1

    verification = WakeUpVerification(
        user_id=user_id,
        alarm_id=request.alarm_id,
        status="in_progress",
        verification_method=request.verification_method,
        attempt_number=attempt_number,
        successful=False,
    )

    try:
        db.add(verification)
        db.commit()
        db.refresh(verification)

    except Exception as error:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to start wake-up verification.",
        ) from error

    return WakeUpVerificationStartResponse(
        verification_id=verification.id,
        status=verification.status,
        verification_method=verification.verification_method,
        attempt_number=verification.attempt_number,
    )


@router.get("/status/{verification_id}")
def verification_status(
    verification_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Progress towards the verification, for cognitive methods."""
    verification = _verification_for(db, verification_id, current, write=False)

    progress = rules.evaluate(
        verification.verification_method,
        _attempts_since(db, verification),
    )
    progress["verification_id"] = verification.id
    progress["status"] = verification.status
    return progress


@router.post(
    "/complete",
    response_model=WakeUpVerificationCompleteResponse,
)
def complete_verification(
    request: WakeUpVerificationCompleteRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Find verification session
    verification = _verification_for(
        db, request.verification_id, current, write=True
    )

    # Prevent completing an already completed verification
    if verification.status in {"completed", "failed"}:
        raise HTTPException(
            status_code=400,
            detail="This verification has already been completed.",
        )

    successful = request.successful
    still_in_progress = False
    in_progress_message = ""

    # Challenge-based methods are judged from recorded answers, so the
    # client cannot simply report success.
    if verification.verification_method in rules.COGNITIVE_METHODS:
        outcome = rules.evaluate(
            verification.verification_method,
            _attempts_since(db, verification),
        )
        if request.successful and not outcome["satisfied"]:
            # The user may keep solving challenges, so stay open.
            still_in_progress = True
            successful = False
            in_progress_message = (
                "Not finished yet: "
                f"{outcome['description']} "
                f"({outcome['progress']}/{outcome['required']})"
            )
        else:
            successful = bool(outcome["satisfied"]) and request.successful

    if still_in_progress:
        return WakeUpVerificationCompleteResponse(
            verification_id=verification.id,
            successful=False,
            status="in_progress",
            message=in_progress_message,
            attempt_number=verification.attempt_number,
        )

    verification.response_time = request.response_time
    verification.successful = successful
    verification.completed_at = datetime.now(timezone.utc)

    if successful:
        verification.status = "completed"
        message = "Wake-up verification successful. Alarm can be dismissed."
    else:
        verification.status = "failed"
        message = "Wake-up verification failed. Please try again."

    try:
        db.commit()
        db.refresh(verification)

    except Exception as error:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to complete wake-up verification.",
        ) from error

    return WakeUpVerificationCompleteResponse(
        verification_id=verification.id,
        successful=verification.successful,
        status=verification.status,
        message=message,
        attempt_number=verification.attempt_number,
    )


@router.get("/history/{user_id}")
def verification_history(
    user_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Wake-up confirmation tracking: every verification, newest first."""
    if db.get(User, user_id) is None:
        raise HTTPException(status_code=404, detail="User not found.")

    rows = db.execute(
        select(WakeUpVerification)
        .where(WakeUpVerification.user_id == user_id)
        .order_by(WakeUpVerification.created_at.desc())
        .limit(max(1, min(limit, 200)))
    ).scalars().all()

    return {
        "items": [
            {
                "id": v.id,
                "alarm_id": v.alarm_id,
                "method": v.verification_method,
                "status": v.status,
                "successful": v.successful,
                "attempt_number": v.attempt_number,
                "response_time": v.response_time,
                "created_at": v.created_at,
                "completed_at": v.completed_at,
            }
            for v in rows
        ]
    }
