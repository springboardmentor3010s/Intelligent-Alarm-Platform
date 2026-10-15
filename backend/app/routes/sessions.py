from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import (
    Alarm,
    AlarmSession,
    CognitiveChallenge,
    User,
)
from app.services.challenge_generator import generate_challenge
from app.utils.dependencies import get_current_user
from app.services.adaptive_difficulty import (
    adjust_difficulty,
    evaluate_and_apply_adaptive_difficulty,
)
from app.schemas.session import SessionResponse, SessionAnswer

router = APIRouter(
    prefix="/api/sessions",
    tags=["Alarm Sessions"],
)


# ============================================================
# VALID VALUES
# ============================================================

VALID_CHALLENGE_TYPES = {
    "math",
    "logic",
    "memory",
    "word",
    "pattern",
    "riddle",
    "quiz",
}

VALID_DIFFICULTIES = {
    "beginner",
    "easy",
    "medium",
    "hard",
    "expert",
}


# ============================================================
# START ALARM SESSION
# ============================================================

@router.post(
    "/start/{alarm_id}",
    response_model=SessionResponse,
)
def start_session(
    alarm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # --------------------------------------------------------
    # 1. Find the alarm belonging to the logged-in user
    # --------------------------------------------------------

    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == current_user.id,
        )
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found",
        )

    # --------------------------------------------------------
    # 2. Make sure the alarm has valid cognitive preferences
    # --------------------------------------------------------

    challenge_type = (
        alarm.challenge_type or "math"
    ).strip().lower()

    difficulty = (
        alarm.difficulty or "medium"
    ).strip().lower()

    if challenge_type not in VALID_CHALLENGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported challenge type: {challenge_type}",
        )

    if difficulty not in VALID_DIFFICULTIES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported difficulty: {difficulty}",
        )

    # --------------------------------------------------------
    # 3. Check whether this alarm already has an active
    #    session.
    #
    #    This prevents duplicate sessions when the page is
    #    refreshed or the alarm is detected more than once.
    # --------------------------------------------------------

    existing_session = (
        db.query(AlarmSession)
        .filter(
            AlarmSession.alarm_id == alarm.id,
            AlarmSession.session_status == "started",
        )
        .order_by(AlarmSession.started_at.desc())
        .first()
    )

    if existing_session:
        now = datetime.now(timezone.utc)
        start_dt = (
            existing_session.started_at
            if existing_session.started_at.tzinfo
            else existing_session.started_at.replace(tzinfo=timezone.utc)
        )
        age_seconds = (now - start_dt).total_seconds()

        # If existing session has been abandoned for more than 5 minutes (300 seconds), expire it so a fresh session starts
        if age_seconds > 300:
            existing_session.session_status = "expired"
            existing_session.dismissal_status = "expired"
            existing_session.is_correct = False
            existing_session.completed_at = now
            existing_session.response_time_seconds = 30
            db.commit()
            existing_session = None
        elif existing_session.dismissal_status == "snoozed":
            # Resuming after snooze: reset started_at to now to accurately measure challenge response time
            existing_session.started_at = now
            existing_session.dismissal_status = "active"
            db.commit()
            db.refresh(existing_session)
            return existing_session
        else:
            return existing_session

    # --------------------------------------------------------
    # 4. Generate the challenge using the preferences saved
    #    with THIS alarm.
    # --------------------------------------------------------

    try:
        challenge_data = generate_challenge(
            challenge_type=challenge_type,
            difficulty=difficulty,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    # --------------------------------------------------------
    # 5. Save the generated cognitive challenge
    # --------------------------------------------------------

    challenge = CognitiveChallenge(
        alarm_id=alarm.id,
        challenge_type=challenge_data["challenge_type"],
        question=challenge_data["question"],
        correct_answer=challenge_data["correct_answer"],
        difficulty=challenge_data["difficulty"],
    )

    db.add(challenge)
    db.flush()

    # --------------------------------------------------------
    # 6. Create an alarm session linked to that challenge
    # --------------------------------------------------------

    session = AlarmSession(
        alarm_id=alarm.id,
        challenge_id=challenge.id,
        session_status="started",
        started_at=datetime.now(timezone.utc),
        snooze_count=0,
        dismissal_status="active",
    )

    db.add(session)

    db.commit()
    db.refresh(session)

    return session


## ============================================================
# GET SESSION HISTORY
# ============================================================

@router.get("/history")
def get_session_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(AlarmSession)
        .join(
            Alarm,
            AlarmSession.alarm_id == Alarm.id,
        )
        .filter(
            Alarm.user_id == current_user.id,
        )
        .order_by(
            AlarmSession.started_at.desc()
        )
        .all()
    )

    def utc_iso(value):
        if value is None:
            return None

        # PostgreSQL may return a naive datetime because
        # older database columns were created without timezone.
        # Our application stores these values as UTC.
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        else:
            value = value.astimezone(timezone.utc)

        return value.isoformat()

    return {
        "sessions": [
            {
                "id": session.id,
                "alarm_id": session.alarm_id,
                "alarm_name": (
                    session.alarm.name
                    if session.alarm
                    else "Unknown Alarm"
                ),
                "challenge_id": session.challenge_id,
                "user_answer": session.user_answer,
                "is_correct": session.is_correct,
                "session_status": session.session_status,
                "snooze_count": session.snooze_count or 0,
                "response_time_seconds": (
                    session.response_time_seconds
                    if session.response_time_seconds is not None
                    else (
                        max(0, int(round((
                            (session.completed_at if session.completed_at.tzinfo else session.completed_at.replace(tzinfo=timezone.utc))
                            - (session.started_at if session.started_at.tzinfo else session.started_at.replace(tzinfo=timezone.utc))
                        ).total_seconds())))
                        if session.started_at and session.completed_at
                        else None
                    )
                ),
                "dismissal_status": session.dismissal_status or "dismissed",

                # Always send an explicit timezone.
                "started_at": utc_iso(session.started_at),
                "completed_at": utc_iso(session.completed_at),
            }
            for session in sessions
        ]
    }
# ============================================================
# GET SINGLE SESSION
# ============================================================

@router.get(
    "/{session_id}",
    response_model=SessionResponse,
)
def get_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(AlarmSession)
        .join(
            Alarm,
            AlarmSession.alarm_id == Alarm.id,
        )
        .filter(
            AlarmSession.id == session_id,
            Alarm.user_id == current_user.id,
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found",
        )

    return session
# ============================================================
# SNOOZE ALARM SESSION
# ============================================================

@router.post(
    "/{session_id}/snooze",
    response_model=SessionResponse,
)
def snooze_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(AlarmSession)
        .join(
            Alarm,
            AlarmSession.alarm_id == Alarm.id,
        )
        .filter(
            AlarmSession.id == session_id,
            Alarm.user_id == current_user.id,
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found",
        )

    if session.session_status != "started":
        raise HTTPException(
            status_code=400,
            detail="Cannot snooze a completed or expired session",
        )

    current_snooze = session.snooze_count or 0
    session.snooze_count = max(0, current_snooze + 1)
    session.dismissal_status = "snoozed"

    db.commit()
    db.refresh(session)

    return session


# ============================================================
# EXPIRE SESSION
# ============================================================

@router.patch(
    "/{session_id}/expire",
    response_model=SessionResponse,
)
def expire_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(AlarmSession)
        .join(
            Alarm,
            AlarmSession.alarm_id == Alarm.id,
        )
        .filter(
            AlarmSession.id == session_id,
            Alarm.user_id == current_user.id,
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found",
        )

    # If already completed/expired, simply return it.
    if session.session_status != "started":
        return session

    now = datetime.now(timezone.utc)
    session.session_status = "expired"
    session.dismissal_status = "expired"
    session.is_correct = False
    session.completed_at = now

    if session.started_at:
        started_at = (
            session.started_at
            if session.started_at.tzinfo
            else session.started_at.replace(tzinfo=timezone.utc)
        )
        session.response_time_seconds = max(
            0, int(round((now - started_at).total_seconds()))
        )

    db.commit()
    db.refresh(session)

    return session
# ============================================================
# SUBMIT SESSION ANSWER
# ============================================================

@router.post(
    "/{session_id}/answer",
    response_model=SessionResponse,
)
def submit_session_answer(
    session_id: int,
    data: SessionAnswer,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # --------------------------------------------------------
    # 1. Find the session belonging to the logged-in user
    # --------------------------------------------------------

    session = (
        db.query(AlarmSession)
        .join(
            Alarm,
            AlarmSession.alarm_id == Alarm.id,
        )
        .filter(
            AlarmSession.id == session_id,
            Alarm.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found",
        )

    # --------------------------------------------------------
    # 2. Prevent submitting an answer to a finished session
    # --------------------------------------------------------

    if session.session_status != "started":
        raise HTTPException(
            status_code=400,
            detail="Session is already completed or expired",
        )

    # --------------------------------------------------------
    # 3. Get the challenge
    # --------------------------------------------------------

    challenge = (
        db.query(CognitiveChallenge)
        .filter(
            CognitiveChallenge.id == session.challenge_id
        )
        .first()
    )

    if not challenge:
        raise HTTPException(
            status_code=404,
            detail="Challenge not found",
        )

    # --------------------------------------------------------
    # 4. Validate the answer
    # --------------------------------------------------------

    submitted_answer = data.answer.strip()
    correct_answer = challenge.correct_answer.strip()

    is_correct = (
        submitted_answer.lower()
        == correct_answer.lower()
    )

    # --------------------------------------------------------
    # 5. Update the session
    # --------------------------------------------------------

    now = datetime.now(timezone.utc)
    session.user_answer = submitted_answer
    session.is_correct = is_correct
    session.session_status = "completed"
    session.completed_at = now
    session.dismissal_status = "dismissed" if is_correct else "failed"

    if session.started_at:
        started_at = (
            session.started_at
            if session.started_at.tzinfo
            else session.started_at.replace(tzinfo=timezone.utc)
        )
        session.response_time_seconds = max(
            0, int(round((now - started_at).total_seconds()))
        )

    db.commit()
    db.refresh(session)

    # --------------------------------------------------------
    # 6. Evaluate and apply per-alarm adaptive difficulty
    # --------------------------------------------------------
    adaptive_result = evaluate_and_apply_adaptive_difficulty(session.alarm_id, db)
    session.adaptive_difficulty = adaptive_result

    return session