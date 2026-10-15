from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import Alarm, AlarmSession, CognitiveChallenge, User, UserProfile
from app.schemas.analytics import (
    AdaptiveDifficultyResponse,
    AnalyticsResponse,
    ChallengePerformance,
    DailyPerformance,
    DifficultyPerformanceItem,
    HabitScoreResponse,
    RecommendationItem,
    RecommendationsResponse,
    SleepAdherenceResponse,
    SnoozeAnalyticsResponse,
    SnoozeDailyItem,
    WakeUpSessionItem,
)
from app.services.adaptive_service import calculate_adaptive_difficulty_from_sessions
from app.services.habit_scorer import evaluate_user_habit
from app.services.recommendation_engine import generate_recommendations
from app.services.ml_intelligence_service import (
    get_ml_habit_score,
    get_ml_adaptive_difficulty,
    get_ml_recommendations,
)
from app.services.report_generator import (
    MAX_VALID_RESPONSE_TIME_SECONDS,
    calculate_session_response_time,
)
from app.utils.dependencies import get_current_user

router = APIRouter(
    prefix="/api/analytics",
    tags=["Analytics"],
)


def format_time_ist(dt: Optional[datetime]) -> str:
    """Formats datetime in Asia/Kolkata 12-hour AM/PM."""
    if not dt:
        return "—"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    try:
        ist_dt = dt.astimezone(ZoneInfo("Asia/Kolkata"))
    except Exception:
        ist_dt = dt.astimezone(timezone(timedelta(hours=5, minutes=30), name="IST"))
    return ist_dt.strftime("%I:%M %p")


def format_alarm_time(t) -> str:
    """Formats time object in 12-hour AM/PM."""
    if not t:
        return "—"
    try:
        hour = t.hour
        minute = t.minute
        period = "AM" if hour < 12 else "PM"
        h12 = hour % 12 or 12
        return f"{h12:02d}:{minute:02d} {period}"
    except Exception:
        return str(t)


@router.get(
    "",
    response_model=AnalyticsResponse
)
def get_analytics(
    time_range: str = "all",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # --------------------------------------------------
    # USER ALARMS (Strict User Isolation)
    # --------------------------------------------------
    alarms = (
        db.query(Alarm)
        .filter(Alarm.user_id == current_user.id)
        .all()
    )

    total_alarms = len(alarms)
    active_alarms = sum(1 for alarm in alarms if alarm.is_active)
    alarm_ids = [alarm.id for alarm in alarms]
    alarm_map = {a.id: a for a in alarms}

    # --------------------------------------------------
    # USER SESSIONS (Strict User Isolation)
    # --------------------------------------------------
    sessions = []
    if alarm_ids:
        sessions = (
            db.query(AlarmSession)
            .filter(AlarmSession.alarm_id.in_(alarm_ids))
            .order_by(AlarmSession.started_at.asc())
            .all()
        )

    # --------------------------------------------------
    # TIME RANGE FILTER (Milestone 4 — Phase 2)
    # --------------------------------------------------
    now_utc = datetime.now(timezone.utc)
    cutoff = None
    if time_range == "7d":
        cutoff = now_utc - timedelta(days=7)
    elif time_range == "30d":
        cutoff = now_utc - timedelta(days=30)
    elif time_range == "90d":
        cutoff = now_utc - timedelta(days=90)

    if cutoff:
        filtered_sessions = []
        for s in sessions:
            if s.started_at:
                s_dt = s.started_at
                if s_dt.tzinfo is None:
                    s_dt = s_dt.replace(tzinfo=timezone.utc)
                if s_dt >= cutoff:
                    filtered_sessions.append(s)
    else:
        filtered_sessions = sessions

    total_sessions = len(filtered_sessions)

    completed_sessions = sum(
        1 for session in filtered_sessions
        if session.session_status == "completed"
    )

    correct_answers = sum(
        1 for session in filtered_sessions
        if session.is_correct is True
    )

    wrong_answers = sum(
        1 for session in filtered_sessions
        if session.is_correct is False
    )

    # --------------------------------------------------
    # ACCURACY & PROGRESS
    # --------------------------------------------------
    if total_sessions > 0:
        accuracy = round((correct_answers / total_sessions) * 100, 2)
        progress = round((completed_sessions / total_sessions) * 100, 2)
    else:
        accuracy = 0.0
        progress = 0.0

    # --------------------------------------------------
    # DAILY PERFORMANCE
    # --------------------------------------------------
    daily_data = defaultdict(
        lambda: {
            "total_sessions": 0,
            "completed_sessions": 0,
            "correct_answers": 0,
            "wrong_answers": 0,
        }
    )

    for session in filtered_sessions:
        if session.started_at:
            date_key = session.started_at.date().isoformat()
        else:
            continue

        daily_data[date_key]["total_sessions"] += 1
        if session.session_status == "completed":
            daily_data[date_key]["completed_sessions"] += 1

        if session.is_correct is True:
            daily_data[date_key]["correct_answers"] += 1
        elif session.is_correct is False:
            daily_data[date_key]["wrong_answers"] += 1

    daily_performance = []
    for date_key in sorted(daily_data.keys()):
        data = daily_data[date_key]
        if data["total_sessions"] > 0:
            daily_accuracy = round(
                (data["correct_answers"] / data["total_sessions"]) * 100,
                2
            )
        else:
            daily_accuracy = 0.0

        daily_performance.append(
            DailyPerformance(
                date=date_key,
                total_sessions=data["total_sessions"],
                completed_sessions=data["completed_sessions"],
                correct_answers=data["correct_answers"],
                wrong_answers=data["wrong_answers"],
                accuracy=daily_accuracy,
            )
        )

    # --------------------------------------------------
    # CHALLENGE & DIFFICULTY PERFORMANCE
    # --------------------------------------------------
    challenge_ids = list(set(s.challenge_id for s in filtered_sessions if s.challenge_id))
    challenge_map = {}
    if challenge_ids:
        challenges = (
            db.query(CognitiveChallenge)
            .filter(CognitiveChallenge.id.in_(challenge_ids))
            .all()
        )
        challenge_map = {c.id: c for c in challenges}

    challenge_data = defaultdict(lambda: {"total": 0, "correct": 0, "wrong": 0})
    diff_data = defaultdict(lambda: {"total": 0, "correct": 0, "wrong": 0})

    for session in filtered_sessions:
        if not session.challenge_id:
            continue

        c_obj = challenge_map.get(session.challenge_id)
        c_type = c_obj.challenge_type if c_obj else "math"
        c_diff = c_obj.difficulty if c_obj else "medium"

        challenge_data[c_type]["total"] += 1
        diff_data[c_diff]["total"] += 1

        if session.is_correct is True:
            challenge_data[c_type]["correct"] += 1
            diff_data[c_diff]["correct"] += 1
        elif session.is_correct is False:
            challenge_data[c_type]["wrong"] += 1
            diff_data[c_diff]["wrong"] += 1

    challenge_performance = []
    for challenge_type in sorted(challenge_data.keys()):
        data = challenge_data[challenge_type]
        c_acc = round((data["correct"] / data["total"]) * 100, 2) if data["total"] > 0 else 0.0
        challenge_performance.append(
            ChallengePerformance(
                challenge_type=challenge_type,
                total=data["total"],
                correct=data["correct"],
                wrong=data["wrong"],
                accuracy=c_acc,
            )
        )

    difficulty_performance = []
    for diff_name in sorted(diff_data.keys()):
        data = diff_data[diff_name]
        d_acc = round((data["correct"] / data["total"]) * 100, 2) if data["total"] > 0 else 0.0
        difficulty_performance.append(
            DifficultyPerformanceItem(
                difficulty=diff_name.capitalize(),
                total=data["total"],
                correct=data["correct"],
                wrong=data["wrong"],
                accuracy=d_acc,
            )
        )

    # --------------------------------------------------
    # SNOOZE ANALYTICS (Milestone 4 — Phase 2)
    # --------------------------------------------------
    total_snoozes = sum(s.snooze_count or 0 for s in filtered_sessions)
    sessions_with_snooze = sum(1 for s in filtered_sessions if (s.snooze_count or 0) > 0)
    sessions_without_snooze = total_sessions - sessions_with_snooze
    snooze_rate = round((sessions_with_snooze / total_sessions) * 100, 1) if total_sessions > 0 else 0.0
    avg_snooze_count = round(total_snoozes / total_sessions, 2) if total_sessions > 0 else 0.0

    daily_snoozes = defaultdict(lambda: {"snooze_count": 0, "sessions_count": 0})
    for s in filtered_sessions:
        if s.started_at:
            d_key = s.started_at.date().isoformat()
            daily_snoozes[d_key]["sessions_count"] += 1
            daily_snoozes[d_key]["snooze_count"] += (s.snooze_count or 0)

    snooze_history = [
        SnoozeDailyItem(
            date=d_key,
            snooze_count=v["snooze_count"],
            sessions_count=v["sessions_count"],
        )
        for d_key, v in sorted(daily_snoozes.items())
    ]

    snooze_analytics_obj = SnoozeAnalyticsResponse(
        total_snoozes=total_snoozes,
        average_snooze_count=avg_snooze_count,
        sessions_with_snooze=sessions_with_snooze,
        sessions_without_snooze=sessions_without_snooze,
        snooze_rate=snooze_rate,
        snooze_history=snooze_history,
    )

    # --------------------------------------------------
    # WAKE-UP HISTORY OVER TIME (Milestone 4 — Phase 2)
    # Strictly zero answers or sensitive keys exposed!
    # --------------------------------------------------
    wake_up_history = []
    for s in filtered_sessions:
        a_obj = alarm_map.get(s.alarm_id)
        a_name = a_obj.name if a_obj else "Morning Alarm"
        a_time_str = format_alarm_time(getattr(a_obj, "alarm_time", None))
        actual_wake_str = format_time_ist(s.started_at)
        d_str = s.started_at.date().isoformat() if s.started_at else "Unknown"
        s_resp = calculate_session_response_time(s)
        resp_sec = round(s_resp if s_resp is not None else 0.0, 1)

        wake_up_history.append(
            WakeUpSessionItem(
                session_id=s.id,
                date=d_str,
                alarm_name=a_name,
                alarm_time=a_time_str,
                actual_wake_time=actual_wake_str,
                response_time_seconds=resp_sec,
                session_status=s.session_status or "unknown",
                dismissal_status=s.dismissal_status or "unknown",
            )
        )

    # --------------------------------------------------
    # EXECUTIVE KPIS: Response Time & Dismissals
    # --------------------------------------------------
    valid_resp = []
    for s in filtered_sessions:
        if s.session_status in ("completed", "expired") or s.completed_at is not None:
            r = calculate_session_response_time(s)
            if r is not None and 0.0 <= r <= MAX_VALID_RESPONSE_TIME_SECONDS:
                valid_resp.append(r)

    avg_response_time = round(sum(valid_resp) / len(valid_resp), 1) if valid_resp else 0.0
    successful_dismissals = sum(
        1 for s in filtered_sessions
        if (s.dismissal_status == "dismissed" or s.session_status == "completed")
    )

    # --------------------------------------------------
    # MILESTONE 3 ENRICHMENTS (Single Source of Truth)
    # --------------------------------------------------
    profile = (
        db.query(UserProfile)
        .filter(UserProfile.user_id == current_user.id)
        .first()
    )

    habit_data = get_ml_habit_score(
        sessions=filtered_sessions,
        user_profile=profile,
        alarms=alarms,
    )
    habit_score_obj = HabitScoreResponse(**habit_data)

    adaptive_res = get_ml_adaptive_difficulty(
        current_difficulty="medium",
        alarm=alarms[0] if alarms else None,
        user=current_user,
        user_profile=profile,
        past_sessions=filtered_sessions,
    )

    # --------------------------------------------------
    # SLEEP & ADHERENCE (Milestone 4 — Phase 2)
    # --------------------------------------------------
    preferred_wake = getattr(profile, "preferred_wake_time", None)
    sleep_dur = getattr(profile, "sleep_duration", None)
    has_profile = bool(profile and (preferred_wake or sleep_dur))
    preferred_wake_str = format_alarm_time(preferred_wake) if preferred_wake else "Not available"
    sleep_dur_str = f"{sleep_dur} hours" if sleep_dur is not None else "Not available"
    alignment_str = (
        f"Evaluated against target wake time ({preferred_wake_str})"
        if preferred_wake
        else "Not available (Configure wake time in Profile)"
    )

    sleep_adherence_obj = SleepAdherenceResponse(
        preferred_wake_time=preferred_wake_str,
        sleep_duration=sleep_dur_str,
        sleep_schedule_adherence=habit_data["sleep_schedule_adherence"],
        schedule_alignment=alignment_str,
        is_configured=has_profile,
    )

    # --------------------------------------------------
    # FINAL RESPONSE
    # --------------------------------------------------
    return AnalyticsResponse(
        total_alarms=total_alarms,
        active_alarms=active_alarms,
        total_sessions=total_sessions,
        completed_sessions=completed_sessions,
        correct_answers=correct_answers,
        wrong_answers=wrong_answers,
        accuracy=accuracy,
        progress=progress,
        daily_performance=daily_performance,
        challenge_performance=challenge_performance,
        # Milestone 3
        habit_score=habit_score_obj,
        recommended_difficulty=adaptive_res["recommended_difficulty"],
        # Milestone 4 Phase 2
        average_response_time=avg_response_time,
        successful_dismissals=successful_dismissals,
        wake_up_history=wake_up_history,
        difficulty_performance=difficulty_performance,
        snooze_analytics=snooze_analytics_obj,
        sleep_adherence=sleep_adherence_obj,
        time_range=time_range,
    )


# =====================================================================
# HABIT SCORE ENDPOINT (Milestone 3)
# =====================================================================

@router.get(
    "/habit-score",
    response_model=HabitScoreResponse,
)
def get_habit_score_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(AlarmSession)
        .join(Alarm, AlarmSession.alarm_id == Alarm.id)
        .filter(Alarm.user_id == current_user.id)
        .all()
    )
    profile = (
        db.query(UserProfile)
        .filter(UserProfile.user_id == current_user.id)
        .first()
    )
    alarms = (
        db.query(Alarm)
        .filter(Alarm.user_id == current_user.id)
        .all()
    )
    score_data = get_ml_habit_score(
        sessions=sessions,
        user_profile=profile,
        alarms=alarms,
    )
    return HabitScoreResponse(**score_data)


# =====================================================================
# RECOMMENDATIONS ENDPOINT (Milestone 3 — ML Primary)
# =====================================================================

@router.get(
    "/recommendations",
    response_model=RecommendationsResponse,
)
def get_recommendations_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(AlarmSession)
        .join(Alarm, AlarmSession.alarm_id == Alarm.id)
        .filter(Alarm.user_id == current_user.id)
        .order_by(AlarmSession.started_at.asc())
        .all()
    )
    profile = (
        db.query(UserProfile)
        .filter(UserProfile.user_id == current_user.id)
        .first()
    )
    alarms = (
        db.query(Alarm)
        .filter(Alarm.user_id == current_user.id)
        .all()
    )
    score_data = get_ml_habit_score(
        sessions=sessions,
        user_profile=profile,
        alarms=alarms,
    )
    recs = get_ml_recommendations(
        habit_score_data=score_data,
        recent_sessions=sessions,
        user_profile=profile,
        alarms=alarms,
    )
    pred_src = recs[0].get("prediction_source", "ml_model") if recs else "ml_model"
    return RecommendationsResponse(
        recommendations=[RecommendationItem(**r) for r in recs],
        total=len(recs),
        prediction_source=pred_src,
    )


# =====================================================================
# ADAPTIVE DIFFICULTY ENDPOINT (Milestone 3 — ML Primary)
# =====================================================================

@router.get(
    "/adaptive-difficulty",
    response_model=AdaptiveDifficultyResponse,
)
def get_adaptive_difficulty_endpoint(
    alarm_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_difficulty = "medium"
    target_alarm = None
    if alarm_id:
        target_alarm = (
            db.query(Alarm)
            .filter(Alarm.id == alarm_id, Alarm.user_id == current_user.id)
            .first()
        )
        if target_alarm and target_alarm.difficulty:
            current_difficulty = target_alarm.difficulty
    else:
        profile = (
            db.query(UserProfile)
            .filter(UserProfile.user_id == current_user.id)
            .first()
        )
        if profile and profile.difficulty_preference:
            current_difficulty = profile.difficulty_preference

    session_query = (
        db.query(AlarmSession)
        .join(Alarm, AlarmSession.alarm_id == Alarm.id)
        .filter(Alarm.user_id == current_user.id)
    )
    if alarm_id:
        session_query = session_query.filter(AlarmSession.alarm_id == alarm_id)

    sessions = session_query.order_by(AlarmSession.started_at.asc()).all()

    profile = (
        db.query(UserProfile)
        .filter(UserProfile.user_id == current_user.id)
        .first()
    )

    result = get_ml_adaptive_difficulty(
        current_difficulty=current_difficulty,
        alarm=target_alarm,
        user=current_user,
        user_profile=profile,
        past_sessions=sessions,
    )

    return AdaptiveDifficultyResponse(
        current_difficulty=result["current_difficulty"],
        recommended_difficulty=result["recommended_difficulty"],
        accuracy=result["accuracy"],
        sample_size=result["sample_size"],
        adjusted=result["adjusted"],
        reason=result["reason"],
        action=result.get("action"),
        prediction_source=result.get("prediction_source", "rule_based_fallback"),
        confidence=result.get("confidence"),
    )