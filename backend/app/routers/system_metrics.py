"""
backend/app/routers/system_metrics.py

Implements Section 8 (Performance Metrics) and Section 9 (Quantitative Goals)
of the Official Intelligent Cognitive Alarm Platform Specification:
1. Alarm Performance Metrics
2. Cognitive Challenge Metrics
3. Habit Formation Metrics
4. Recommendation Metrics
5. System Performance Metrics
6. Quantitative Goals Progress
"""

import time
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.alarm import Alarm
from ..models.challenge import Challenge
from ..models.activity import Activity
from ..models.recommendation import Recommendation
from ..utils.deps import get_current_user
from ..services.analytics_service import get_dashboard, get_behavioral_analytics


router = APIRouter(
    prefix="/api/system",
    tags=["System & Performance Metrics"],
)


@router.get("/performance-metrics")
def get_performance_metrics(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Returns the comprehensive 5-pillar Performance Metrics (Section 8)
    and Quantitative Goals evaluation (Section 9).
    """
    # ── 1. Measure live query and challenge-generation latency ──
    t0 = time.perf_counter()
    _ = db.query(Alarm).filter(Alarm.user_id == user.id).count()
    db_ping_ms = round((time.perf_counter() - t0) * 1000.0, 2)

    t1 = time.perf_counter()
    from ..ai.challenge_engine import generate_questions
    _ = generate_questions("math", "medium", 3)
    gen_latency_ms = round((time.perf_counter() - t1) * 1000.0, 2)

    dashboard = get_dashboard(db, user)
    behavior = get_behavioral_analytics(db, user)
    activities = db.query(Activity).filter(Activity.user_id == user.id).all()
    total_completions = sum(1 for item in activities if item.activity_type == "complete")
    total_snoozes = sum(1 for item in activities if item.activity_type == "snooze")
    total_triggers = sum(1 for item in activities if item.activity_type == "trigger")
    dismissal_denominator = total_completions + total_triggers
    dismissal_success_rate = (
        round(total_completions / dismissal_denominator * 100, 1)
        if dismissal_denominator
        else None
    )

    # ── 3. Cognitive Challenge Metrics ──
    challenges = db.query(Challenge).filter(Challenge.user_id == user.id).all()
    answered_challenges = [item for item in challenges if item.is_correct is not None]
    correct_attempts = sum(1 for item in answered_challenges if item.is_correct)
    challenge_acc = (
        round(correct_attempts / len(answered_challenges) * 100, 1)
        if answered_challenges
        else None
    )
    challenge_sessions = {item.session_id for item in challenges}
    completed_sessions = dashboard["successful_challenges"]
    challenge_comp_rate = (
        round(completed_sessions / len(challenge_sessions) * 100, 1)
        if challenge_sessions
        else None
    )

    # ── 4. Habit Formation Metrics ──
    wake_consistency_rate = dashboard["wake_up_consistency"] if activities else None
    snooze_reduction_rate = dashboard["snooze_reduction"]
    sleep_adherence_rate = dashboard["sleep_adherence"] if total_completions else None

    # ── 5. Recommendation Metrics ──
    recommendations = (
        db.query(Recommendation)
        .filter(Recommendation.user_id == user.id)
        .all()
    )
    rec_action_rate = (
        round(
            sum(1 for item in recommendations if item.is_acted_upon)
            / len(recommendations)
            * 100,
            1,
        )
        if recommendations
        else None
    )
    difficulty_changes = sum(1 for item in activities if item.activity_type == "difficulty_change")
    average_response_time = (
        round(sum(item.response_time or 0 for item in answered_challenges) / len(answered_challenges), 1)
        if answered_challenges
        else None
    )

    def percent(value):
        return f"{value}%" if value is not None else "Not enough data"

    # ── Construct Section 8 Structure ──
    metrics = {
        "timestamp": datetime.utcnow().isoformat(),
        "alarm_performance": {
            "alarm_dismissal_success_rate": percent(dismissal_success_rate),
            "wake_up_verification_accuracy": percent(challenge_acc),
            "snooze_reduction_rate": percent(snooze_reduction_rate),
            "status": "Optimal" if dismissal_success_rate is not None and dismissal_success_rate >= 70 else "Calibrating",
        },
        "cognitive_challenge": {
            "challenge_completion_rate": percent(challenge_comp_rate),
            "challenge_accuracy": percent(challenge_acc),
            "difficulty_adaptation_effectiveness": None,
            "difficulty_changes_observed": difficulty_changes,
            "average_response_time_seconds": average_response_time,
            "supported_categories": 7,
            "supported_difficulties": 5,
        },
        "habit_formation": {
            "habit_score": dashboard["habit_score"],
            "habit_score_improvement": behavior["habit_score_trend"],
            "wake_up_consistency_rate": percent(wake_consistency_rate),
            "sleep_schedule_adherence": percent(sleep_adherence_rate),
            "model_weights": "35% Wake / 25% Challenge / 20% Snooze / 20% Sleep",
        },
        "recommendation": {
            "recommendation_action_rate": percent(rec_action_rate),
            "user_engagement_improvement": None,
            "productivity_improvement_rate": None,
            "unavailable_metrics_reason": "No productivity or engagement outcome data is collected yet.",
            "categories": ["sleep", "wake_up", "habit", "productivity", "challenge"],
        },
        "system_performance": {
            "api_response_time": None,
            "database_query_latency_ms": db_ping_ms,
            "dashboard_loading_speed": None,
            "challenge_generation_latency": f"{gen_latency_ms} ms",
            "concurrent_user_handling_capacity": None,
            "database_engine": db.get_bind().dialect.name,
            "secondary_store": "MongoDB with JSONL fallback",
            "ai_engine": "XGBoost 3.2.0 + Q-Learning RL Agent",
            "unavailable_metrics_reason": "API latency, dashboard speed, and concurrency require external load testing.",
        },
        "quantitative_goals_progress": [
            {
                "domain": "Wake-Up Improvement",
                "goal": "Reduce snooze frequency and improve successful wake-up rates",
                "progress_percent": dismissal_success_rate,
                "target": ">=85%",
            },
            {
                "domain": "Cognitive Engagement",
                "goal": "Increase challenge completion and cognitive engagement during wake-up routines",
                "progress_percent": challenge_acc,
                "target": ">=80%",
            },
            {
                "domain": "Habit Formation",
                "goal": "Improve wake-up consistency and long-term habit adherence",
                "progress_percent": wake_consistency_rate,
                "target": ">=75%",
            },
            {
                "domain": "Productivity Enhancement",
                "goal": "Encourage productive daily routines through intelligent alarm interactions",
                "progress_percent": None,
                "target": ">=80%",
            },
            {
                "domain": "Platform Performance",
                "goal": "Support large-scale alarm scheduling and behavioral analytics workflows",
                "progress_percent": None,
                "target": "<50ms API Latency",
            },
        ],
    }

    return metrics
