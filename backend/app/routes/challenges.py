from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import (
    Alarm,
    AlarmSession,
    CognitiveChallenge,
    User,
)

from app.schemas.challenge import (
    ChallengeResponse,
    ChallengeAnswer,
)

from typing import Optional
from app.utils.dependencies import get_current_user
from app.services.challenge_generator import generate_challenge
from app.services.adaptive_difficulty import evaluate_and_apply_adaptive_difficulty


router = APIRouter(
    prefix="/api/challenges",
    tags=["Cognitive Challenges"],
)


# =========================================================
# SUPPORTED OPTIONS
# =========================================================

SUPPORTED_TYPES = {
    "math",
    "logic",
    "memory",
    "word",
    "pattern",
    "riddle",
    "quiz",
}

SUPPORTED_DIFFICULTIES = {
    "beginner",
    "easy",
    "medium",
    "hard",
    "expert",
}


# =========================================================
# GENERATE CHALLENGE + START ALARM SESSION
# =========================================================

@router.post(
    "/generate/{alarm_id}",
    response_model=ChallengeResponse,
)
def generate_alarm_challenge(
    alarm_id: int,

    challenge_type: Optional[str] = Query(
        None,
        description="math, logic, memory, word, pattern, riddle, quiz",
    ),

    difficulty: Optional[str] = Query(
        None,
        description="beginner, easy, medium, hard, expert",
    ),

    current_user: User = Depends(get_current_user),

    db: Session = Depends(get_db),
):

    # -----------------------------------------------------
    # FIND ALARM
    # -----------------------------------------------------

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

    # -----------------------------------------------------
    # NORMALIZE INPUT (Default to alarm's preferences)
    # -----------------------------------------------------

    if not challenge_type:
        challenge_type = alarm.challenge_type or "math"

    if not difficulty:
        difficulty = alarm.difficulty or "medium"

    challenge_type = (
        challenge_type
        .lower()
        .strip()
    )

    difficulty = (
        difficulty
        .lower()
        .strip()
    )

    # -----------------------------------------------------
    # VALIDATE CHALLENGE TYPE
    # -----------------------------------------------------

    if challenge_type not in SUPPORTED_TYPES:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid challenge type: {challenge_type}. "
                f"Supported types: {', '.join(sorted(SUPPORTED_TYPES))}"
            ),
        )

    # -----------------------------------------------------
    # VALIDATE DIFFICULTY
    # -----------------------------------------------------

    if difficulty not in SUPPORTED_DIFFICULTIES:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid difficulty: {difficulty}. "
                f"Supported difficulties: "
                f"{', '.join(sorted(SUPPORTED_DIFFICULTIES))}"
            ),
        )

    # -----------------------------------------------------
    # GENERATE COGNITIVE CHALLENGE
    # -----------------------------------------------------

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

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate challenge: {str(error)}",
        )

    # -----------------------------------------------------
    # CREATE CHALLENGE
    # -----------------------------------------------------

    challenge = CognitiveChallenge(
        alarm_id=alarm.id,

        challenge_type=challenge_data[
            "challenge_type"
        ],

        question=challenge_data[
            "question"
        ],

        correct_answer=challenge_data[
            "correct_answer"
        ],

        difficulty=challenge_data[
            "difficulty"
        ],
    )

    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    # -----------------------------------------------------
    # IMPORTANT:
    # CREATE ACTIVE ALARM SESSION
    #
    # This fixes:
    # "Active alarm session not found"
    # -----------------------------------------------------

    alarm_session = (
        db.query(AlarmSession)
        .filter(
            AlarmSession.alarm_id == alarm.id,

            AlarmSession.challenge_id
            == challenge.id,

            AlarmSession.session_status
            == "started",
        )
        .first()
    )

    # -----------------------------------------------------
    # CREATE ONLY IF ONE DOES NOT EXIST
    # -----------------------------------------------------

    if not alarm_session:

        alarm_session = AlarmSession(
            alarm_id=alarm.id,
            challenge_id=challenge.id,
            session_status="started",
            dismissal_status="active",
            snooze_count=0,
        )

        db.add(alarm_session)

        db.commit()

        db.refresh(alarm_session)

    # -----------------------------------------------------
    # RETURN CHALLENGE
    # -----------------------------------------------------

    return challenge


# =========================================================
# GET LATEST CHALLENGE FOR ALARM
# =========================================================

@router.get(
    "/alarm/{alarm_id}",
    response_model=ChallengeResponse,
)
def get_challenge_for_alarm(
    alarm_id: int,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):

    # -----------------------------------------------------
    # VERIFY ALARM BELONGS TO USER
    # -----------------------------------------------------

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

    # -----------------------------------------------------
    # GET LATEST CHALLENGE
    # -----------------------------------------------------

    challenge = (
        db.query(CognitiveChallenge)
        .filter(
            CognitiveChallenge.alarm_id
            == alarm_id
        )
        .order_by(
            CognitiveChallenge.id.desc()
        )
        .first()
    )

    if not challenge:

        raise HTTPException(
            status_code=404,
            detail="No cognitive challenge found",
        )

    return challenge


# =========================================================
# GET SINGLE CHALLENGE
# =========================================================

@router.get(
    "/{challenge_id}",
    response_model=ChallengeResponse,
)
def get_challenge(
    challenge_id: int,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):

    # -----------------------------------------------------
    # FIND CHALLENGE
    # -----------------------------------------------------

    challenge = (
        db.query(CognitiveChallenge)
        .join(
            Alarm,
            CognitiveChallenge.alarm_id
            == Alarm.id,
        )
        .filter(
            CognitiveChallenge.id
            == challenge_id,

            Alarm.user_id
            == current_user.id,
        )
        .first()
    )

    if not challenge:

        raise HTTPException(
            status_code=404,
            detail="Challenge not found",
        )

    return challenge


# =========================================================
# SUBMIT CHALLENGE ANSWER
# =========================================================

@router.post(
    "/answer/{challenge_id}"
)
def submit_answer(
    challenge_id: int,

    data: ChallengeAnswer,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):

    # -----------------------------------------------------
    # FIND CHALLENGE
    # -----------------------------------------------------

    challenge = (
        db.query(CognitiveChallenge)
        .join(
            Alarm,
            CognitiveChallenge.alarm_id
            == Alarm.id,
        )
        .filter(
            CognitiveChallenge.id
            == challenge_id,

            Alarm.user_id
            == current_user.id,
        )
        .first()
    )

    if not challenge:

        raise HTTPException(
            status_code=404,
            detail="Challenge not found",
        )

    # -----------------------------------------------------
    # FIND ACTIVE SESSION
    # -----------------------------------------------------

    alarm_session = (
        db.query(AlarmSession)
        .join(
            Alarm,
            AlarmSession.alarm_id
            == Alarm.id,
        )
        .filter(
            AlarmSession.challenge_id
            == challenge_id,

            Alarm.user_id
            == current_user.id,

            AlarmSession.session_status
            == "started",
        )
        .first()
    )

    # -----------------------------------------------------
    # SAFETY FALLBACK
    #
    # If the challenge exists but session was not created,
    # create it here instead of returning an error.
    # -----------------------------------------------------

    if not alarm_session:

        alarm_session = AlarmSession(
            alarm_id=challenge.alarm_id,
            challenge_id=challenge.id,
            session_status="started",
            dismissal_status="active",
            snooze_count=0,
        )

        db.add(alarm_session)

        db.commit()

        db.refresh(alarm_session)

    # -----------------------------------------------------
    # NORMALIZE ANSWER
    # -----------------------------------------------------

    user_answer = (
        data.answer
        .strip()
    )

    correct_answer = (
        challenge.correct_answer
        .strip()
    )

    # -----------------------------------------------------
    # CHECK ANSWER
    # -----------------------------------------------------

    is_correct = (
        user_answer.lower()
        == correct_answer.lower()
    )

    # -----------------------------------------------------
    # SAVE ANSWER & COMPLETE SESSION
    # -----------------------------------------------------

    now = datetime.now(timezone.utc)
    alarm_session.user_answer = user_answer
    alarm_session.is_correct = is_correct
    alarm_session.session_status = "completed"
    alarm_session.completed_at = now
    alarm_session.dismissal_status = "dismissed" if is_correct else "failed"

    if alarm_session.started_at:
        started_at = (
            alarm_session.started_at
            if alarm_session.started_at.tzinfo
            else alarm_session.started_at.replace(tzinfo=timezone.utc)
        )
        alarm_session.response_time_seconds = max(
            0, int((now - started_at).total_seconds())
        )

    # -----------------------------------------------------
    # SAVE DATABASE
    # -----------------------------------------------------

    db.commit()

    db.refresh(alarm_session)

    # -----------------------------------------------------
    # EVALUATE ADAPTIVE DIFFICULTY (PER-ALARM)
    # -----------------------------------------------------
    adaptive_result = evaluate_and_apply_adaptive_difficulty(
        challenge.alarm_id, db
    )

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {
        "correct": is_correct,

        "message": (
            "Correct answer"
            if is_correct
            else "Incorrect answer"
        ),

        "session_id":
            alarm_session.id,

        "challenge_id":
            challenge.id,

        "alarm_id":
            challenge.alarm_id,

        "session_status":
            alarm_session.session_status,

        "completed_at":
            alarm_session.completed_at,

        "adaptive_difficulty":
            adaptive_result,
    }