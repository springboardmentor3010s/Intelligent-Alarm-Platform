from datetime import datetime
import math
import json

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from sqlalchemy.orm import Session

from ..database import get_db

from ..models.alarm import Alarm
from ..models.challenge import Challenge
from ..models.challenge_attempt import ChallengeAttempt
from ..models.activity import Activity

from ..services.challenge_service import (
    answers_match,
    can_start_challenge,
    generate_questions,
    resolve_challenge_difficulty,
)
from ..ai.priority_engine import update_alarm_difficulty_from_experience

from ..dependencies import get_current_user


router = APIRouter()


# ============================================================
# GENERATE CHALLENGE
# ============================================================

@router.post("/generate/{alarm_id}")
def generate_alarm_challenge(
    alarm_id: int,

    db: Session = Depends(get_db),

    current_user=Depends(get_current_user)
):

    # --------------------------------------------------------
    # FIND ALARM
    # --------------------------------------------------------

    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == current_user.id
        )
        .first()
    )

    if not alarm:

        raise HTTPException(
            status_code=404,
            detail="Alarm not found."
        )

    if not can_start_challenge(alarm):
        raise HTTPException(
            status_code=400,
            detail="Challenge can only be started while the alarm is ringing."
        )

    # --------------------------------------------------------
    # SETTINGS
    # --------------------------------------------------------

    challenge_type = (
        alarm.challenge_type or "math"
    ).lower()

    difficulty = resolve_challenge_difficulty(
        db,
        current_user,
        default_difficulty=(alarm.difficulty or "medium"),
    )

    count = (
        alarm.challenge_question_count
        or 5
    )

    count = max(
        1,
        min(int(count), 10)
    )

    # --------------------------------------------------------
    # GENERATE QUESTIONS
    # --------------------------------------------------------

    questions = generate_questions(
        challenge_type=challenge_type,
        difficulty=difficulty,
        count=count,
    )

    if not questions:

        raise HTTPException(
            status_code=500,
            detail="Unable to generate challenge questions."
        )

    # --------------------------------------------------------
    # CREATE SESSION ID
    # --------------------------------------------------------

    import uuid

    session_id = str(
        uuid.uuid4()
    )

    # --------------------------------------------------------
    # RESET ALARM
    # --------------------------------------------------------

    alarm.challenge_completed = False
    alarm.difficulty = difficulty

    alarm.challenge_question_count = len(
        questions
    )

    # --------------------------------------------------------
    # SAVE QUESTIONS
    # --------------------------------------------------------

    saved_questions = []

    for index, item in enumerate(
        questions,
        start=1
    ):

        challenge = Challenge(

            user_id=current_user.id,

            alarm_id=alarm.id,

            session_id=session_id,

            question_number=index,

            question=item["question"],

            answer=str(
                item["answer"]
            ),

            user_answer=None,

            challenge_type=challenge_type,

            difficulty=difficulty,

            is_correct=None,

            is_completed=False,

            response_time=0,

            attempt_count=0,

            created_at=datetime.utcnow()
        )

        db.add(challenge)

        saved_questions.append(
            challenge
        )

    db.commit()

    # --------------------------------------------------------
    # REFRESH
    # --------------------------------------------------------

    for challenge in saved_questions:

        db.refresh(challenge)

    # --------------------------------------------------------
    # RETURN
    # --------------------------------------------------------

    return {

        "session_id": session_id,

        "alarm_id": alarm.id,

        "challenge_type": challenge_type,

        "difficulty": difficulty,

        "total_questions": len(
            saved_questions
        ),

        "questions": [

            {
                "id": challenge.id,

                "question_number":
                    challenge.question_number,

                "question":
                    challenge.question,

                "options":
                    None
            }

            for challenge in saved_questions
        ]
    }


# ============================================================
# GET USER CHALLENGES
# ============================================================

@router.get("")
def get_challenges(
    db: Session = Depends(get_db),

    current_user=Depends(get_current_user)
):

    challenges = (
        db.query(Challenge)
        .filter(
            Challenge.user_id == current_user.id
        )
        .order_by(
            Challenge.created_at.desc()
        )
        .all()
    )

    return [

        {
            "id": item.id,

            "alarm_id": item.alarm_id,

            "session_id":
                item.session_id,

            "question_number":
                item.question_number,

            "challenge_type":
                item.challenge_type,

            "difficulty":
                item.difficulty,

            "question":
                item.question,

            "is_completed":
                item.is_completed,

            "is_correct":
                item.is_correct,

            "attempt_count":
                item.attempt_count,

            "response_time":
                item.response_time,

            "created_at":
                item.created_at
        }

        for item in challenges
    ]


# ============================================================
# SUBMIT ANSWER
# ============================================================

@router.post("/{challenge_id}/submit")
def submit_challenge(
    challenge_id: int,

    answer: str,

    response_time_seconds: float | None = None,

    db: Session = Depends(get_db),

    current_user=Depends(get_current_user)
):

    # --------------------------------------------------------
    # FIND QUESTION
    # --------------------------------------------------------

    challenge = (
        db.query(Challenge)
        .filter(
            Challenge.id == challenge_id,

            Challenge.user_id ==
                current_user.id
        )
        .first()
    )

    if not challenge:

        raise HTTPException(
            status_code=404,
            detail="Challenge question not found."
        )

    # --------------------------------------------------------
    # IF ALREADY COMPLETED
    # --------------------------------------------------------

    if challenge.attempt_count:
        session_questions = (
            db.query(Challenge)
            .filter(
                Challenge.user_id == current_user.id,
                Challenge.session_id == challenge.session_id,
            )
            .all()
        )
        session_completed = bool(session_questions) and all(
            item.is_completed for item in session_questions
        )

        return {
            "challenge_id":
                challenge.id,
            "correct":
                challenge.is_correct,
            "challenge_completed": session_completed,
            "score": sum(1 for item in session_questions if item.is_correct),
            "total_questions": len(session_questions),
            "accuracy": round(
                (
                    sum(1 for item in session_questions if item.is_correct)
                    / len(session_questions)
                )
                * 100,
                2,
            ) if session_questions else 0,
            "attempt_count": challenge.attempt_count,
        }

    if not answer or not answer.strip():
        raise HTTPException(status_code=422, detail="An answer is required.")

    now = datetime.utcnow()
    if response_time_seconds is None:
        response_time_seconds = (
            (now - challenge.created_at).total_seconds()
            if challenge.created_at is not None
            else 0.0
        )
    if not math.isfinite(response_time_seconds) or not 0 <= response_time_seconds <= 3600:
        raise HTTPException(
            status_code=422,
            detail="Response time must be between 0 and 3600 seconds.",
        )

    # --------------------------------------------------------
    # CHECK ANSWER
    # --------------------------------------------------------

    user_answer = (
        str(answer)
        .strip()
        .lower()
    )

    correct_answer = (
        str(challenge.answer)
        .strip()
        .lower()
    )

    is_correct = answers_match(
        user_answer,
        correct_answer
    )

    # --------------------------------------------------------
    # SAVE ANSWER
    # --------------------------------------------------------

    challenge.user_answer = str(
        answer
    )

    challenge.attempt_count = (
        challenge.attempt_count or 0
    ) + 1

    challenge.response_time = response_time_seconds
    challenge.is_correct = is_correct
    challenge.is_completed = is_correct
    attempt = ChallengeAttempt(
        user_id=current_user.id,
        challenge_id=challenge.id,
        attempt_number=challenge.attempt_count,
        difficulty=challenge.difficulty,
        challenge_type=challenge.challenge_type,
        user_answer=str(answer),
        is_correct=is_correct,
        is_completed=is_correct,
        response_time=response_time_seconds,
        created_at=now,
    )
    db.add(attempt)

    db.commit()

    # --------------------------------------------------------
    # CHECK THE FULL SESSION SCORE FOR ADAPTIVE DIFFICULTY
    # (this should happen even when the final answer is wrong,
    #  as long as the 5-question round is complete)
    # --------------------------------------------------------

    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id ==
                challenge.alarm_id,

            Alarm.user_id ==
                current_user.id
        )
        .first()
    )

    challenge_completed = False
    session_questions = []

    if alarm:

        session_questions = (
            db.query(Challenge)
            .filter(
                Challenge.alarm_id ==
                    alarm.id,

                Challenge.user_id ==
                    current_user.id,

                Challenge.session_id ==
                    challenge.session_id
            )
            .all()
        )

        if session_questions:
            round_complete = all(
                q.user_answer is not None
                for q in session_questions
            )

            if round_complete:
                all_completed = all(q.is_completed for q in session_questions)
                alarm.challenge_completed = all_completed
                challenge_completed = all_completed

                recent_challenges = (
                    db.query(Challenge)
                    .filter(
                        Challenge.user_id == current_user.id,
                        Challenge.is_correct.isnot(None),
                    )
                    .order_by(
                        Challenge.created_at.desc(),
                        Challenge.question_number.desc(),
                    )
                    .limit(10)
                    .all()
                )
                old_difficulty = (
                    min(
                        session_questions,
                        key=lambda item: item.question_number,
                    ).difficulty or "medium"
                ).lower()
                update_alarm_difficulty_from_experience(
                    alarm=alarm,
                    user=current_user,
                    recent_challenges=recent_challenges,
                )
                new_difficulty = (alarm.difficulty or old_difficulty).lower()
                if new_difficulty != old_difficulty:
                    db.add(
                        Activity(
                            user_id=current_user.id,
                            alarm_id=alarm.id,
                            activity_type="difficulty_change",
                            value=1,
                            metadata_json=json.dumps(
                                {
                                    "session_id": challenge.session_id,
                                    "from": old_difficulty,
                                    "to": new_difficulty,
                                    "accuracy": round(
                                        sum(
                                            1
                                            for item in session_questions
                                            if item.is_correct
                                        )
                                        / len(session_questions),
                                        4,
                                    ),
                                }
                            ),
                            created_at=now,
                        )
                    )

                db.commit()

    correct_count = sum(
        1 for item in session_questions if item.is_correct is True
    )
    total_questions = len(session_questions) or 1
    session_finished = bool(session_questions) and all(
        item.user_answer is not None for item in session_questions
    )

    return {

        "challenge_id":
            challenge.id,

        "correct": is_correct,
        "is_correct": is_correct,

        "challenge_completed":
            challenge_completed,

        "session_completed": session_finished,

        "score": correct_count,

        "total_questions": total_questions,

        "accuracy": round((correct_count / total_questions) * 100, 2),

        "attempt_count": challenge.attempt_count,

        "message":
            (
                "Correct answer. Continue to the next question."
                if is_correct and not challenge_completed
                else "Incorrect answer. This result was recorded."
                if not is_correct
                else
                "Challenge completed successfully!"
            )
    }