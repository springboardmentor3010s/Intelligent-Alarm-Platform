"""
BehavioralAnalyticsService — Milestone 3
Lightweight rule-based behavioral analytics. No ML.

All calculations use data already stored by M1/M2:
  - WakeUpSession  (wakeup behavior, snooze/failed attempts)
  - CognitiveChallenge (challenge performance)
  - UserProfile    (preferred_wake_up_time, sleep_duration)
  - Alarm          (scheduled times)

All scores are on a 0–100 scale.
All functions accept a `days` parameter for configurable time windows.
"""
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from app.models.models import WakeUpSession, CognitiveChallenge, UserProfile, Alarm


def _since(days: int) -> datetime:
    """Return a naive local-time cutoff matching how Postgres stores timestamps."""
    return datetime.now() - timedelta(days=days)


# ── 1. Wake-Up Consistency ────────────────────────────────────────────────────

def calculate_wakeup_consistency(db: Session, user_id: int, days: int = 7) -> dict:
    """
    Wake-Up Consistency (0–100).

    Measures: what fraction of wake-up sessions in the window were
    successfully verified (WAKE_UP_VERIFIED).

    Score = (verified_sessions / total_sessions) × 100
    If no sessions → score = 0, insufficient_data = True
    """
    cutoff = _since(days)
    sessions = (
        db.query(WakeUpSession)
        .filter(
            WakeUpSession.user_id == user_id,
            WakeUpSession.started_at >= cutoff,
        )
        .all()
    )
    total = len(sessions)
    verified = sum(1 for s in sessions if s.status == "WAKE_UP_VERIFIED")

    if total == 0:
        return {"score": 0.0, "total_sessions": 0, "verified_sessions": 0,
                "insufficient_data": True, "days": days}

    score = round((verified / total) * 100, 1)
    return {
        "score": score,
        "total_sessions": total,
        "verified_sessions": verified,
        "failed_sessions": total - verified,
        "insufficient_data": False,
        "days": days,
    }


# ── 2. Challenge Completion ───────────────────────────────────────────────────

def calculate_challenge_completion(db: Session, user_id: int, days: int = 7) -> dict:
    """
    Challenge Completion (0–100).

    Measures: accuracy rate of completed challenges in the window.
    Score = (correct_challenges / total_completed) × 100

    Also returns avg_score, avg_response_time, avg_attempts.
    """
    cutoff = _since(days)
    challenges = (
        db.query(CognitiveChallenge)
        .filter(
            CognitiveChallenge.user_id == user_id,
            CognitiveChallenge.started_at >= cutoff,
            CognitiveChallenge.completed_at.isnot(None),
        )
        .all()
    )
    total = len(challenges)
    correct = sum(1 for c in challenges if c.is_correct is True)

    if total == 0:
        return {"score": 0.0, "total": 0, "correct": 0,
                "insufficient_data": True, "days": days}

    score = round((correct / total) * 100, 1)
    scores = [c.score for c in challenges if c.score]
    durations = [c.completion_duration_seconds for c in challenges if c.completion_duration_seconds and c.completion_duration_seconds > 0]
    attempts_list = [c.attempts for c in challenges]

    return {
        "score": score,
        "total": total,
        "correct": correct,
        "avg_challenge_score": round(sum(scores) / len(scores), 1) if scores else 0.0,
        "avg_response_seconds": round(sum(durations) / len(durations), 1) if durations else 0.0,
        "avg_attempts": round(sum(attempts_list) / len(attempts_list), 2) if attempts_list else 0.0,
        "insufficient_data": False,
        "days": days,
    }


# ── 3. Snooze Reduction ───────────────────────────────────────────────────────

def calculate_snooze_reduction(db: Session, user_id: int, days: int = 7) -> dict:
    """
    Snooze Reduction (0–100).

    Uses failed_attempts in WakeUpSession as a proxy for snooze behavior.
    A session with 0 failed attempts = perfect (no snooze).
    A session with many failed attempts = heavy snooze.

    Score = (sessions_with_zero_fails / total_sessions) × 100

    If no sessions → score = 0, insufficient_data = True.
    """
    cutoff = _since(days)
    sessions = (
        db.query(WakeUpSession)
        .filter(
            WakeUpSession.user_id == user_id,
            WakeUpSession.started_at >= cutoff,
        )
        .all()
    )
    total = len(sessions)
    if total == 0:
        return {"score": 0.0, "total_sessions": 0, "clean_sessions": 0,
                "avg_failed_attempts": 0.0, "insufficient_data": True, "days": days}

    clean = sum(1 for s in sessions if s.failed_attempts == 0)
    total_fails = sum(s.failed_attempts for s in sessions)
    avg_fails = round(total_fails / total, 2)
    score = round((clean / total) * 100, 1)

    return {
        "score": score,
        "total_sessions": total,
        "clean_sessions": clean,
        "avg_failed_attempts": avg_fails,
        "insufficient_data": False,
        "days": days,
    }


# ── 4. Sleep Schedule Adherence ───────────────────────────────────────────────

def calculate_sleep_adherence(db: Session, user_id: int, days: int = 7) -> dict:
    """
    Sleep Schedule Adherence (0–100).

    Compares the user's preferred_wake_up_time (from profile) against
    the actual verified_at time of each WAKE_UP_VERIFIED session.

    Tolerance: ±15 min = full score, ±30 min = partial, >30 min = 0 for that session.

    If no verified sessions or no preferred time → score = 0, insufficient_data = True.
    """
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    preferred_str = profile.preferred_wake_up_time if profile else None

    if not preferred_str:
        return {"score": 0.0, "insufficient_data": True,
                "reason": "No preferred wake-up time set", "days": days}

    try:
        ph, pm = map(int, preferred_str.split(":"))
        preferred_minutes = ph * 60 + pm
    except Exception:
        return {"score": 0.0, "insufficient_data": True,
                "reason": "Invalid preferred wake-up time format", "days": days}

    cutoff = _since(days)
    sessions = (
        db.query(WakeUpSession)
        .filter(
            WakeUpSession.user_id == user_id,
            WakeUpSession.started_at >= cutoff,
            WakeUpSession.status == "WAKE_UP_VERIFIED",
            WakeUpSession.verified_at.isnot(None),
        )
        .all()
    )

    if not sessions:
        return {"score": 0.0, "total_verified": 0, "preferred_time": preferred_str,
                "insufficient_data": True, "days": days}

    session_scores = []
    for s in sessions:
        vt = s.verified_at
        actual_minutes = vt.hour * 60 + vt.minute
        diff = abs(actual_minutes - preferred_minutes)
        # Handle midnight wrap-around
        diff = min(diff, 1440 - diff)
        if diff <= 15:
            session_scores.append(100)
        elif diff <= 30:
            session_scores.append(70)
        elif diff <= 60:
            session_scores.append(40)
        else:
            session_scores.append(0)

    score = round(sum(session_scores) / len(session_scores), 1)
    return {
        "score": score,
        "total_verified": len(sessions),
        "preferred_time": preferred_str,
        "avg_deviation_minutes": round(
            sum(
                min(
                    abs((s.verified_at.hour * 60 + s.verified_at.minute) - preferred_minutes),
                    1440 - abs((s.verified_at.hour * 60 + s.verified_at.minute) - preferred_minutes)
                )
                for s in sessions
            ) / len(sessions), 1
        ),
        "insufficient_data": False,
        "days": days,
    }


# ── 5. Full Behavioral Summary ────────────────────────────────────────────────

def calculate_behavioral_summary(db: Session, user_id: int, days: int = 7) -> dict:
    """
    Aggregate all four behavioral components into one response.
    Used by the /analytics/behavioral endpoint.
    """
    return {
        "days": days,
        "wakeup_consistency": calculate_wakeup_consistency(db, user_id, days),
        "challenge_completion": calculate_challenge_completion(db, user_id, days),
        "snooze_reduction": calculate_snooze_reduction(db, user_id, days),
        "sleep_adherence": calculate_sleep_adherence(db, user_id, days),
    }
