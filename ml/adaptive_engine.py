"""
ml/adaptive_engine.py

High-level interface connecting the AI Cognitive Alarm Platform to the
underlying Machine Learning and XGBoost prediction modules.
"""

from pathlib import Path
from .xgboost_model import predict_wake_readiness, get_model_status, load_xgboost_model
from .reinforcement_learning import get_rl_recommendation, rl_agent


def predict_ready(
    challenge_accuracy: float = 0.75,
    response_time: float = 25.0,
    snooze_count: float = 0.0,
    wake_consistency: float = 0.70,
    sleep_adherence: float = 1.0,
    consecutive_streak: int = 1,
    difficulty_tier: int = 3,
):
    """
    Predict wakefulness and cognitive readiness using the trained XGBoost model.
    """
    return predict_wake_readiness(
        challenge_accuracy=challenge_accuracy,
        response_time=response_time,
        snooze_count=snooze_count,
        wake_consistency=wake_consistency,
        sleep_adherence=sleep_adherence,
        consecutive_streak=consecutive_streak,
        difficulty_tier=difficulty_tier,
    )


def adapt_with_rl(
    current_difficulty: str = "medium",
    recent_accuracy: float = 0.75,
    snooze_count: int = 0,
):
    """
    Suggest next difficulty or challenge focus using Reinforcement Learning policy.
    """
    return get_rl_recommendation(
        current_difficulty=current_difficulty,
        recent_accuracy=recent_accuracy,
        snooze_count=snooze_count,
    )