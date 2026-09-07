"""Dashboard routes for Intelligent Cognitive Alarm Platform.

Provides admin-level user management and platform analytics.
Also includes report generation endpoints (PDF/CSV).
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..Models import User, Alarm, Challenge, ChallengeAttempt, HabitScore, Role, UserRole
from ..schemas import AdminUserRes, AdminAnalyticsRes
from ..api.deps import get_current_user, require_roles
from ..services.report_export import export_report
from datetime import datetime, timedelta


router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Role guards
admin_only = require_roles("Administrator")
staff_only = require_roles("Administrator", "Wellness Coach")


@router.get("/users", response_model=list[AdminUserRes])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(staff_only),
):
    """List all users (Admin/Wellness Coach only)."""
    users = db.query(User).all()
    result = []
    for u in users:
        # Get user's role
        user_role = db.query(UserRole).filter(UserRole.user_id == u.id).first()
        role_name = "User"
        if user_role:
            role = db.query(Role).filter(Role.id == user_role.role_id).first()
            if role:
                role_name = role.name

        result.append(AdminUserRes(
            id=u.id,
            email=u.email,
            is_active=u.is_active,
            is_verified=u.is_verified,
            created_at=u.created_at or datetime.utcnow(),
            last_login=None,  # TODO: track last login
            role=role_name,
        ))

    return result


@router.get("/analytics", response_model=AdminAnalyticsRes)
def platform_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    """Platform-wide analytics (Admin only)."""
    total_users = db.query(User).count() or 0

    # Active users today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    active_users_today = db.query(User).filter(
        User.updated_at >= today_start,
    ).count() or 0

    # New users this week
    week_ago = datetime.utcnow() - timedelta(days=7)
    new_users_this_week = db.query(User).filter(
        User.created_at >= week_ago,
    ).count() or 0

    # Alarm dismissal success rate
    total_alarms = db.query(Alarm).count() or 1
    dismissed_alarms = db.query(Alarm).filter(~Alarm.is_enabled).count() or 0
    alarm_dismissal_rate = dismissed_alarms / total_alarms

    # Platform average habit score
    avg_habit = db.query(func.avg(HabitScore.overall_score)).scalar() or 0.0

    # Top challenge types by attempt count
    challenge_counts = db.query(
        ChallengeAttempt.challenge_id,
        func.count(ChallengeAttempt.id).label("count"),
    ).group_by(ChallengeAttempt.challenge_id).order_by(func.count(ChallengeAttempt.id).desc()).limit(5).all()

    top_challenges = []
    for cid, count in challenge_counts:
        challenge = db.query(Challenge).filter(Challenge.id == cid).first() if cid else None
        top_challenges.append({
            "challenge_type": challenge.challenge_type if challenge else "Unknown",
            "attempt_count": count,
        })

    return AdminAnalyticsRes(
        total_users=total_users,
        active_users_today=active_users_today,
        new_users_this_week=new_users_this_week,
        alarm_dismissal_success_rate=round(alarm_dismissal_rate, 4),
        platform_habit_score_avg=round(float(avg_habit), 2),
        top_challenge_types=top_challenges,
        system_uptime_percentage=99.9,  # Placeholder
    )


@router.get("/reports/habits")
def report_habits(
    days: int = Query(7, ge=1, le=365),
    format: str = Query("csv", pattern="^(csv|json|pdf|excel)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export habit scores as CSV, JSON, PDF, or Excel for the last N days."""
    today = datetime.utcnow().date()
    scores = []

    for i in range(days):
        target_date = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        habit_score = db.query(HabitScore).filter(
            HabitScore.user_id == current_user.id,
            HabitScore.date == target_date,
        ).first()

        if habit_score:
            scores.append({
                "date": habit_score.date,
                "wake_up_consistency": habit_score.wake_up_consistency,
                "challenge_completion": habit_score.challenge_completion,
                "snooze_reduction": habit_score.snooze_reduction,
                "sleep_schedule_adherence": habit_score.sleep_schedule_adherence,
                "overall_score": habit_score.overall_score,
            })

    if format == "json":
        return {"report_type": "habits", "days": days, "data": scores, "generated_at": datetime.utcnow().isoformat()}

    return export_report(scores, format, f"habit_report_{today}", "Habit Score Report")


@router.get("/reports/wake-up")
def report_wake_up(
    days: int = Query(7, ge=1, le=365),
    format: str = Query("csv", pattern="^(csv|json|pdf|excel)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export wake-up/alarm data as CSV, JSON, PDF, or Excel."""
    today = datetime.utcnow().date()
    week_ago = today - timedelta(days=days)

    alarms = db.query(Alarm).filter(
        Alarm.user_id == current_user.id,
        Alarm.created_at >= datetime.combine(week_ago, datetime.min.time()),
    ).all()

    records = []
    for a in alarms:
        records.append({
            "alarm_id": a.id,
            "title": a.title,
            "alarm_type": a.alarm_type,
            "next_trigger": a.next_trigger.isoformat() if a.next_trigger else None,
            "times_snoozed": a.times_snoozed,
            "was_enabled": a.is_enabled,
        })

    if format == "json":
        return {"report_type": "wake_up", "days": days, "data": records, "generated_at": datetime.utcnow().isoformat()}

    return export_report(records, format, f"wake_up_report_{today}", "Wake-Up Report")


@router.get("/reports/challenges")
def report_challenges(
    days: int = Query(7, ge=1, le=365),
    format: str = Query("csv", pattern="^(csv|json|pdf|excel)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export challenge attempt data as CSV, JSON, PDF, or Excel."""
    today = datetime.utcnow().date()
    week_ago = today - timedelta(days=days)

    attempts = db.query(ChallengeAttempt).filter(
        ChallengeAttempt.user_id == current_user.id,
        ChallengeAttempt.created_at >= datetime.combine(week_ago, datetime.min.time()),
    ).all()

    records = []
    for a in attempts:
        challenge = db.query(Challenge).filter(Challenge.id == a.challenge_id).first()
        records.append({
            "attempt_id": a.id,
            "challenge_type": challenge.challenge_type if challenge else "Unknown",
            "difficulty": challenge.difficulty if challenge else "Unknown",
            "completed": a.completed,
            "correct_answers": a.correct_answers,
            "total_questions": a.total_questions,
            "accuracy_pct": round((a.correct_answers / a.total_questions * 100) if a.total_questions > 0 else 0, 1),
            "time_taken_seconds": a.time_taken_seconds,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })

    if format == "json":
        return {"report_type": "challenges", "days": days, "data": records, "generated_at": datetime.utcnow().isoformat()}

    return export_report(records, format, f"challenge_report_{today}", "Challenge Report")
