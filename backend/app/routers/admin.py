"""
admin.py

FastAPI router for Administrator role endpoints:
- Global platform analytics & KPIs
- User account management & role assignments
- Platform monitoring & operational oversight
"""

from datetime import date, datetime, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field

from ..database import get_db
from ..models.user import User
from ..models.alarm import Alarm
from ..models.challenge import Challenge
from ..models.challenge_attempt import ChallengeAttempt
from ..models.activity import Activity
from ..models.recommendation import Recommendation
from ..models.coach_assignment import CoachAssignment
from ..models.notification import Notification
from ..models.login_event import LoginEvent
from ..models.alarm_performance import AlarmPerformance
from ..utils.deps import require_roles
from ..services.analytics_service import get_dashboard
from ..services.coach_assignment_service import assign_unassigned_users
from ..services.report_service import build_platform_excel, build_platform_pdf


router = APIRouter(
    prefix="/api/admin",
    tags=["Administrator"],
    dependencies=[Depends(require_roles("admin"))],
)


class RoleUpdate(BaseModel):
    role: str = Field(min_length=1, max_length=30)


def _period_bounds(start_date: Optional[date], end_date: Optional[date]):
    end_day = end_date or datetime.utcnow().date()
    start_day = start_date or (end_day - timedelta(days=29))
    if start_day > end_day:
        raise HTTPException(status_code=400, detail="start_date must be on or before end_date")
    if (end_day - start_day).days > 365:
        raise HTTPException(status_code=400, detail="Reporting periods cannot exceed 366 days")
    return (
        datetime.combine(start_day, time.min),
        datetime.combine(end_day + timedelta(days=1), time.min),
        start_day,
        end_day,
    )


@router.get("/platform-analytics")
def get_platform_analytics(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    admin_user=Depends(require_roles("admin")),
):
    lower, upper, start_day, end_day = _period_bounds(start_date, end_date)
    users = db.query(User).all()
    total_users = len(users)
    role_counts = {
        "user": sum(1 for user in users if user.role == "user"),
        "wellness_coach": sum(1 for user in users if user.role == "wellness_coach"),
        "admin": sum(1 for user in users if user.role == "admin"),
    }
    active_user_ids = {
        row[0] for row in db.query(Activity.user_id)
        .filter(Activity.created_at >= lower, Activity.created_at < upper)
        .distinct()
        .all()
    }
    active_user_ids.update(
        row[0] for row in db.query(ChallengeAttempt.user_id)
        .filter(ChallengeAttempt.created_at >= lower, ChallengeAttempt.created_at < upper)
        .distinct()
        .all()
    )
    login_period_filter = (
        LoginEvent.logged_at >= lower,
        LoginEvent.logged_at < upper,
    )
    active_user_ids.update(
        row[0]
        for row in db.query(LoginEvent.user_id)
        .filter(*login_period_filter)
        .distinct()
        .all()
    )
    successful_logins = (
        db.query(LoginEvent.id)
        .filter(*login_period_filter)
        .count()
    )
    users_logged_in = (
        db.query(LoginEvent.user_id)
        .filter(*login_period_filter)
        .distinct()
        .count()
    )
    recent_logins = (
        db.query(LoginEvent)
        .filter(*login_period_filter)
        .order_by(LoginEvent.logged_at.desc())
        .limit(20)
        .all()
    )
    login_trend = [
        {
            "date": day.isoformat() if hasattr(day, "isoformat") else str(day),
            "logins": count,
            "users": users_count,
        }
        for day, count, users_count in db.query(
            func.date(LoginEvent.logged_at),
            func.count(LoginEvent.id),
            func.count(func.distinct(LoginEvent.user_id)),
        )
        .filter(*login_period_filter)
        .group_by(func.date(LoginEvent.logged_at))
        .order_by(func.date(LoginEvent.logged_at).asc())
        .all()
    ]
    activities = (
        db.query(Activity)
        .filter(Activity.created_at >= lower, Activity.created_at < upper)
        .order_by(Activity.created_at.desc())
        .all()
    )
    activity_counts = {}
    activity_trend = {}
    for activity in activities:
        activity_counts[activity.activity_type] = activity_counts.get(activity.activity_type, 0) + 1
        if activity.created_at:
            key = activity.created_at.date().isoformat()
            bucket = activity_trend.setdefault(key, {"date": key, "triggers": 0, "completions": 0, "snoozes": 0, "events": 0})
            bucket["events"] += 1
            if activity.activity_type == "trigger":
                bucket["triggers"] += 1
            elif activity.activity_type == "complete":
                bucket["completions"] += 1
            elif activity.activity_type == "snooze":
                bucket["snoozes"] += 1

    challenges = (
        db.query(Challenge)
        .filter(Challenge.created_at >= lower, Challenge.created_at < upper)
        .all()
    )
    active_user_ids.update(challenge.user_id for challenge in challenges)
    sessions = {}
    for challenge in challenges:
        sessions.setdefault((challenge.user_id, challenge.session_id), []).append(challenge)
    completed_sessions = sum(
        1 for session in sessions.values() if session and all(item.is_completed for item in session)
    )
    attempts = (
        db.query(ChallengeAttempt)
        .filter(ChallengeAttempt.created_at >= lower, ChallengeAttempt.created_at < upper)
        .all()
    )
    if attempts:
        accuracy_records = attempts
    else:
        accuracy_records = [item for item in challenges if item.is_correct is not None]
    correct_answers = sum(1 for item in accuracy_records if item.is_correct)
    accuracy = round(correct_answers * 100 / len(accuracy_records), 1) if accuracy_records else None
    completion_rate = round(completed_sessions * 100 / len(sessions), 1) if sessions else None

    difficulty_distribution = {}
    challenge_trend = {}
    for challenge in challenges:
        difficulty_distribution[challenge.difficulty] = difficulty_distribution.get(challenge.difficulty, 0) + 1
        if challenge.created_at:
            key = challenge.created_at.date().isoformat()
            bucket = challenge_trend.setdefault(key, {"date": key, "generated": 0, "answered": 0, "correct": 0})
            bucket["generated"] += 1
    for attempt in attempts:
        if attempt.created_at:
            key = attempt.created_at.date().isoformat()
            bucket = challenge_trend.setdefault(key, {"date": key, "generated": 0, "answered": 0, "correct": 0})
            bucket["answered"] += 1
            bucket["correct"] += int(attempt.is_correct)
    if not attempts:
        for challenge in accuracy_records:
            if challenge.created_at:
                key = challenge.created_at.date().isoformat()
                bucket = challenge_trend.setdefault(key, {"date": key, "generated": 0, "answered": 0, "correct": 0})
                bucket["answered"] += 1
                bucket["correct"] += int(challenge.is_correct)
    for bucket in challenge_trend.values():
        bucket["accuracy"] = round(bucket["correct"] * 100 / bucket["answered"], 1) if bucket["answered"] else None

    recommendation_rows = (
        db.query(Recommendation)
        .filter(Recommendation.created_at >= lower, Recommendation.created_at < upper)
        .all()
    )
    users_with_behavior = {
        row[0] for row in db.query(Activity.user_id).distinct().all()
    } | {
        row[0] for row in db.query(ChallengeAttempt.user_id).distinct().all()
    }
    dashboard_metrics = [
        get_dashboard(db, user)
        for user in users
        if user.id in users_with_behavior
    ]
    scores = [item["habit_score"] for item in dashboard_metrics if item["habit_score"] is not None]
    wake_consistency_scores = [
        item["wake_consistency_pct"] for item in dashboard_metrics
        if item["alarm_completions"] > 0
    ]
    average_habit_score = round(sum(scores) / len(scores), 1) if scores else None
    total_snoozes = activity_counts.get("snooze", 0)
    total_completions = activity_counts.get("complete", 0)
    total_triggers = activity_counts.get("trigger", 0)
    user_names = {user.id: user.name for user in users}
    recent_events = [
        {
            "id": f"activity-{item.id}",
            "user_id": item.user_id,
            "user_name": user_names.get(item.user_id, "Deleted user"),
            "activity_type": item.activity_type,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in activities
    ]
    recent_events.extend(
        {
            "id": f"login-{event.id}",
            "user_id": event.user_id,
            "user_name": user_names.get(event.user_id, "Deleted user"),
            "activity_type": "login",
            "created_at": event.logged_at.isoformat() if event.logged_at else None,
        }
        for event in recent_logins
    )
    recent_events.sort(key=lambda item: item["created_at"] or "", reverse=True)
    assigned_user_ids = {
        row[0] for row in db.query(CoachAssignment.user_id)
        .join(User, User.id == CoachAssignment.coach_id)
        .filter(User.role == "wellness_coach")
        .distinct()
        .all()
    }
    admin_coach = (
        db.query(User)
        .filter(User.role == "admin")
        .order_by(User.id.asc())
        .first()
    )
    unassigned_user_count = sum(
        1 for user in users if user.role == "user" and user.id not in assigned_user_ids
    )
    if admin_coach is not None:
        unassigned_user_count = 0
    return {
        "period": {"start_date": start_day.isoformat(), "end_date": end_day.isoformat()},
        "total_users": total_users,
        "active_users": len(active_user_ids),
        "successful_logins": successful_logins,
        "users_logged_in": users_logged_in,
        "login_trend": login_trend,
        "users_without_coach": unassigned_user_count,
        "users_by_role": role_counts,
        "total_alarms": db.query(Alarm).count(),
        "active_alarms": db.query(Alarm).filter(Alarm.is_active.is_(True)).count(),
        "total_challenges": len(sessions),
        "completed_challenges": completed_sessions,
        "challenge_completion_rate": completion_rate,
        "platform_accuracy": accuracy,
        "platform_avg_habit_score": average_habit_score,
        "habit_score_sample_size": len(scores),
        "wake_consistency_pct": round(
            sum(wake_consistency_scores) / len(wake_consistency_scores), 1
        ) if wake_consistency_scores else None,
        "wake_consistency_sample_size": len(wake_consistency_scores),
        "activity_summary": {
            "total_triggers": total_triggers,
            "total_completions": total_completions,
            "total_snoozes": total_snoozes,
            "engagement_events": len(activities),
            "successful_logins": successful_logins,
        },
        "activity_trend": [activity_trend[key] for key in sorted(activity_trend)],
        "challenge_trend": [challenge_trend[key] for key in sorted(challenge_trend)],
        "difficulty_distribution": [
            {"difficulty": key, "count": count}
            for key, count in sorted(difficulty_distribution.items())
        ],
        "recommendation_activity": {
            "generated": len(recommendation_rows),
            "acted_upon": sum(1 for item in recommendation_rows if item.is_acted_upon),
            "dismissed": sum(1 for item in recommendation_rows if item.is_dismissed),
        },
        "habit_score_trend": None,
        "unavailable_metrics": {
            "habit_score_trend": "Habit score snapshots are not stored historically.",
            "application_errors": "Application error events are not stored in a queryable log.",
            "account_activation": "The user model does not record account activation status.",
        },
        "recent_activities": recent_events[:20],
    }


@router.get("/users")
def list_users(
    q: Optional[str] = Query(None, max_length=100),
    role: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    admin_user=Depends(require_roles("admin")),
):
    query = db.query(User)
    if role:
        if role not in {"user", "wellness_coach", "admin"}:
            raise HTTPException(status_code=400, detail="Unsupported role filter")
        query = query.filter(User.role == role)
    if q:
        search = f"%{q.strip()}%"
        query = query.filter((User.name.ilike(search)) | (User.email.ilike(search)))
    total = query.count()
    users = (
        query.order_by(User.created_at.desc(), User.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    user_ids = [user.id for user in users]
    alarm_counts = dict(
        db.query(Alarm.user_id, func.count(Alarm.id))
        .filter(Alarm.user_id.in_(user_ids))
        .group_by(Alarm.user_id)
        .all()
    ) if user_ids else {}
    active_alarm_counts = dict(
        db.query(Alarm.user_id, func.count(Alarm.id))
        .filter(Alarm.user_id.in_(user_ids), Alarm.is_active.is_(True))
        .group_by(Alarm.user_id)
        .all()
    ) if user_ids else {}
    last_activity = dict(
        db.query(Activity.user_id, func.max(Activity.created_at))
        .filter(Activity.user_id.in_(user_ids))
        .group_by(Activity.user_id)
        .all()
    ) if user_ids else {}
    last_challenge_answer = dict(
        db.query(ChallengeAttempt.user_id, func.max(ChallengeAttempt.created_at))
        .filter(ChallengeAttempt.user_id.in_(user_ids))
        .group_by(ChallengeAttempt.user_id)
        .all()
    ) if user_ids else {}
    last_legacy_answer = dict(
        db.query(Challenge.user_id, func.max(Challenge.created_at))
        .filter(
            Challenge.user_id.in_(user_ids),
            (Challenge.is_correct.isnot(None))
            | (Challenge.user_answer.isnot(None)),
        )
        .group_by(Challenge.user_id)
        .all()
    ) if user_ids else {}
    for user_id in user_ids:
        challenge_at = max(
            filter(None, (
                last_challenge_answer.get(user_id),
                last_legacy_answer.get(user_id),
            )),
            default=None,
        )
        if challenge_at and (
            last_activity.get(user_id) is None
            or challenge_at > last_activity[user_id]
        ):
            last_activity[user_id] = challenge_at
    login_counts = dict(
        db.query(LoginEvent.user_id, func.count(LoginEvent.id))
        .filter(LoginEvent.user_id.in_(user_ids))
        .group_by(LoginEvent.user_id)
        .all()
    ) if user_ids else {}
    last_login = dict(
        db.query(LoginEvent.user_id, func.max(LoginEvent.logged_at))
        .filter(LoginEvent.user_id.in_(user_ids))
        .group_by(LoginEvent.user_id)
        .all()
    ) if user_ids else {}
    performance_counts = dict(
        db.query(AlarmPerformance.user_id, func.count(AlarmPerformance.id))
        .filter(AlarmPerformance.user_id.in_(user_ids))
        .group_by(AlarmPerformance.user_id)
        .all()
    ) if user_ids else {}
    last_performance = dict(
        db.query(AlarmPerformance.user_id, func.max(AlarmPerformance.completed_at))
        .filter(AlarmPerformance.user_id.in_(user_ids))
        .group_by(AlarmPerformance.user_id)
        .all()
    ) if user_ids else {}
    coach_assignments = (
        db.query(CoachAssignment.user_id, User.name)
        .join(User, User.id == CoachAssignment.coach_id)
        .filter(CoachAssignment.user_id.in_(user_ids), User.role == "wellness_coach")
        .order_by(User.name.asc())
        .all()
    ) if user_ids else []
    coach_names_by_user = {}
    for client_id, coach_name in coach_assignments:
        coach_names_by_user.setdefault(client_id, []).append(coach_name)
    admin_coach = (
        db.query(User)
        .filter(User.role == "admin")
        .order_by(User.id.asc())
        .first()
    )
    return {
        "items": [
            {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role,
                "preferred_wake_time": user.preferred_wake_time,
                "total_alarms": alarm_counts.get(user.id, 0),
                "active_alarms": active_alarm_counts.get(user.id, 0),
                "recorded_performances": performance_counts.get(user.id, 0),
                "last_performance_at": (
                    last_performance[user.id].isoformat()
                    if last_performance.get(user.id)
                    else None
                ),
                "successful_logins": login_counts.get(user.id, 0),
                "last_login_at": last_login[user.id].isoformat() if last_login.get(user.id) else None,
                "assigned_coaches": coach_names_by_user.get(user.id, []),
                "coach_coverage": (
                    {
                        "coach_name": f"{admin_coach.name} (Admin Wellness Coach)",
                        "coverage": "admin_all_users",
                    }
                    if user.role == "user" and admin_coach
                    else {
                        "coach_name": coach_names_by_user[user.id][0],
                        "coverage": "assigned",
                    }
                    if user.role == "user" and coach_names_by_user.get(user.id)
                    else {"coach_name": None, "coverage": "waiting_for_coach"}
                    if user.role == "user"
                    else {"coach_name": None, "coverage": "not_applicable"}
                ),
                "last_active_at": last_activity[user.id].isoformat() if last_activity.get(user.id) else None,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            }
            for user in users
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


@router.get("/users/{target_user_id}")
def get_user_details(
    target_user_id: int,
    db: Session = Depends(get_db),
    admin_user=Depends(require_roles("admin")),
):
    target = db.query(User).filter(User.id == target_user_id).first()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    dashboard = get_dashboard(db, target)
    activity = (
        db.query(Activity)
        .filter(Activity.user_id == target_user_id)
        .order_by(Activity.created_at.desc())
        .limit(20)
        .all()
    )
    login_history = (
        db.query(LoginEvent)
        .filter(LoginEvent.user_id == target_user_id)
        .order_by(LoginEvent.logged_at.desc())
        .limit(30)
        .all()
    )
    assigned_coaches = (
        db.query(User.id, User.name, User.email)
        .join(CoachAssignment, CoachAssignment.coach_id == User.id)
        .filter(CoachAssignment.user_id == target_user_id)
        .order_by(User.name.asc())
        .all()
    )
    admin_coach = (
        db.query(User)
        .filter(User.role == "admin")
        .order_by(User.id.asc())
        .first()
    )
    coach_coverage = (
        {
            "coach_name": f"{admin_coach.name} (Admin Wellness Coach)",
            "coverage": "admin_all_users",
        }
        if target.role == "user" and admin_coach
        else {
            "coach_name": assigned_coaches[0].name,
            "coverage": "assigned",
        }
        if target.role == "user" and assigned_coaches
        else {"coach_name": None, "coverage": "waiting_for_coach"}
        if target.role == "user"
        else {"coach_name": None, "coverage": "not_applicable"}
    )
    alarm_details = (
        db.query(Alarm)
        .filter(Alarm.user_id == target_user_id)
        .order_by(Alarm.created_at.desc())
        .all()
    )
    challenge_history = (
        db.query(ChallengeAttempt)
        .filter(ChallengeAttempt.user_id == target_user_id)
        .order_by(ChallengeAttempt.created_at.desc())
        .limit(50)
        .all()
    )
    challenge_records = [
        {
            "id": item.id,
            "source": "attempt",
            "challenge_id": item.challenge_id,
            "challenge_type": item.challenge_type,
            "difficulty": item.difficulty,
            "user_answer": item.user_answer,
            "is_correct": item.is_correct,
            "is_completed": item.is_completed,
            "response_time_seconds": item.response_time,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in challenge_history
    ]
    attempt_challenge_ids = [item.challenge_id for item in challenge_history]
    legacy_filter = [
        Challenge.user_id == target_user_id,
        (Challenge.is_correct.isnot(None))
        | (Challenge.user_answer.isnot(None)),
    ]
    if attempt_challenge_ids:
        legacy_filter.append(~Challenge.id.in_(attempt_challenge_ids))
    answered_challenges = (
        db.query(Challenge)
        .filter(*legacy_filter)
        .order_by(Challenge.created_at.desc())
        .limit(50)
        .all()
    )
    challenge_records.extend(
        {
            "id": item.id,
            "source": "challenge",
            "challenge_id": item.id,
            "challenge_type": item.challenge_type,
            "difficulty": item.difficulty,
            "user_answer": item.user_answer,
            "is_correct": item.is_correct,
            "is_completed": item.is_completed,
            "response_time_seconds": item.response_time,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in answered_challenges
    )
    challenge_records.sort(key=lambda item: item["created_at"] or "", reverse=True)
    challenge_records = challenge_records[:50]
    performance_history = (
        db.query(AlarmPerformance)
        .filter(AlarmPerformance.user_id == target_user_id)
        .order_by(AlarmPerformance.completed_at.desc(), AlarmPerformance.id.desc())
        .limit(100)
        .all()
    )
    return {
        "user": {
            "id": target.id,
            "name": target.name,
            "email": target.email,
            "role": target.role,
            "preferred_wake_time": target.preferred_wake_time,
            "sleep_duration_target_hours": target.sleep_duration,
            "timezone": target.timezone,
            "productivity_goal": target.productivity_goal,
            "difficulty_preference": target.difficulty_preference,
            "created_at": target.created_at.isoformat() if target.created_at else None,
        },
        "metrics": dashboard,
        "login_summary": {
            "successful_logins": db.query(LoginEvent.id)
            .filter(LoginEvent.user_id == target_user_id)
            .count(),
            "last_login_at": login_history[0].logged_at.isoformat() if login_history else None,
            "recent_logins": [
                {"id": item.id, "logged_at": item.logged_at.isoformat()}
                for item in login_history
            ],
        },
        "assigned_coaches": [
            {"id": coach_id, "name": name, "email": email}
            for coach_id, name, email in assigned_coaches
        ],
        "coach_coverage": coach_coverage,
        "alarms": [
            {
                "id": alarm.id,
                "title": alarm.title,
                "alarm_time": alarm.alarm_time,
                "is_active": alarm.is_active,
                "difficulty": alarm.difficulty,
                "challenge_type": alarm.challenge_type,
                "completed_count": alarm.completed_count,
                "snooze_count": alarm.snooze_count,
                "created_at": alarm.created_at.isoformat() if alarm.created_at else None,
            }
            for alarm in alarm_details
        ],
        "challenge_history": challenge_records,
        "performance_history": [
            {
                "id": item.id,
                "alarm_id": item.alarm_id,
                "alarm_title": item.alarm_title,
                "session_id": item.session_id,
                "challenge_type": item.challenge_type,
                "difficulty": item.difficulty,
                "total_questions": item.total_questions,
                "correct_answers": item.correct_answers,
                "accuracy_pct": item.accuracy_pct,
                "average_response_time_seconds": item.average_response_time_seconds,
                "snoozes_before_completion": item.snoozes_before_completion,
                "challenge_completed": item.challenge_completed,
                "completed_at": item.completed_at.isoformat() if item.completed_at else None,
                "recommendation_title": item.recommendation_title,
                "recommendation_reason": item.recommendation_reason,
                "suggested_action": item.suggested_action,
                "recommendation_priority": item.recommendation_priority,
            }
            for item in performance_history
        ],
        "recent_activities": [
            {"id": item.id, "activity_type": item.activity_type, "created_at": item.created_at.isoformat() if item.created_at else None}
            for item in activity
        ],
    }


@router.get("/recommendations")
def list_recommendations(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    admin_user=Depends(require_roles("admin")),
):
    lower, upper, _, _ = _period_bounds(start_date, end_date)
    recommendations = (
        db.query(Recommendation)
        .filter(Recommendation.created_at >= lower, Recommendation.created_at < upper)
        .order_by(Recommendation.created_at.desc())
        .limit(100)
        .all()
    )
    users_by_id = {
        user.id: user
        for user in db.query(User)
        .filter(User.id.in_({item.user_id for item in recommendations}))
        .all()
    } if recommendations else {}
    return [
        {
            "id": item.id,
            "user_id": item.user_id,
            "user_name": users_by_id[item.user_id].name if item.user_id in users_by_id else "Deleted user",
            "title": item.title,
            "reason": item.reason,
            "suggested_action": item.suggested_action,
            "category": item.category,
            "priority": item.priority,
            "is_acted_upon": item.is_acted_upon,
            "is_dismissed": item.is_dismissed,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in recommendations
    ]


@router.put("/users/{target_user_id}/role")
def update_user_role(
    target_user_id: int,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    admin_user=Depends(require_roles("admin")),
):
    """
    Update a user's role (user, wellness_coach, admin).
    """
    new_role = payload.role.strip().lower()
    if new_role not in {"user", "wellness_coach", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be one of: 'user', 'wellness_coach', 'admin'"
        )

    target = db.query(User).filter(User.id == target_user_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if target.id == admin_user.id and new_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot demote yourself from admin role"
        )

    target.role = new_role
    db.query(CoachAssignment).filter(
        (CoachAssignment.user_id == target_user_id)
        | (CoachAssignment.coach_id == target_user_id)
    ).delete(synchronize_session=False)
    db.flush()
    assignments_created = assign_unassigned_users(db, assigned_by_id=admin_user.id)
    db.commit()
    db.refresh(target)
    return {
        "message": f"Role updated to '{new_role}' for user {target.email}",
        "user_id": target.id,
        "role": target.role,
        "new_clients_assigned": assignments_created,
    }


@router.delete("/users/{target_user_id}")
def delete_user(
    target_user_id: int,
    db: Session = Depends(get_db),
    admin_user=Depends(require_roles("admin")),
):
    """
    Delete a user and associated data.
    """
    if target_user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own admin account"
        )

    target = db.query(User).filter(User.id == target_user_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    was_coach = target.role == "wellness_coach"
    # Clean up foreign key references
    db.query(AlarmPerformance).filter(
        AlarmPerformance.user_id == target_user_id
    ).delete(synchronize_session=False)
    db.query(Alarm).filter(Alarm.user_id == target_user_id).delete()
    db.query(ChallengeAttempt).filter(ChallengeAttempt.user_id == target_user_id).delete()
    db.query(Challenge).filter(Challenge.user_id == target_user_id).delete()
    db.query(Activity).filter(Activity.user_id == target_user_id).delete()
    db.query(Recommendation).filter(Recommendation.user_id == target_user_id).delete()
    db.query(Notification).filter(Notification.user_id == target_user_id).delete()
    db.query(LoginEvent).filter(LoginEvent.user_id == target_user_id).delete()
    db.query(CoachAssignment).filter(
        (CoachAssignment.user_id == target_user_id)
        | (CoachAssignment.coach_id == target_user_id)
    ).delete(synchronize_session=False)
    db.delete(target)
    db.flush()
    assignments_created = (
        assign_unassigned_users(db, assigned_by_id=admin_user.id)
        if was_coach else 0
    )
    db.commit()

    return {
        "message": f"User {target_user_id} deleted successfully",
        "clients_reassigned": assignments_created,
    }


@router.post("/coaches/assign-unassigned")
def assign_unassigned_clients(
    db: Session = Depends(get_db),
    admin_user=Depends(require_roles("admin")),
):
    assigned_count = assign_unassigned_users(db, assigned_by_id=admin_user.id)
    db.commit()
    return {"assigned_count": assigned_count}


@router.put("/coaches/{coach_id}/clients/{client_id}")
def assign_client_to_coach(
    coach_id: int,
    client_id: int,
    db: Session = Depends(get_db),
    admin_user=Depends(require_roles("admin")),
):
    coach = db.query(User).filter(User.id == coach_id, User.role == "wellness_coach").first()
    client = db.query(User).filter(User.id == client_id, User.role == "user").first()
    if coach is None or client is None:
        raise HTTPException(status_code=404, detail="Coach or user account not found")
    assignment = db.query(CoachAssignment).filter(
        CoachAssignment.coach_id == coach_id,
        CoachAssignment.user_id == client_id,
    ).first()
    if assignment is None:
        db.add(CoachAssignment(
            coach_id=coach_id,
            user_id=client_id,
            assigned_by_id=admin_user.id,
        ))
        db.commit()
    return {"coach_id": coach_id, "client_id": client_id, "assigned": True}


@router.delete("/coaches/{coach_id}/clients/{client_id}")
def unassign_client_from_coach(
    coach_id: int,
    client_id: int,
    db: Session = Depends(get_db),
    admin_user=Depends(require_roles("admin")),
):
    assignment = db.query(CoachAssignment).filter(
        CoachAssignment.coach_id == coach_id,
        CoachAssignment.user_id == client_id,
    ).first()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Coach assignment not found")
    other_assignments = db.query(CoachAssignment.id).join(
        User, User.id == CoachAssignment.coach_id
    ).filter(
        CoachAssignment.user_id == client_id,
        CoachAssignment.id != assignment.id,
        User.role == "wellness_coach",
    ).count()
    if not other_assignments and db.query(User.id).filter(
        User.role == "wellness_coach",
    ).first():
        raise HTTPException(
            status_code=409,
            detail="Assign another coach before removing the user's only coach.",
        )
    db.delete(assignment)
    db.commit()
    return {"coach_id": coach_id, "client_id": client_id, "assigned": False}


@router.get("/coaches/{coach_id}/clients")
def list_coach_assignments(
    coach_id: int,
    db: Session = Depends(get_db),
    admin_user=Depends(require_roles("admin")),
):
    return [
        {"coach_id": assignment.coach_id, "client_id": assignment.user_id}
        for assignment in db.query(CoachAssignment)
        .filter(CoachAssignment.coach_id == coach_id)
        .order_by(CoachAssignment.created_at.desc())
        .all()
    ]


@router.get("/reports/{report_format}")
def export_platform_report(
    report_format: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    admin_user=Depends(require_roles("admin")),
):
    if report_format not in {"pdf", "excel"}:
        raise HTTPException(status_code=404, detail="Supported report formats are pdf and excel")
    metrics = get_platform_analytics(
        start_date=start_date,
        end_date=end_date,
        db=db,
        admin_user=admin_user,
    )
    if report_format == "pdf":
        return StreamingResponse(
            build_platform_pdf(metrics),
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="platform-analytics.pdf"'},
        )
    return StreamingResponse(
        build_platform_excel(metrics),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="platform-analytics.xlsx"'},
    )
