import csv
import io
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_
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
from app.schemas.admin import (
    AdminAnalyticsResponse,
    AdminMLMonitoringResponse,
    AdminSessionItem,
    AdminSessionsResponse,
    AdminStatsResponse,
    AdminSystemReportSummary,
    AdminUserDetail,
    AdminUsersResponse,
    AdminUserSummary,
)
from app.schemas.alarm import AlarmUpdate
from app.services.habit_scorer import calculate_habit_score, compute_behavioral_metrics
from app.services.ml_prediction_service import get_model_pipeline_and_metadata
from app.utils.dependencies import require_admin

router = APIRouter(
    prefix="/api/admin",
    tags=["Admin"],
)


# =====================================================
# 1. ADMIN STATISTICS & KPIS
# =====================================================

@router.get("/stats", response_model=AdminStatsResponse)
def get_admin_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    total_users = db.query(User).count()

    total_admins = (
        db.query(User)
        .filter(User.role == "admin")
        .count()
    )

    total_regular_users = (
        db.query(User)
        .filter(User.role == "user")
        .count()
    )

    total_coaches = (
        db.query(User)
        .filter(User.role == "wellness_coach")
        .count()
    )

    total_alarms = db.query(Alarm).count()

    active_alarms = (
        db.query(Alarm)
        .filter(Alarm.is_active.is_(True))
        .count()
    )

    total_sessions = db.query(AlarmSession).count()

    completed_sessions = (
        db.query(AlarmSession)
        .filter(AlarmSession.session_status == "completed")
        .count()
    )

    return {
        "total_users": total_users,
        "total_admins": total_admins,
        "total_coaches": total_coaches,
        "total_regular_users": total_regular_users,
        "total_alarms": total_alarms,
        "active_alarms": active_alarms,
        "total_sessions": total_sessions,
        "completed_sessions": completed_sessions,
    }


# =====================================================
# 2. ADMIN HEALTH TEST
# =====================================================

@router.get("/test")
def admin_test(
    current_user: User = Depends(require_admin),
):
    return {
        "message": "Admin access granted",
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role,
        },
    }


# =====================================================
# 3. USER MANAGEMENT
# =====================================================

@router.get("/users", response_model=AdminUsersResponse)
def get_all_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = (
        db.query(User)
        .order_by(User.id)
        .all()
    )

    return {
        "users": [
            {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role,
                "created_at": user.created_at,
            }
            for user in users
        ]
    }


@router.get("/users/{user_id}", response_model=AdminUserDetail)
def get_admin_user_detail(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    alarms_count = db.query(Alarm).filter(Alarm.user_id == user_id).count()

    sessions_count = (
        db.query(AlarmSession)
        .join(Alarm, Alarm.id == AlarmSession.alarm_id)
        .filter(Alarm.user_id == user_id)
        .count()
    )

    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    habit = db.query(Habit).filter(Habit.user_id == user_id).first()

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "created_at": user.created_at,
        "total_alarms": alarms_count,
        "total_sessions": sessions_count,
        "preferred_wake_time": str(profile.preferred_wake_time) if profile and profile.preferred_wake_time else None,
        "sleep_duration": profile.sleep_duration if profile else None,
        "time_zone": profile.time_zone if profile else None,
        "difficulty_preference": profile.difficulty_preference if profile else "medium",
        "wake_up_goal": habit.wake_up_goal if habit else None,
        "productivity_goals": habit.productivity_goals if habit else None,
    }


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    role: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    # Prevent changing own role
    if user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot change your own role",
        )

    # Validate role
    if role not in ["user", "wellness_coach", "admin"]:
        raise HTTPException(
            status_code=400,
            detail="Role must be user, wellness_coach, or admin",
        )

    user.role = role

    db.commit()
    db.refresh(user)

    return {
        "message": "User role updated successfully",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
    }


@router.delete("/users/{user_id}")
def delete_admin_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    # Prevent deleting current admin
    if user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own admin account",
        )

    try:
        alarms = (
            db.query(Alarm)
            .filter(Alarm.user_id == user_id)
            .all()
        )

        for alarm in alarms:
            db.query(AlarmSession).filter(
                AlarmSession.alarm_id == alarm.id
            ).delete(synchronize_session=False)

            db.query(CognitiveChallenge).filter(
                CognitiveChallenge.alarm_id == alarm.id
            ).delete(synchronize_session=False)

        db.query(Alarm).filter(
            Alarm.user_id == user_id
        ).delete(synchronize_session=False)

        db.query(UserProfile).filter(
            UserProfile.user_id == user_id
        ).delete(synchronize_session=False)

        db.query(Habit).filter(
            Habit.user_id == user_id
        ).delete(synchronize_session=False)

        db.delete(user)
        db.commit()

        return {
            "message": "User deleted successfully",
            "user_id": user_id,
        }

    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete user: {str(error)}",
        )


# =====================================================
# 4. ALARM MANAGEMENT
# =====================================================

@router.get("/alarms")
def get_all_alarms(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    alarms = (
        db.query(Alarm)
        .order_by(Alarm.id)
        .all()
    )

    return {
        "alarms": [
            {
                "id": alarm.id,
                "user_id": alarm.user_id,
                "name": alarm.name,
                "alarm_time": alarm.alarm_time,
                "alarm_type": alarm.alarm_type,
                "repeat_pattern": alarm.repeat_pattern,
                "is_active": alarm.is_active,
            }
            for alarm in alarms
        ]
    }


@router.patch("/alarms/{alarm_id}/toggle")
def toggle_admin_alarm(
    alarm_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    alarm = (
        db.query(Alarm)
        .filter(Alarm.id == alarm_id)
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found",
        )

    alarm.is_active = not alarm.is_active
    db.commit()
    db.refresh(alarm)

    return {
        "message": "Alarm status updated successfully",
        "alarm": {
            "id": alarm.id,
            "is_active": alarm.is_active,
        },
    }


@router.put("/alarms/{alarm_id}")
def update_admin_alarm(
    alarm_id: int,
    data: AlarmUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    alarm = (
        db.query(Alarm)
        .filter(Alarm.id == alarm_id)
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found",
        )

    alarm.name = data.name
    alarm.alarm_time = data.alarm_time
    alarm.alarm_type = data.alarm_type
    alarm.repeat_pattern = data.repeat_pattern
    alarm.is_active = data.is_active

    db.commit()
    db.refresh(alarm)

    return {
        "message": "Alarm updated successfully",
        "alarm": {
            "id": alarm.id,
            "user_id": alarm.user_id,
            "name": alarm.name,
            "alarm_time": alarm.alarm_time,
            "alarm_type": alarm.alarm_type,
            "repeat_pattern": alarm.repeat_pattern,
            "is_active": alarm.is_active,
        },
    }


@router.delete("/alarms/{alarm_id}")
def delete_admin_alarm(
    alarm_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    alarm = (
        db.query(Alarm)
        .filter(Alarm.id == alarm_id)
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found",
        )

    try:
        db.query(AlarmSession).filter(
            AlarmSession.alarm_id == alarm_id
        ).delete(synchronize_session=False)

        db.query(CognitiveChallenge).filter(
            CognitiveChallenge.alarm_id == alarm_id
        ).delete(synchronize_session=False)

        db.delete(alarm)
        db.commit()

        return {
            "message": "Alarm deleted successfully",
            "alarm_id": alarm_id,
        }

    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete alarm: {str(error)}",
        )


# =====================================================
# 5. SESSION MONITORING
# =====================================================

@router.get("/sessions", response_model=AdminSessionsResponse)
def get_admin_sessions(
    status: Optional[str] = Query(None, description="Filter by session status"),
    search: Optional[str] = Query(None, description="Search by user name, email, or alarm name"),
    limit: int = Query(100, ge=1, le=500, description="Max sessions to return"),
    skip: int = Query(0, ge=0, description="Sessions to skip"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Returns platform session audit stream for administrators.
    Never exposes sensitive raw challenge correct answers.
    Supports optional status filtering and user/alarm keyword searching.
    """
    query = (
        db.query(
            AlarmSession,
            User,
            Alarm,
            CognitiveChallenge,
        )
        .join(
            Alarm,
            AlarmSession.alarm_id == Alarm.id,
        )
        .join(
            User,
            Alarm.user_id == User.id,
        )
        .outerjoin(
            CognitiveChallenge,
            AlarmSession.challenge_id == CognitiveChallenge.id,
        )
    )

    if status:
        query = query.filter(AlarmSession.session_status == status)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                User.name.ilike(search_filter),
                User.email.ilike(search_filter),
                Alarm.name.ilike(search_filter),
            )
        )

    total = query.count()

    sessions = (
        query
        .order_by(AlarmSession.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    result = []
    for session, user, alarm, challenge in sessions:
        duration = None
        if session.started_at and session.completed_at:
            duration = (session.completed_at - session.started_at).total_seconds()

        result.append(
            {
                "id": session.id,
                "user_id": user.id,
                "user_name": user.name,
                "user_email": user.email,
                "alarm_id": alarm.id,
                "alarm_name": alarm.name,
                "challenge_id": challenge.id if challenge else None,
                "challenge_type": challenge.challenge_type if challenge else None,
                "user_answer": session.user_answer,
                "is_correct": session.is_correct,
                "session_status": session.session_status,
                "started_at": session.started_at,
                "completed_at": session.completed_at,
                "duration_seconds": duration,
            }
        )

    return {
        "sessions": result,
        "total": total,
    }


# =====================================================
# 6. PLATFORM ANALYTICS
# =====================================================

@router.get("/analytics", response_model=AdminAnalyticsResponse)
def get_admin_analytics(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    total_users = db.query(User).count()
    total_coaches = db.query(User).filter(User.role == "wellness_coach").count()
    total_alarms = db.query(Alarm).count()
    active_alarms = (
        db.query(Alarm)
        .filter(Alarm.is_active.is_(True))
        .count()
    )
    total_sessions = db.query(AlarmSession).count()
    completed_sessions = (
        db.query(AlarmSession)
        .filter(AlarmSession.session_status == "completed")
        .count()
    )
    correct_answers = (
        db.query(AlarmSession)
        .filter(AlarmSession.is_correct.is_(True))
        .count()
    )
    wrong_answers = (
        db.query(AlarmSession)
        .filter(AlarmSession.is_correct.is_(False))
        .count()
    )

    answered_sessions = correct_answers + wrong_answers
    accuracy = (
        round((correct_answers / answered_sessions) * 100, 2)
        if answered_sessions > 0
        else 0.0
    )

    completion_rate = (
        round((completed_sessions / total_sessions) * 100, 2)
        if total_sessions > 0
        else 0.0
    )

    return {
        "total_users": total_users,
        "total_coaches": total_coaches,
        "total_alarms": total_alarms,
        "active_alarms": active_alarms,
        "total_sessions": total_sessions,
        "completed_sessions": completed_sessions,
        "correct_answers": correct_answers,
        "wrong_answers": wrong_answers,
        "accuracy": accuracy,
        "completion_rate": completion_rate,
    }


# =====================================================
# 7. RECOMMENDATION & ML MONITORING
# =====================================================

@router.get("/ml-monitoring", response_model=AdminMLMonitoringResponse)
def get_admin_ml_monitoring(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Provides platform administrators with live ML model status, benchmark metrics,
    predictive feature importances, and platform-wide cognitive challenge adoption.
    """
    _, metadata = get_model_pipeline_and_metadata()

    if metadata:
        feat_imp = metadata.get("feature_importances", {})
        if isinstance(feat_imp, dict):
            top_features = [{"feature": k, "importance": v} for k, v in list(feat_imp.items())[:5]]
        elif isinstance(feat_imp, list):
            top_features = feat_imp[:5]
        else:
            top_features = []

        model_status = {
            "status": "online",
            "model_version": metadata.get("model_version", "1.0.0"),
            "algorithm": metadata.get("algorithm", "XGBoost Classifier"),
            "trained_at": metadata.get("trained_at"),
            "dataset_origin": metadata.get("dataset_origin", "synthetic_circadian_benchmark"),
            "dataset_notice": metadata.get(
                "dataset_notice",
                "Synthetic benchmark dataset — strictly separated from real user production data",
            ),
            "benchmark_metrics": metadata.get("metrics", {}),
            "top_features": top_features,
        }
    else:
        model_status = {
            "status": "offline",
            "model_version": "0.0.0",
            "algorithm": "Heuristic Fallback Engine",
            "dataset_origin": "none",
            "dataset_notice": "ML model artifact not loaded. Operating on rule-based fallbacks.",
            "benchmark_metrics": {},
            "top_features": [],
        }

    # Platform ML & Difficulty Adoption
    total_profiles = db.query(UserProfile).count()

    difficulty_rows = (
        db.query(UserProfile.difficulty_preference, func.count(UserProfile.id))
        .group_by(UserProfile.difficulty_preference)
        .all()
    )
    difficulty_preferences = {row[0] or "medium": row[1] for row in difficulty_rows}

    alarm_diff_rows = (
        db.query(Alarm.difficulty, func.count(Alarm.id))
        .group_by(Alarm.difficulty)
        .all()
    )
    alarm_difficulties = {row[0] or "medium": row[1] for row in alarm_diff_rows}

    total_evaluated_sessions = (
        db.query(AlarmSession)
        .filter(AlarmSession.session_status == "completed")
        .count()
    )

    # Average habit score across users with sessions
    users_with_sessions = (
        db.query(User)
        .join(Alarm, Alarm.user_id == User.id)
        .join(AlarmSession, AlarmSession.alarm_id == Alarm.id)
        .distinct()
        .all()
    )

    habit_scores = []
    for u in users_with_sessions:
        u_sessions = (
            db.query(AlarmSession)
            .join(Alarm, Alarm.id == AlarmSession.alarm_id)
            .filter(Alarm.user_id == u.id)
            .all()
        )
        if u_sessions:
            metrics = compute_behavioral_metrics(u_sessions)
            score_data = calculate_habit_score(
                wake_up_consistency=metrics["wake_up_consistency"],
                challenge_completion=metrics["challenge_completion"],
                snooze_reduction=metrics["snooze_reduction"],
                sleep_schedule_adherence=metrics["sleep_schedule_adherence"],
            )
            habit_scores.append(score_data["overall_habit_score"])

    avg_habit_score = (
        round(sum(habit_scores) / len(habit_scores), 1)
        if habit_scores
        else 60.0
    )

    platform_ml_adoption = {
        "total_profiles_configured": total_profiles,
        "difficulty_preferences": difficulty_preferences,
        "adaptive_difficulty_distribution": alarm_difficulties,
        "total_evaluated_sessions": total_evaluated_sessions,
        "platform_avg_habit_score": avg_habit_score,
    }

    recommendation_activity = {
        "active_categories": [
            "habit_improvement",
            "challenge_recommendation",
            "wake_up_optimization",
            "sleep_improvement",
        ],
        "engine_mode": "XGBoost Primary ML Intelligence with Rule-Based Fallback",
        "disclaimer": (
            "Model metrics reflect synthetic benchmark evaluation. "
            "Recommendation confidence indicates model inference score, not empirical accuracy."
        ),
    }

    return {
        "model_status": model_status,
        "platform_ml_adoption": platform_ml_adoption,
        "recommendation_activity": recommendation_activity,
    }


# =====================================================
# 8. SYSTEM-LEVEL REPORTS & EXPORT
# =====================================================

@router.get("/reports/summary", response_model=AdminSystemReportSummary)
def get_admin_system_report_summary(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Aggregates whole-platform summary reports for administrators.
    Never exposes individual passwords, JWT tokens, secrets, or raw challenge solutions.
    """
    total_users = db.query(User).count()
    total_admins = db.query(User).filter(User.role == "admin").count()
    total_coaches = db.query(User).filter(User.role == "wellness_coach").count()
    total_regular = db.query(User).filter(User.role == "user").count()

    total_alarms = db.query(Alarm).count()
    active_alarms = db.query(Alarm).filter(Alarm.is_active.is_(True)).count()
    inactive_alarms = total_alarms - active_alarms

    total_sessions = db.query(AlarmSession).count()
    completed_sessions = (
        db.query(AlarmSession)
        .filter(AlarmSession.session_status == "completed")
        .count()
    )
    expired_sessions = (
        db.query(AlarmSession)
        .filter(AlarmSession.session_status == "expired")
        .count()
    )
    correct_answers = (
        db.query(AlarmSession)
        .filter(AlarmSession.is_correct.is_(True))
        .count()
    )
    wrong_answers = (
        db.query(AlarmSession)
        .filter(AlarmSession.is_correct.is_(False))
        .count()
    )

    answered = correct_answers + wrong_answers
    accuracy = round((correct_answers / answered) * 100, 1) if answered > 0 else 0.0

    total_snoozes = (
        db.query(func.sum(AlarmSession.snooze_count)).scalar() or 0
    )
    avg_snooze = (
        round(total_snoozes / total_sessions, 2)
        if total_sessions > 0
        else 0.0
    )

    # Average response time
    completed_rows = (
        db.query(AlarmSession)
        .filter(
            AlarmSession.started_at.isnot(None),
            AlarmSession.completed_at.isnot(None),
        )
        .all()
    )
    durations = [
        (s.completed_at - s.started_at).total_seconds()
        for s in completed_rows
        if (s.completed_at - s.started_at).total_seconds() >= 0
    ]
    avg_response_time = (
        round(sum(durations) / len(durations), 1)
        if durations
        else 0.0
    )

    # Challenge breakdown by type
    challenge_types = ["math", "memory", "sequence", "logic"]
    challenge_breakdown = {}
    for c_type in challenge_types:
        c_count = (
            db.query(CognitiveChallenge)
            .filter(CognitiveChallenge.challenge_type == c_type)
            .count()
        )
        c_sessions = (
            db.query(AlarmSession)
            .join(CognitiveChallenge, CognitiveChallenge.id == AlarmSession.challenge_id)
            .filter(CognitiveChallenge.challenge_type == c_type)
            .count()
        )
        c_correct = (
            db.query(AlarmSession)
            .join(CognitiveChallenge, CognitiveChallenge.id == AlarmSession.challenge_id)
            .filter(
                CognitiveChallenge.challenge_type == c_type,
                AlarmSession.is_correct.is_(True),
            )
            .count()
        )
        challenge_breakdown[c_type] = {
            "total_questions": c_count,
            "sessions_played": c_sessions,
            "correct_answers": c_correct,
            "accuracy_rate": round(c_correct / c_sessions * 100, 1) if c_sessions > 0 else 0.0,
        }

    # Difficulty breakdown across alarms
    diff_levels = ["beginner", "easy", "medium", "hard", "expert"]
    difficulty_breakdown = {}
    for diff in diff_levels:
        difficulty_breakdown[diff] = (
            db.query(Alarm)
            .filter(Alarm.difficulty == diff)
            .count()
        )

    _, metadata = get_model_pipeline_and_metadata()

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "platform_overview": {
            "total_users": total_users,
            "total_regular_users": total_regular,
            "total_coaches": total_coaches,
            "total_admins": total_admins,
            "total_alarms": total_alarms,
            "active_alarms": active_alarms,
            "inactive_alarms": inactive_alarms,
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "expired_sessions": expired_sessions,
            "correct_answers": correct_answers,
            "wrong_answers": wrong_answers,
            "overall_accuracy_percent": accuracy,
            "total_snoozes": total_snoozes,
            "avg_snooze_per_session": avg_snooze,
            "avg_response_time_seconds": avg_response_time,
        },
        "challenge_breakdown": challenge_breakdown,
        "difficulty_breakdown": difficulty_breakdown,
        "ml_system_health": {
            "status": "online" if metadata else "offline",
            "algorithm": metadata.get("algorithm", "XGBoost Classifier") if metadata else "Heuristic",
            "model_version": metadata.get("model_version", "1.0.0") if metadata else "0.0.0",
            "dataset_origin": metadata.get("dataset_origin", "synthetic_circadian_benchmark") if metadata else "none",
        },
        "data_safety_certification": "Zero passwords, hashes, tokens, or raw challenge solutions exposed.",
    }


@router.get("/reports/export/csv")
def export_admin_system_report_csv(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Exports a system-level administrative summary report as CSV.
    Strictly excludes individual passwords, tokens, or sensitive answers.
    """
    summary = get_admin_system_report_summary(current_user=current_user, db=db)

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow(["INTELLIGENT COGNITIVE ALARM PLATFORM — SYSTEM ADMINISTRATIVE REPORT"])
    writer.writerow(["Generated At (UTC)", summary["generated_at"]])
    writer.writerow(["Data Safety Certification", summary["data_safety_certification"]])
    writer.writerow([])

    # Platform Overview
    writer.writerow(["--- PLATFORM OVERVIEW ---"])
    writer.writerow(["Metric", "Value"])
    for key, val in summary["platform_overview"].items():
        writer.writerow([key.replace("_", " ").title(), val])
    writer.writerow([])

    # Challenge Type Performance
    writer.writerow(["--- COGNITIVE CHALLENGE PERFORMANCE ---"])
    writer.writerow(["Challenge Type", "Questions Available", "Sessions Played", "Correct Answers", "Accuracy (%)"])
    for c_type, stats in summary["challenge_breakdown"].items():
        writer.writerow([
            c_type.title(),
            stats["total_questions"],
            stats["sessions_played"],
            stats["correct_answers"],
            f"{stats['accuracy_rate']}%",
        ])
    writer.writerow([])

    # Alarm Difficulty Distribution
    writer.writerow(["--- ALARM DIFFICULTY DISTRIBUTION ---"])
    writer.writerow(["Difficulty Level", "Alarm Count"])
    for diff, count in summary["difficulty_breakdown"].items():
        writer.writerow([diff.title(), count])
    writer.writerow([])

    # ML & Intelligence Health
    writer.writerow(["--- ML INTELLIGENCE HEALTH ---"])
    writer.writerow(["Status", summary["ml_system_health"]["status"].upper()])
    writer.writerow(["Algorithm", summary["ml_system_health"]["algorithm"]])
    writer.writerow(["Model Version", summary["ml_system_health"]["model_version"]])
    writer.writerow(["Dataset Origin", summary["ml_system_health"]["dataset_origin"]])

    csv_data = output.getvalue()
    filename = f"System_Admin_Report_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )