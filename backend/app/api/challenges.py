from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Optional
from app.db.database import get_db
from app.models.models import CognitiveChallenge, Alarm, UserProfile, WakeUpSession
from app.schemas.schemas import (
    ChallengeGenerateRequest, ChallengeOut, VerifyRequest, VerifyResponse,
    AnalyticsOut, ChallengeHistoryItem, WakeUpSessionOut,
)
from app.core.security import get_current_user
from app.services.challenge_engine import (
    generate_challenge, check_answer, compute_score,
    pick_challenge_type, DIFFICULTY_LEVELS, CHALLENGE_TYPES,
    DEFAULT_ALARM_CHALLENGE_TYPE,
)
from app.services.adaptive_difficulty import (
    compute_next_difficulty, get_starting_difficulty, compute_wakefulness_score,
)

router = APIRouter(prefix="/challenges", tags=["Challenges"])

_HISTORY_WINDOW = 10


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_user_history(db: Session, user_id: int) -> list:
    """Last N completed challenges, oldest->newest."""
    newest_first = (
        db.query(CognitiveChallenge)
        .filter(
            CognitiveChallenge.user_id == user_id,
            CognitiveChallenge.is_correct.isnot(None),
        )
        .order_by(CognitiveChallenge.started_at.desc())
        .limit(_HISTORY_WINDOW)
        .all()
    )
    return list(reversed(newest_first))


def _resolve_difficulty(user_id: int, requested: Optional[str], db: Session) -> str:
    if requested:
        d = requested.upper()
        return d if d in DIFFICULTY_LEVELS else "MEDIUM"

    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    pref = (profile.difficulty_preference or "medium") if profile else "medium"
    base = get_starting_difficulty(pref)

    history = _get_user_history(db, user_id)
    if not history:
        return base

    last = history[-1]
    current = last.difficulty if last.difficulty in DIFFICULTY_LEVELS else base
    recent_results = [bool(c.is_correct) for c in history]
    # Pass last challenge + full history so compute_next_difficulty can reach the ML path.
    # Rule-based fallback is used automatically when the model is unavailable.
    return compute_next_difficulty(
        current,
        recent_results,
        challenge=last,
        history=history[:-1],
    )


def _resolve_type(user_id: int, requested: Optional[str], db: Session, alarm=None) -> str:
    # Explicit override from the generate request takes highest priority
    if requested and requested in CHALLENGE_TYPES:
        return requested
    # Use the alarm's stored challenge_type setting
    alarm_type = getattr(alarm, "challenge_type", None) if alarm else None
    if alarm_type and alarm_type != "random" and alarm_type in CHALLENGE_TYPES:
        return alarm_type
    # random/adaptive: rotate through all 7 types avoiding recent repeats
    history = _get_user_history(db, user_id)
    recent_types = [c.challenge_type for c in history]
    return pick_challenge_type(recent_types)


def _consecutive_correct(history: list) -> int:
    count = 0
    for c in reversed(history):
        if c.is_correct:
            count += 1
        else:
            break
    return count


def _get_or_create_session(db: Session, alarm_id: int, user_id: int, challenges_required: int) -> WakeUpSession:
    """Get the active (not dismissed) wake-up session for this alarm ring, or create one."""
    session = (
        db.query(WakeUpSession)
        .filter(
            WakeUpSession.alarm_id == alarm_id,
            WakeUpSession.user_id == user_id,
            WakeUpSession.dismissed_at.is_(None),
        )
        .order_by(WakeUpSession.started_at.desc())
        .first()
    )
    if not session:
        session = WakeUpSession(
            alarm_id=alarm_id,
            user_id=user_id,
            status="NOT_VERIFIED",
            challenges_required=challenges_required,
        )
        db.add(session)
        db.flush()
    return session


def _update_session_on_correct(
    db: Session,
    challenge: CognitiveChallenge,
    now: datetime,
    response_time: float,
) -> None:
    """Update the wake-up session counters and wakefulness score after a correct answer."""
    alarm = db.query(Alarm).filter(Alarm.id == challenge.alarm_id).first()
    if not alarm:
        return
    session = _get_or_create_session(db, alarm.id, challenge.user_id, alarm.challenge_count)
    session.challenges_completed += 1
    session.total_attempts += 1

    session_challenges = (
        db.query(CognitiveChallenge)
        .filter(
            CognitiveChallenge.alarm_id == alarm.id,
            CognitiveChallenge.user_id == challenge.user_id,
            CognitiveChallenge.started_at >= session.started_at,
        )
        .all()
    )
    correct_count = sum(1 for c in session_challenges if c.is_correct)
    total_att = sum(c.attempts for c in session_challenges)
    durations = [c.completion_duration_seconds for c in session_challenges if c.completion_duration_seconds]
    avg_resp = sum(durations) / len(durations) if durations else response_time

    wakefulness, status = compute_wakefulness_score(
        session.challenges_completed,
        session.challenges_required,
        correct_count,
        total_att,
        avg_resp,
        challenge.time_limit_seconds,
    )
    session.wakefulness_score = wakefulness
    session.status = status
    if status == "WAKE_UP_VERIFIED" and not session.verified_at:
        session.verified_at = now
        # Persist the adaptive difficulty back to the alarm so next session starts where this one ended
        next_diff = compute_next_difficulty(
            challenge.difficulty,
            [True],  # just completed correctly
            challenge=challenge,
            history=session_challenges,
        )
        alarm.challenge_difficulty = next_diff


def _update_session_on_wrong(db: Session, challenge: CognitiveChallenge) -> None:
    """Increment failed-attempt counters on the wake-up session after a wrong answer.
    If failed_attempts exceeds the alarm's max_failed_attempts, escalate difficulty.
    """
    alarm = db.query(Alarm).filter(Alarm.id == challenge.alarm_id).first()
    if not alarm:
        return
    session = _get_or_create_session(db, alarm.id, challenge.user_id, alarm.challenge_count)
    session.total_attempts += 1
    session.failed_attempts += 1

    # Snooze limit: escalate difficulty when threshold exceeded
    max_fails = getattr(alarm, 'max_failed_attempts', 5) or 5
    if session.failed_attempts >= max_fails:
        idx = DIFFICULTY_LEVELS.index(challenge.difficulty) if challenge.difficulty in DIFFICULTY_LEVELS else 2
        if idx < len(DIFFICULTY_LEVELS) - 1:
            challenge.difficulty = DIFFICULTY_LEVELS[idx + 1]


def _compute_type_difficulty_breakdown(challenges: list) -> tuple:
    """Return (by_type, by_difficulty) dicts from a list of CognitiveChallenge rows."""
    by_type: dict = {}
    by_difficulty: dict = {}
    for c in challenges:
        by_type.setdefault(c.challenge_type, {"total": 0, "correct": 0})
        by_type[c.challenge_type]["total"] += 1
        if c.is_correct:
            by_type[c.challenge_type]["correct"] += 1

        by_difficulty.setdefault(c.difficulty, {"total": 0, "correct": 0})
        by_difficulty[c.difficulty]["total"] += 1
        if c.is_correct:
            by_difficulty[c.difficulty]["correct"] += 1
    return by_type, by_difficulty


def _compute_wakeup_stats(db: Session, user_id: int) -> dict:
    """Return wakeup session aggregate stats for the analytics endpoint."""
    all_sessions = (
        db.query(WakeUpSession)
        .filter(WakeUpSession.user_id == user_id)
        .all()
    )
    total = len(all_sessions)
    verified = sum(1 for s in all_sessions if s.status == "WAKE_UP_VERIFIED")
    rate = round(verified / total * 100, 1) if total else 0.0
    scores = [s.wakefulness_score for s in all_sessions if s.wakefulness_score]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
    total_failed = sum(s.failed_attempts for s in all_sessions)
    return {
        "total_wakeup_sessions": total,
        "verified_wakeup_sessions": verified,
        "wakeup_verification_rate": rate,
        "avg_wakefulness_score": avg_score,
        "total_failed_attempts": total_failed,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=ChallengeOut, status_code=201)
def generate(
    data: ChallengeGenerateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    alarm = db.query(Alarm).filter(
        Alarm.id == data.alarm_id, Alarm.user_id == current_user.id
    ).first()
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")

    difficulty = _resolve_difficulty(current_user.id, data.difficulty or alarm.challenge_difficulty, db)
    challenge_type = _resolve_type(current_user.id, data.challenge_type, db, alarm)

    result = generate_challenge(challenge_type, difficulty)

    challenge = CognitiveChallenge(
        alarm_id=alarm.id,
        user_id=current_user.id,
        challenge_type=result["challenge_type"],
        difficulty=result["difficulty"],
        question=result["question"],
        correct_answer=result["correct_answer"],
        time_limit_seconds=result["time_limit_seconds"],
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    return challenge


@router.post("/{challenge_id}/verify", response_model=VerifyResponse)
def verify(
    challenge_id: int,
    data: VerifyRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    challenge = db.query(CognitiveChallenge).filter(
        CognitiveChallenge.id == challenge_id,
        CognitiveChallenge.user_id == current_user.id,
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    # Already correctly completed — idempotent
    if challenge.is_correct is True:
        return VerifyResponse(
            correct=True, score=challenge.score, attempts=challenge.attempts,
            message="Already completed!", completed=True,
            completion_duration_seconds=challenge.completion_duration_seconds,
        )

    challenge.attempts += 1
    challenge.user_answer = data.user_answer

    now = datetime.now(timezone.utc)
    if data.response_time_seconds and data.response_time_seconds > 0:
        response_time = round(data.response_time_seconds, 1)
    else:
        started = challenge.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        response_time = round((now - started).total_seconds(), 1)

    if check_answer(data.user_answer, challenge.correct_answer):
        challenge.is_correct = True
        challenge.completed_at = now
        challenge.completion_duration_seconds = response_time
        challenge.last_attempt_duration_seconds = response_time
        score = compute_score(True, challenge.attempts, response_time, challenge.time_limit_seconds)
        challenge.score = score
        _update_session_on_correct(db, challenge, now, response_time)
        db.commit()
        return VerifyResponse(
            correct=True, score=score, attempts=challenge.attempts,
            message="Correct! Challenge completed.",
            completed=True,
            response_time_seconds=response_time,
            completion_duration_seconds=response_time,
        )
    else:
        # Wrong answer: keep is_correct=None so the challenge stays retryable
        challenge.is_correct = None
        challenge.last_attempt_duration_seconds = response_time
        _update_session_on_wrong(db, challenge)
        db.commit()
        return VerifyResponse(
            correct=False, score=0, attempts=challenge.attempts,
            message="Incorrect answer. Try again.",
            completed=False,
            response_time_seconds=response_time,
        )


@router.get("/history", response_model=List[ChallengeHistoryItem])
def history(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return the user's challenge history, newest first."""
    challenges = (
        db.query(CognitiveChallenge)
        .filter(CognitiveChallenge.user_id == current_user.id)
        .order_by(CognitiveChallenge.started_at.desc())
        .limit(limit)
        .all()
    )
    return challenges


@router.get("/analytics", response_model=AnalyticsOut)
def analytics(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    all_c = (
        db.query(CognitiveChallenge)
        .filter(CognitiveChallenge.user_id == current_user.id)
        .order_by(CognitiveChallenge.started_at)
        .all()
    )
    total = len(all_c)
    completed = sum(1 for c in all_c if c.completed_at is not None)
    correct = sum(1 for c in all_c if c.is_correct is True)
    total_attempts = sum(c.attempts for c in all_c)
    success_rate = round(correct / total * 100, 1) if total else 0.0
    avg_attempts = round(total_attempts / total, 2) if total else 0.0

    durations = [c.completion_duration_seconds for c in all_c if c.completion_duration_seconds and c.completion_duration_seconds > 0]
    avg_completion_seconds = round(sum(durations) / len(durations), 1) if durations else 0.0

    scores = [c.score for c in all_c if c.score]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

    by_type, by_difficulty = _compute_type_difficulty_breakdown(all_c)

    history_list = _get_user_history(db, current_user.id)
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    pref = (profile.difficulty_preference or "medium") if profile else "medium"
    if history_list:
        current_diff = history_list[-1].difficulty if history_list[-1].difficulty in DIFFICULTY_LEVELS else "MEDIUM"
        recent_results = [bool(c.is_correct) for c in history_list]
        current_difficulty = compute_next_difficulty(current_diff, recent_results)
    else:
        current_difficulty = get_starting_difficulty(pref)

    consecutive_correct = _consecutive_correct(history_list)
    wakeup = _compute_wakeup_stats(db, current_user.id)

    return AnalyticsOut(
        total=total,
        completed=completed,
        correct=correct,
        success_rate=success_rate,
        total_attempts=total_attempts,
        avg_attempts=avg_attempts,
        avg_completion_seconds=avg_completion_seconds,
        avg_score=avg_score,
        by_type=by_type,
        by_difficulty=by_difficulty,
        current_difficulty=current_difficulty,
        consecutive_correct=consecutive_correct,
        **wakeup,
    )


@router.get("/wakeup/history", response_model=List[WakeUpSessionOut])
def wakeup_history(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sessions = (
        db.query(WakeUpSession)
        .filter(WakeUpSession.user_id == current_user.id)
        .order_by(WakeUpSession.started_at.desc())
        .limit(limit)
        .all()
    )
    return sessions


@router.get("/{challenge_id}", response_model=ChallengeOut)
def get_challenge(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    challenge = db.query(CognitiveChallenge).filter(
        CognitiveChallenge.id == challenge_id,
        CognitiveChallenge.user_id == current_user.id,
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return challenge
