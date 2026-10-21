from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.activity import Activity
from ..models.alarm import Alarm
from ..models.challenge import Challenge
from ..models.challenge_attempt import ChallengeAttempt
from ..models.coach_assignment import CoachAssignment
from ..models.notification import Notification
from ..models.recommendation import Recommendation
from ..models.user import User
from ..models.alarm_performance import AlarmPerformance
from ..services.analytics_service import (
    generate_recommendations,
    get_behavioral_analytics,
    get_dashboard,
)
from ..utils.deps import require_roles


router = APIRouter(
    prefix="/api/coach",
    tags=["Wellness Coach"],
    dependencies=[Depends(require_roles("wellness_coach", "admin"))],
)


class CoachRecommendationCreate(BaseModel):
    title: str = Field(default="", max_length=200)
    reason: str = Field(default="", max_length=1000)
    suggested_action: str = Field(min_length=1, max_length=500)
    category: str = Field(default="coach_guidance", max_length=50)
    priority: str = Field(default="medium", pattern="^(high|medium|low)$")


def _accessible_users(db: Session, coach: User):
    query = db.query(User).filter(User.role == "user")
    if coach.role == "admin":
        return query.order_by(User.name.asc()).all()
    assigned_ids = db.query(CoachAssignment.user_id).filter(
        CoachAssignment.coach_id == coach.id
    )
    return query.filter(User.id.in_(assigned_ids)).order_by(User.name.asc()).all()


def _require_accessible_client(db: Session, coach: User, client_id: int):
    query = db.query(User).filter(User.id == client_id, User.role == "user")
    if coach.role != "admin":
        query = query.join(
            CoachAssignment,
            CoachAssignment.user_id == User.id,
        ).filter(CoachAssignment.coach_id == coach.id)
    client = query.first()
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


def _client_summary(db: Session, client: User):
    dashboard = get_dashboard(db, client)
    behavior = get_behavioral_analytics(db, client)
    recent_snoozes = behavior["snooze_7d"]
    attention_reasons = []
    if recent_snoozes >= 3:
        attention_reasons.append(f"{recent_snoozes} snooze events in the last 7 days")
    if dashboard["alarm_completions"] and dashboard["wake_consistency_pct"] < 40:
        attention_reasons.append("Wake completions on fewer than 3 of the last 7 days")
    if dashboard["answered_questions"] >= 3 and dashboard["challenge_accuracy"] is not None:
        if dashboard["challenge_accuracy"] < 50:
            attention_reasons.append("Challenge accuracy below 50% with at least 3 recorded answers")
    return {
        "id": client.id,
        "name": client.name,
        "email": client.email,
        "preferred_wake_time": client.preferred_wake_time,
        "sleep_duration_target_hours": client.sleep_duration,
        "difficulty_preference": client.difficulty_preference or "medium",
        "habit_score": dashboard["habit_score"],
        "wake_consistency_pct": dashboard["wake_consistency_pct"],
        "challenge_accuracy": dashboard["challenge_accuracy"],
        "answered_questions": dashboard["answered_questions"],
        "snooze_count_7d": recent_snoozes,
        "average_response_time_seconds": dashboard["average_challenge_time"],
        "current_difficulty": dashboard["current_difficulty"],
        "attention_reasons": attention_reasons,
        "created_at": client.created_at.isoformat() if client.created_at else None,
    }


@router.get("/overview")
def coach_overview(
    db: Session = Depends(get_db),
    coach=Depends(require_roles("wellness_coach", "admin")),
):
    clients = _accessible_users(db, coach)
    summaries = [_client_summary(db, client) for client in clients]
    scored = [item["habit_score"] for item in summaries if item["habit_score"] is not None]
    consistency = [item["wake_consistency_pct"] for item in summaries if item["wake_consistency_pct"] is not None]
    lower_bound = datetime.utcnow() - timedelta(days=30)
    client_ids = [client.id for client in clients]
    activities = (
        db.query(Activity)
        .filter(Activity.user_id.in_(client_ids), Activity.created_at >= lower_bound)
        .order_by(Activity.created_at.asc())
        .all()
    ) if client_ids else []
    trend = defaultdict(lambda: {"date": None, "completions": 0, "snoozes": 0, "events": 0})
    for activity in activities:
        if activity.created_at:
            key = activity.created_at.date().isoformat()
            row = trend[key]
            row["date"] = key
            row["events"] += 1
            if activity.activity_type == "complete":
                row["completions"] += 1
            elif activity.activity_type == "snooze":
                row["snoozes"] += 1

    return {
        "accessible_users": len(clients),
        "users_needing_attention": sum(bool(item["attention_reasons"]) for item in summaries),
        "average_habit_score": round(sum(scored) / len(scored), 1) if scored else None,
        "average_wake_consistency_pct": round(sum(consistency) / len(consistency), 1) if consistency else None,
        "average_challenge_accuracy": round(
            sum(item["challenge_accuracy"] for item in summaries if item["challenge_accuracy"] is not None)
            / sum(item["challenge_accuracy"] is not None for item in summaries),
            1,
        ) if any(item["challenge_accuracy"] is not None for item in summaries) else None,
        "snooze_events_30d": sum(1 for item in activities if item.activity_type == "snooze"),
        "activity_trend_30d": [trend[key] for key in sorted(trend)],
        "clients": summaries,
        "sleep_measurement_note": "Sleep duration is a user-configured target; the application does not measure actual sleep.",
        "attention_rule_note": "Attention flags are based on 7-day snoozes (3+), low wake consistency with recorded completions, or challenge accuracy below 50% after at least 3 answers.",
        "habit_history_note": "Historical daily habit-score snapshots are not stored; only current score and the existing behavioral trend are available.",
    }


@router.get("/clients")
def list_clients(
    db: Session = Depends(get_db),
    coach=Depends(require_roles("wellness_coach", "admin")),
):
    return [_client_summary(db, client) for client in _accessible_users(db, coach)]


@router.get("/clients/{client_id}/behavior")
def get_client_behavior(
    client_id: int,
    db: Session = Depends(get_db),
    coach=Depends(require_roles("wellness_coach", "admin")),
):
    client = _require_accessible_client(db, coach, client_id)
    dashboard = get_dashboard(db, client)
    behavior = get_behavioral_analytics(db, client)
    generate_recommendations(db, client, dashboard_data=dashboard, analytics=behavior)
    client_alarms = (
        db.query(Alarm)
        .filter(Alarm.user_id == client.id)
        .order_by(Alarm.created_at.desc())
        .all()
    )
    client_recs = (
        db.query(Recommendation)
        .filter(Recommendation.user_id == client.id)
        .order_by(Recommendation.created_at.desc())
        .all()
    )
    recent_activities = (
        db.query(Activity)
        .filter(Activity.user_id == client.id)
        .order_by(Activity.created_at.desc())
        .limit(30)
        .all()
    )
    recent_attempts = (
        db.query(ChallengeAttempt)
        .filter(ChallengeAttempt.user_id == client.id)
        .order_by(ChallengeAttempt.created_at.desc())
        .limit(30)
        .all()
    )
    attempt_challenge_ids = [item.challenge_id for item in recent_attempts]
    legacy_filter = [
        Challenge.user_id == client.id,
        (Challenge.is_correct.isnot(None))
        | (Challenge.user_answer.isnot(None)),
    ]
    if attempt_challenge_ids:
        legacy_filter.append(~Challenge.id.in_(attempt_challenge_ids))
    answered_challenges = (
        db.query(Challenge)
        .filter(*legacy_filter)
        .order_by(Challenge.created_at.desc())
        .limit(30)
        .all()
    )
    challenge_history = [
        {
            "id": item.id,
            "source": "attempt",
            "challenge_type": item.challenge_type,
            "difficulty": item.difficulty,
            "is_correct": item.is_correct,
            "is_completed": item.is_completed,
            "response_time_seconds": item.response_time,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in recent_attempts
    ]
    challenge_history.extend(
        {
            "id": item.id,
            "source": "challenge",
            "challenge_type": item.challenge_type,
            "difficulty": item.difficulty,
            "is_correct": item.is_correct,
            "is_completed": item.is_completed,
            "response_time_seconds": item.response_time,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in answered_challenges
    )
    challenge_history.sort(
        key=lambda item: item["created_at"] or "",
        reverse=True,
    )
    challenge_history = challenge_history[:30]
    performance_history = (
        db.query(AlarmPerformance)
        .filter(AlarmPerformance.user_id == client.id)
        .order_by(AlarmPerformance.completed_at.desc(), AlarmPerformance.id.desc())
        .limit(50)
        .all()
    )
    return {
        "client": {
            "id": client.id,
            "name": client.name,
            "email": client.email,
            "preferred_wake_time": client.preferred_wake_time,
            "sleep_duration_target_hours": client.sleep_duration,
            "difficulty_preference": client.difficulty_preference,
        },
        "dashboard": dashboard,
        "behavior": behavior,
        "alarms": [
            {
                "id": alarm.id,
                "title": alarm.title,
                "alarm_time": alarm.alarm_time,
                "alarm_type": alarm.alarm_type,
                "difficulty": alarm.difficulty,
                "challenge_type": alarm.challenge_type,
                "is_active": alarm.is_active,
                "snooze_count": alarm.snooze_count,
                "completed_count": alarm.completed_count,
            }
            for alarm in client_alarms
        ],
        "recent_activities": [
            {
                "id": item.id,
                "activity_type": item.activity_type,
                "alarm_id": item.alarm_id,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in recent_activities
        ],
        "challenge_history": challenge_history,
        "performance_history": [
            {
                "id": item.id,
                "alarm_title": item.alarm_title,
                "challenge_type": item.challenge_type,
                "difficulty": item.difficulty,
                "total_questions": item.total_questions,
                "correct_answers": item.correct_answers,
                "accuracy_pct": item.accuracy_pct,
                "average_response_time_seconds": item.average_response_time_seconds,
                "snoozes_before_completion": item.snoozes_before_completion,
                "completed_at": item.completed_at.isoformat() if item.completed_at else None,
                "recommendation_title": item.recommendation_title,
                "recommendation_reason": item.recommendation_reason,
                "suggested_action": item.suggested_action,
                "recommendation_priority": item.recommendation_priority,
            }
            for item in performance_history
        ],
        "recommendations": [
            {
                "id": item.id,
                "title": item.title,
                "reason": item.reason,
                "suggested_action": item.suggested_action,
                "supporting_metric": item.supporting_metric,
                "category": item.category,
                "priority": item.priority,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in client_recs
        ],
        "habit_history_note": "Historical daily habit-score snapshots are not stored. The behavioral service reports the current score and its measurable recent trend.",
        "sleep_measurement_note": "Sleep duration shown in the profile is a target, not a measured sleep duration.",
    }


@router.post("/clients/{client_id}/recommendation")
def send_coach_recommendation(
    client_id: int,
    payload: CoachRecommendationCreate,
    db: Session = Depends(get_db),
    coach=Depends(require_roles("wellness_coach", "admin")),
):
    client = _require_accessible_client(db, coach, client_id)
    title = payload.title.strip() or f"Coach Guidance from {coach.name}"
    reason = payload.reason.strip() or "Your coach reviewed your recorded alarm and challenge progress."
    suggested_action = payload.suggested_action.strip()
    if not suggested_action:
        raise HTTPException(status_code=400, detail="suggested_action is required")

    recommendation = Recommendation(
        user_id=client.id,
        title=title,
        reason=reason,
        suggested_action=suggested_action,
        category=payload.category,
        priority=payload.priority,
    )
    notification = Notification(
        user_id=client.id,
        title=f"New Coach Recommendation: {title}",
        message=suggested_action[:300],
        notification_type="platform_announcement",
    )
    db.add_all([recommendation, notification])
    db.commit()
    db.refresh(recommendation)
    return {
        "message": f"Recommendation successfully sent to {client.name}",
        "recommendation_id": recommendation.id,
    }
