"""
ml.py

FastAPI router exposing the XGBoost Machine Learning component
for Cognitive Wake-Up Readiness and Morning Alertness prediction.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..utils.deps import get_current_user
from ..services.analytics_service import get_dashboard

try:
    from ml.xgboost_model import (
        predict_wake_readiness,
        get_model_status,
        train_xgboost_model,
        FEATURE_NAMES,
    )
    # Alias for internal clarity
    get_model_metrics = get_model_status
except Exception:
    predict_wake_readiness = None
    get_model_status = lambda: {"status": "unavailable"}
    get_model_metrics = get_model_status
    train_xgboost_model = lambda n_samples=2500: {"status": "unavailable"}
    FEATURE_NAMES = []


router = APIRouter(
    prefix="/api/ml",
    tags=["Machine Learning"],
)


@router.get("/metrics")
def get_metrics():
    """
    Return production metrics of the trained XGBoost model.
    """
    if get_model_metrics is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML module is currently unavailable"
        )
    raw = dict(get_model_metrics())
    raw["metrics"] = {
        "accuracy": raw.get("accuracy"),
        "precision": raw.get("precision"),
        "recall": raw.get("recall"),
        "f1_score": raw.get("f1_score"),
        "roc_auc": raw.get("roc_auc"),
    }
    raw["feature_importance"] = raw.get("feature_importances", {})
    return raw


@router.get("/readiness")
def get_user_readiness(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    accuracy: Optional[float] = Query(None, ge=0.0, le=1.0, description="Override challenge accuracy (0.0-1.0)"),
    response_time: Optional[float] = Query(None, ge=1.0, le=120.0, description="Override response time in seconds"),
    snooze_count: Optional[float] = Query(None, ge=0.0, description="Override snooze count"),
    wake_consistency: Optional[float] = Query(None, ge=0.0, le=1.0, description="Override wake consistency (0.0-1.0)"),
    sleep_adherence: Optional[float] = Query(None, ge=0.0, le=1.0, description="Override sleep adherence (0.0-1.0)"),
    consecutive_streak: Optional[int] = Query(None, ge=0, description="Override streak in days"),
    difficulty_tier: Optional[int] = Query(None, ge=1, le=5, description="Override difficulty tier (1=beginner to 5=expert)"),
):
    """Compute readiness from complete recorded features or explicit simulation inputs."""
    if predict_wake_readiness is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="XGBoost model is not loaded"
        )

    dashboard = get_dashboard(db, user)

    # Resolve features (override if query param provided, otherwise live DB stats)
    diff_tier_map = {"beginner": 1, "easy": 2, "medium": 3, "hard": 4, "expert": 5}
    user_diff = dashboard.get("current_difficulty", "medium").lower()

    accuracy_pct = dashboard.get("challenge_accuracy")
    live_accuracy = accuracy_pct / 100.0 if accuracy_pct is not None else None
    live_rt = dashboard.get("average_challenge_time")
    live_snooze = float(dashboard["snooze_count"]) if dashboard.get("snooze_count") is not None else None
    consistency_pct = dashboard.get("wake_consistency_pct")
    live_consistency = consistency_pct / 100.0 if consistency_pct is not None and dashboard.get("alarm_completions", 0) else None
    live_sleep = None
    live_streak = dashboard.get("days_with_completion_7d")
    live_tier = diff_tier_map.get(user_diff, 3)

    final_accuracy = accuracy if accuracy is not None else live_accuracy
    final_rt = response_time if response_time is not None else live_rt
    final_snooze = snooze_count if snooze_count is not None else live_snooze
    final_consistency = wake_consistency if wake_consistency is not None else live_consistency
    final_sleep = sleep_adherence if sleep_adherence is not None else live_sleep
    final_streak = consecutive_streak if consecutive_streak is not None else live_streak
    final_tier = difficulty_tier if difficulty_tier is not None else live_tier

    missing_features = [
        name for name, value in (
            ("challenge accuracy", final_accuracy),
            ("challenge response time", final_rt),
            ("wake consistency", final_consistency),
            ("actual sleep adherence", final_sleep),
        )
        if value is None
    ]
    if any(param is not None for param in [
        accuracy, response_time, snooze_count,
        wake_consistency, sleep_adherence,
        consecutive_streak, difficulty_tier,
    ]) and missing_features:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Simulation requires values for every missing readiness feature.",
        )
    if missing_features:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "A readiness estimate cannot be calculated without recorded "
                + ", ".join(missing_features)
                + ". Actual sleep duration is not collected; supply every missing feature explicitly only for a simulation."
            ),
        )

    result = predict_wake_readiness(
        challenge_accuracy=final_accuracy,
        response_time=final_rt,
        snooze_count=final_snooze,
        wake_consistency=final_consistency,
        sleep_adherence=final_sleep,
        consecutive_streak=final_streak,
        difficulty_tier=final_tier,
    )

    result["user_id"] = user.id
    result["is_simulated"] = any(
        param is not None for param in [
            accuracy, response_time, snooze_count,
            wake_consistency, sleep_adherence,
            consecutive_streak, difficulty_tier
        ]
    )
    return result


@router.get("/feature-importance")
def get_feature_importance():
    """
    Return the trained XGBoost feature importance ranking.
    """
    metrics = get_model_metrics()
    importances = metrics.get("feature_importance", {})
    return {
        "features": FEATURE_NAMES,
        "importances": importances,
        "primary_factor": max(importances.items(), key=lambda x: x[1])[0] if importances else None,
    }


@router.post("/train")
def trigger_training(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Train or re-train the XGBoost model and persist the updated weights and metrics.
    """
    if train_xgboost_model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Training pipeline is not available"
        )

    metrics = train_xgboost_model(n_samples=2500)
    return {
        "message": "XGBoost model retrained successfully",
        "metrics": metrics,
    }


# ============================================================
# REINFORCEMENT LEARNING (Q-LEARNING AGENT)
# ============================================================

@router.get("/rl/recommendation")
def get_rl_policy_recommendation(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Produce a Reinforcement Learning recommendation for next difficulty
    and challenge type using the Q-learning policy agent.
    """
    try:
        from ml.reinforcement_learning import get_rl_recommendation
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Reinforcement Learning agent unavailable"
        )

    dash = get_dashboard(db, user)
    current_diff = dash.get("current_difficulty", "medium")
    acc = (dash.get("challenge_accuracy", 75) or 75) / 100.0
    snoozes = dash.get("snooze_count", 0) or 0

    return get_rl_recommendation(
        current_difficulty=current_diff,
        recent_accuracy=acc,
        snooze_count=snoozes,
    )


@router.post("/rl/feedback")
def submit_rl_feedback(
    accuracy: float = Query(..., ge=0.0, le=1.0),
    response_time: float = Query(..., ge=1.0, le=120.0),
    snoozes: int = Query(0, ge=0),
    completed_on_time: bool = Query(True),
    current_difficulty: str = Query("medium"),
    action_taken: str = Query("maintain_difficulty"),
    next_difficulty: str = Query("medium"),
    user=Depends(get_current_user),
):
    """
    Record user interaction outcome to update the Reinforcement Learning Q-table.
    """
    try:
        from ml.reinforcement_learning import rl_agent
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Reinforcement Learning agent unavailable"
        )

    reward = rl_agent.compute_reward(
        accuracy=accuracy,
        response_time_seconds=response_time,
        snoozes=snoozes,
        completed_on_time=completed_on_time,
    )

    state_key = rl_agent.discretize_state(current_difficulty, accuracy, snoozes)
    next_state_key = rl_agent.discretize_state(next_difficulty, accuracy, snoozes)
    new_q = rl_agent.update(state_key, action_taken, reward, next_state_key)

    return {
        "message": "Reinforcement learning policy updated",
        "state": state_key,
        "action": action_taken,
        "reward": reward,
        "new_q_value": new_q,
    }
