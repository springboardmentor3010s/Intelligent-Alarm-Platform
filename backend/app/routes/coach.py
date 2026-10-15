from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import (
    Alarm,
    AlarmSession,
    CognitiveChallenge,
    Habit,
    User,
    UserProfile,
)
from app.schemas.coach import (
    ClientHabitsResponse,
    ClientInsightsResponse,
    ClientSleepTrendsResponse,
    ClientSummary,
    CoachDashboardStats,
    SleepLogItem,
)
from app.services.adaptive_service import calculate_adaptive_difficulty_from_sessions
from app.services.habit_scorer import evaluate_user_habit
from app.services.ml_intelligence_service import (
    get_ml_adaptive_difficulty,
    get_ml_habit_score,
    get_ml_recommendations,
)
from app.services.report_generator import (
    calculate_session_response_time,
    format_ist_timestamp,
    get_user_report_data,
)
from app.utils.dependencies import require_coach_or_admin


router = APIRouter(
    prefix="/api/coach",
    tags=["Wellness Coach"],
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
    """Formats a time object into 12-hour AM/PM string."""
    if not t:
        return "Not set"
    try:
        hour = t.hour
        minute = t.minute
        period = "AM" if hour < 12 else "PM"
        h12 = hour % 12 or 12
        return f"{h12:02d}:{minute:02d} {period}"
    except Exception:
        return str(t)


def get_authorized_client(client_id: int, db: Session) -> User:
    """
    Safely retrieves a client user while enforcing strict data isolation.
    - Only users with role='user' are accessible to wellness coaches.
    - Admin accounts (role='admin') and other coaches (role='wellness_coach') are strictly protected.
    - Non-existent clients trigger HTTP 404; attempts to access non-clients trigger HTTP 403.
    """
    client = db.query(User).filter(User.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    if client.role != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: target account is not an authorized client",
        )
    return client


# =====================================================================
# 1. AUTH & ROLE VERIFICATION
# =====================================================================

@router.get("/test")
def coach_test(
    current_user: User = Depends(require_coach_or_admin),
):
    return {
        "message": "Wellness coach access granted",
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role,
        },
    }


@router.get("/profile")
def coach_profile(
    current_user: User = Depends(require_coach_or_admin),
):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "status": "active",
    }


# =====================================================================
# 2. CLIENT OVERVIEW & DASHBOARD
# =====================================================================

def _build_client_summary(client: User, db: Session) -> ClientSummary:
    profile = db.query(UserProfile).filter(UserProfile.user_id == client.id).first()
    alarms = db.query(Alarm).filter(Alarm.user_id == client.id).all()
    alarm_ids = [a.id for a in alarms]

    sessions = []
    if alarm_ids:
        sessions = (
            db.query(AlarmSession)
            .filter(AlarmSession.alarm_id.in_(alarm_ids))
            .all()
        )

    habit_metrics = evaluate_user_habit(sessions=sessions, user_profile=profile, alarms=alarms)
    total_sessions = len(sessions)
    completed_sessions = sum(1 for s in sessions if s.session_status == "completed")
    completion_rate = round((completed_sessions / total_sessions * 100), 1) if total_sessions > 0 else 0.0

    return ClientSummary(
        id=client.id,
        name=client.name,
        email=client.email,
        created_at=client.created_at,
        preferred_wake_time=format_alarm_time(profile.preferred_wake_time) if profile else None,
        sleep_duration=profile.sleep_duration if profile else None,
        time_zone=profile.time_zone if profile else None,
        difficulty_preference=profile.difficulty_preference if profile else "medium",
        habit_score=round(habit_metrics["overall_habit_score"], 1),
        total_alarms=len(alarms),
        active_alarms=sum(1 for a in alarms if a.is_active),
        total_sessions=total_sessions,
        completed_sessions=completed_sessions,
        completion_rate=completion_rate,
    )


@router.get("/clients", response_model=List[ClientSummary])
def get_authorized_clients(
    search: Optional[str] = Query(None, description="Search client by name or email"),
    current_user: User = Depends(require_coach_or_admin),
    db: Session = Depends(get_db),
):
    """
    Returns the list of authorized clients (users with role='user') for coaching oversight.
    Admin and other coach accounts are strictly excluded.
    """
    query = db.query(User).filter(User.role == "user")
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter((User.name.ilike(search_term)) | (User.email.ilike(search_term)))

    clients = query.order_by(User.id.asc()).all()
    return [_build_client_summary(c, db) for c in clients]


@router.get("/clients/{client_id}", response_model=ClientSummary)
def get_client_summary(
    client_id: int,
    current_user: User = Depends(require_coach_or_admin),
    db: Session = Depends(get_db),
):
    """
    Returns single client summary card with authorized client validation.
    """
    client = get_authorized_client(client_id, db)
    return _build_client_summary(client, db)


@router.get("/dashboard", response_model=CoachDashboardStats)
def get_coach_dashboard(
    current_user: User = Depends(require_coach_or_admin),
    db: Session = Depends(get_db),
):
    """
    Returns aggregate wellness coach workspace KPI statistics across all assigned clients.
    """
    clients = db.query(User).filter(User.role == "user").all()
    summaries = [_build_client_summary(c, db) for c in clients]

    total_clients = len(summaries)
    active_clients = sum(1 for s in summaries if s.total_sessions > 0)
    total_completed = sum(s.completed_sessions for s in summaries)
    avg_score = (
        round(sum(s.habit_score for s in summaries) / total_clients, 1)
        if total_clients > 0
        else 60.0
    )

    return CoachDashboardStats(
        total_clients=total_clients,
        active_clients=active_clients,
        average_habit_score=avg_score,
        total_completed_sessions=total_completed,
        clients=summaries,
    )


# =====================================================================
# 3. CLIENT BEHAVIOR INSIGHTS
# =====================================================================

@router.get("/clients/{client_id}/insights", response_model=ClientInsightsResponse)
def get_client_behavior_insights(
    client_id: int,
    current_user: User = Depends(require_coach_or_admin),
    db: Session = Depends(get_db),
):
    """
    Aggregates behavioral metrics, consistency, and ML intelligence recommendations for the specified client.
    """
    client = get_authorized_client(client_id, db)
    profile = db.query(UserProfile).filter(UserProfile.user_id == client.id).first()
    alarms = db.query(Alarm).filter(Alarm.user_id == client.id).all()
    alarm_ids = [a.id for a in alarms]

    sessions = []
    if alarm_ids:
        sessions = (
            db.query(AlarmSession)
            .filter(AlarmSession.alarm_id.in_(alarm_ids))
            .order_by(AlarmSession.started_at.desc())
            .all()
        )

    habit_metrics = evaluate_user_habit(sessions=sessions, user_profile=profile, alarms=alarms)
    total_sessions = len(sessions)
    completed_sessions = sum(1 for s in sessions if s.session_status == "completed")
    correct_count = sum(1 for s in sessions if s.is_correct is True)
    total_snoozes = sum(s.snooze_count or 0 for s in sessions)

    valid_response_times = [
        calculate_session_response_time(s)
        for s in sessions
        if calculate_session_response_time(s) is not None
    ]
    avg_response_time = (
        round(sum(valid_response_times) / len(valid_response_times), 1)
        if valid_response_times
        else 0.0
    )

    # ML Intelligence
    ml_habit = get_ml_habit_score(
        sessions=sessions,
        user_profile=profile,
        alarms=alarms,
    )
    current_diff = profile.difficulty_preference if profile else "medium"
    ml_adapt = get_ml_adaptive_difficulty(
        current_difficulty=current_diff,
        alarm=alarms[0] if alarms else None,
        user=client,
        user_profile=profile,
        past_sessions=sessions,
    )
    ml_recs = get_ml_recommendations(
        habit_score_data=ml_habit,
        recent_sessions=sessions,
        user_profile=profile,
        alarms=alarms,
    )

    behavioral_summary = {
        "total_alarms": len(alarms),
        "active_alarms": sum(1 for a in alarms if a.is_active),
        "total_sessions": total_sessions,
        "completed_sessions": completed_sessions,
        "completion_rate": round(completed_sessions / total_sessions * 100, 1) if total_sessions > 0 else 0.0,
        "accuracy_rate": round(correct_count / total_sessions * 100, 1) if total_sessions > 0 else 0.0,
        "average_snooze_count": round(total_snoozes / total_sessions, 2) if total_sessions > 0 else 0.0,
        "average_response_time_seconds": avg_response_time,
    }

    client_info = {
        "id": client.id,
        "name": client.name,
        "email": client.email,
        "preferred_wake_time": format_alarm_time(profile.preferred_wake_time) if profile else "Not set",
        "sleep_duration": profile.sleep_duration if profile else None,
        "time_zone": profile.time_zone if profile else "Asia/Kolkata",
        "difficulty_preference": profile.difficulty_preference if profile else "medium",
    }

    return ClientInsightsResponse(
        client=client_info,
        behavioral_summary=behavioral_summary,
        habit_metrics=habit_metrics,
        ml_insights={
            "ml_behavioral_score": ml_habit.get("ml_behavioral_score"),
            "ml_recommended_difficulty": ml_adapt.get("recommended_difficulty"),
            "ml_confidence": ml_adapt.get("confidence"),
            "recommendations": ml_recs if isinstance(ml_recs, list) else ml_recs.get("recommendations", []),
        },
    )


# =====================================================================
# 4. HABIT ADHERENCE ANALYTICS
# =====================================================================

@router.get("/clients/{client_id}/habits", response_model=ClientHabitsResponse)
def get_client_habit_adherence(
    client_id: int,
    current_user: User = Depends(require_coach_or_admin),
    db: Session = Depends(get_db),
):
    """
    Returns habit goals, multi-factor habit adherence scores, and snooze breakdown for coaching review.
    """
    client = get_authorized_client(client_id, db)
    habit = db.query(Habit).filter(Habit.user_id == client.id).first()
    profile = db.query(UserProfile).filter(UserProfile.user_id == client.id).first()
    alarms = db.query(Alarm).filter(Alarm.user_id == client.id).all()
    alarm_ids = [a.id for a in alarms]

    sessions = []
    if alarm_ids:
        sessions = (
            db.query(AlarmSession)
            .filter(AlarmSession.alarm_id.in_(alarm_ids))
            .order_by(AlarmSession.started_at.desc())
            .all()
        )

    habit_metrics = evaluate_user_habit(sessions=sessions, user_profile=profile, alarms=alarms)

    # Calculate active streak (consecutive completed sessions)
    streak = 0
    for s in sessions:
        if s.session_status == "completed" and s.is_correct is True:
            streak += 1
        else:
            break

    # Snooze frequency distribution
    snooze_distribution = defaultdict(int)
    for s in sessions:
        cnt = s.snooze_count or 0
        if cnt == 0:
            snooze_distribution["zero_snooze"] += 1
        elif cnt == 1:
            snooze_distribution["one_snooze"] += 1
        elif cnt == 2:
            snooze_distribution["two_snoozes"] += 1
        else:
            snooze_distribution["three_plus_snoozes"] += 1

    return ClientHabitsResponse(
        client_id=client.id,
        client_name=client.name,
        goals={
            "wake_up_goal": habit.wake_up_goal if habit else None,
            "productivity_goals": habit.productivity_goals if habit else None,
            "habit_preferences": habit.habit_preferences if habit else None,
        },
        adherence_metrics={
            "overall_habit_score": round(habit_metrics["overall_habit_score"], 1),
            "wake_up_consistency": round(habit_metrics["wake_up_consistency"], 1),
            "challenge_completion": round(habit_metrics["challenge_completion"], 1),
            "snooze_reduction": round(habit_metrics["snooze_reduction"], 1),
            "sleep_schedule_adherence": round(habit_metrics["sleep_schedule_adherence"], 1),
        },
        streak=streak,
        snooze_frequency=dict(snooze_distribution),
    )


# =====================================================================
# 5. SLEEP TREND REPORTS
# =====================================================================

@router.get("/clients/{client_id}/sleep", response_model=ClientSleepTrendsResponse)
def get_client_sleep_trends(
    client_id: int,
    current_user: User = Depends(require_coach_or_admin),
    db: Session = Depends(get_db),
):
    """
    Evaluates circadian alignment, scheduled vs actual wake times, and wake-up drift.
    """
    client = get_authorized_client(client_id, db)
    profile = db.query(UserProfile).filter(UserProfile.user_id == client.id).first()
    alarms = db.query(Alarm).filter(Alarm.user_id == client.id).all()
    alarm_map = {a.id: a for a in alarms}
    alarm_ids = list(alarm_map.keys())

    sessions = []
    if alarm_ids:
        sessions = (
            db.query(AlarmSession)
            .filter(AlarmSession.alarm_id.in_(alarm_ids))
            .order_by(AlarmSession.started_at.desc())
            .limit(30)
            .all()
        )

    wake_up_log: List[SleepLogItem] = []
    drifts: List[float] = []
    on_time_count = 0

    for s in sessions:
        alarm = alarm_map.get(s.alarm_id)
        alarm_name = alarm.name if alarm else "Alarm"
        sched_time_str = format_alarm_time(alarm.alarm_time) if alarm else "06:30 AM"

        start_ist = format_ist_timestamp(s.started_at)
        comp_ist = format_ist_timestamp(s.completed_at) if s.completed_at else "—"
        actual_wake = format_time_ist(s.completed_at or s.started_at)

        # Drift calculation in minutes between scheduled alarm time and completion time
        drift_minutes: Optional[float] = None
        is_on_time = False

        if alarm and alarm.alarm_time and s.started_at:
            sched_hour = alarm.alarm_time.hour
            sched_min = alarm.alarm_time.minute
            sched_total_min = sched_hour * 60 + sched_min

            # Actual time in IST
            st = s.started_at
            if st.tzinfo is None:
                st = st.replace(tzinfo=timezone.utc)
            try:
                ist_dt = st.astimezone(ZoneInfo("Asia/Kolkata"))
            except Exception:
                ist_dt = st.astimezone(timezone(timedelta(hours=5, minutes=30)))

            actual_total_min = ist_dt.hour * 60 + ist_dt.minute
            drift = actual_total_min - sched_total_min
            # normalize midnight boundaries
            if drift > 720:
                drift -= 1440
            elif drift < -720:
                drift += 1440

            drift_minutes = round(drift, 1)
            drifts.append(abs(drift_minutes))
            is_on_time = abs(drift) <= 15 and (s.snooze_count or 0) <= 1
            if is_on_time:
                on_time_count += 1

        wake_up_log.append(
            SleepLogItem(
                session_id=s.id,
                alarm_id=s.alarm_id,
                alarm_name=alarm_name,
                scheduled_alarm_time=sched_time_str,
                started_at_ist=start_ist,
                completed_at_ist=comp_ist,
                actual_wake_time=actual_wake,
                drift_minutes=drift_minutes,
                on_time=is_on_time,
                snooze_count=s.snooze_count or 0,
                dismissal_status=s.dismissal_status or "dismissed",
            )
        )

    total_eval = len(wake_up_log)
    adherence_pct = round((on_time_count / total_eval * 100), 1) if total_eval > 0 else 80.0
    avg_drift = round(sum(drifts) / len(drifts), 1) if drifts else 0.0

    return ClientSleepTrendsResponse(
        client_id=client.id,
        client_name=client.name,
        preferred_wake_time=format_alarm_time(profile.preferred_wake_time) if profile else None,
        sleep_duration_hours=profile.sleep_duration if profile else None,
        sleep_adherence_percentage=adherence_pct,
        average_wake_drift_minutes=avg_drift,
        total_evaluated_sessions=total_eval,
        wake_up_log=wake_up_log,
    )


# =====================================================================
# 6. CLIENT PROGRESS MONITORING & COMPREHENSIVE ANALYTICS
# =====================================================================

@router.get("/clients/{client_id}/analytics")
def get_client_progress_analytics(
    client_id: int,
    time_range: str = "all",
    current_user: User = Depends(require_coach_or_admin),
    db: Session = Depends(get_db),
):
    """
    Returns comprehensive analytics for progress monitoring, including cognitive puzzle breakdown,
    difficulty response stats, and historical adherence.
    """
    client = get_authorized_client(client_id, db)
    report_data = get_user_report_data(client, db)
    return {
        "client_id": client.id,
        "client_name": client.name,
        "client_email": client.email,
        "time_range": time_range,
        "report_summary": report_data,
    }
