"""
Milestone 3 ML Intelligence Service.

Serves as the PRIMARY behavioral intelligence engine using XGBoost for:
1. Behavioral Habit Scoring (XGBoost Regressor + deterministic formula breakdown)
2. Adaptive Cognitive Difficulty (XGBoost Multiclass Classifier + boundary adjustments)
3. Personalized Recommendations (XGBoost Wake-Up & Difficulty insights)

Provides robust, automatic fallback to Milestone 3 rule-based logic whenever:
- ML model artifacts are offline or uncalibrated
- Features cannot be extracted
- User history is insufficient (cold start)
- An inference exception occurs

Every response exposes `prediction_source` ("ml_model" or "rule_based_fallback").
"""

import os
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import numpy as np
import joblib

from app.services.habit_scorer import (
    evaluate_user_habit,
    calculate_habit_score,
    compute_behavioral_metrics,
)
from app.services.recommendation_engine import (
    generate_recommendations as rule_based_recommendations,
    THRESHOLD_SNOOZE_ALERT,
    THRESHOLD_CONSISTENCY_ALERT,
    THRESHOLD_CHALLENGE_LOW,
    THRESHOLD_CHALLENGE_HIGH,
    THRESHOLD_SLEEP_ADHERENCE_ALERT,
    THRESHOLD_HABIT_MASTERY,
    MIN_SESSIONS_FOR_TRENDS,
)
from app.services.adaptive_service import (
    calculate_adaptive_difficulty_from_sessions,
    MINIMUM_SAMPLES_FOR_ADAPTATION,
)
from app.services.adaptive_difficulty import (
    adjust_difficulty,
    DIFFICULTY_LEVELS,
)
from app.services.performance_analyzer import analyze_performance
from app.services.ml_feature_extractor import extract_prediction_features
from app.services.ml_prediction_service import predict_wake_up_outcome


_WAKE_PIPELINE = None
_DIFF_PIPELINE = None
_BEHAVIOR_PIPELINE = None
_METADATA = None


def load_all_ml_models():
    """Lazily loads all 3 trained XGBoost pipelines and metadata."""
    global _WAKE_PIPELINE, _DIFF_PIPELINE, _BEHAVIOR_PIPELINE, _METADATA

    if _WAKE_PIPELINE is not None and _DIFF_PIPELINE is not None and _BEHAVIOR_PIPELINE is not None:
        return _WAKE_PIPELINE, _DIFF_PIPELINE, _BEHAVIOR_PIPELINE, _METADATA

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    models_dir = os.path.join(base_dir, "ml", "models")

    wake_path = os.path.join(models_dir, "xgb_wake_model.joblib")
    diff_path = os.path.join(models_dir, "xgb_difficulty_model.joblib")
    behavior_path = os.path.join(models_dir, "xgb_behavior_regressor.joblib")
    metadata_path = os.path.join(models_dir, "model_metadata.json")

    try:
        if os.path.exists(wake_path) and _WAKE_PIPELINE is None:
            _WAKE_PIPELINE = joblib.load(wake_path)
        if os.path.exists(diff_path) and _DIFF_PIPELINE is None:
            _DIFF_PIPELINE = joblib.load(diff_path)
        if os.path.exists(behavior_path) and _BEHAVIOR_PIPELINE is None:
            _BEHAVIOR_PIPELINE = joblib.load(behavior_path)
        if os.path.exists(metadata_path) and _METADATA is None:
            with open(metadata_path, "r", encoding="utf-8") as f:
                _METADATA = json.load(f)
    except Exception as e:
        print(f"[ML Intelligence Service] Warning loading models: {e}")

    return _WAKE_PIPELINE, _DIFF_PIPELINE, _BEHAVIOR_PIPELINE, _METADATA


# =====================================================================
# 1. PRIMARY ML HABIT SCORING (WITH FORMULA PRESERVATION)
# =====================================================================

def get_ml_habit_score(
    sessions: List[Any],
    user_profile: Optional[Any] = None,
    alarms: Optional[List[Any]] = None,
    target_alarm: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Computes both the official deterministic Habit Score (35/25/20/20) and the
    primary XGBoost Behavioral Score regressor projection.
    """
    # 1. Deterministic baseline (spec-compliant formula)
    deterministic_score = evaluate_user_habit(
        sessions=sessions,
        user_profile=user_profile,
        alarms=alarms,
    )

    _, _, behavior_pipeline, metadata = load_all_ml_models()

    valid_sessions = [s for s in (sessions or []) if getattr(s, "session_status", None) == "completed"]

    # Cold-start or model missing -> Rule-based fallback
    if behavior_pipeline is None or len(valid_sessions) == 0:
        return {
            **deterministic_score,
            "ml_behavioral_score": deterministic_score["overall_habit_score"],
            "prediction_source": "rule_based_fallback",
            "confidence_note": "Rule-based formula habit score (cold-start baseline or ML model offline).",
        }

    try:
        # Resolve target alarm for feature extraction
        alarm_obj = target_alarm
        if not alarm_obj and alarms:
            alarm_obj = alarms[0]

        features_df = extract_prediction_features(
            alarm=alarm_obj,
            user_profile=user_profile,
            past_sessions=sessions,
        )

        pred_score = float(behavior_pipeline.predict(features_df)[0])
        clamped_ml_score = round(max(0.0, min(100.0, pred_score)), 1)

        return {
            **deterministic_score,
            "ml_behavioral_score": clamped_ml_score,
            "prediction_source": "ml_model",
            "confidence_note": "ML Behavioral Score projected by XGBoost Regressor based on longitudinal circadian features.",
        }

    except Exception as e:
        print(f"[ML Intelligence Service] Error computing ML habit score: {e}. Falling back.")
        return {
            **deterministic_score,
            "ml_behavioral_score": deterministic_score["overall_habit_score"],
            "prediction_source": "rule_based_fallback",
            "confidence_note": f"Rule-based fallback due to exception: {e}",
        }


# =====================================================================
# 2. PRIMARY ML ADAPTIVE DIFFICULTY
# =====================================================================

def get_ml_adaptive_difficulty(
    current_difficulty: str,
    alarm: Optional[Any] = None,
    user: Optional[Any] = None,
    user_profile: Optional[Any] = None,
    past_sessions: Optional[List[Any]] = None,
) -> Dict[str, Any]:
    """
    Evaluates challenge difficulty adjustment using XGBoost Multiclass Classifier as
    primary engine, with seamless fallback to rule-based accuracy thresholds.
    """
    normalized_difficulty = (current_difficulty or "medium").strip().lower()
    if normalized_difficulty not in DIFFICULTY_LEVELS:
        normalized_difficulty = "medium"

    valid_sessions = [s for s in (past_sessions or []) if getattr(s, "session_status", None) == "completed"]

    # Cold start check: fewer than minimum required completed sessions
    if len(valid_sessions) < MINIMUM_SAMPLES_FOR_ADAPTATION:
        fallback_res = calculate_adaptive_difficulty_from_sessions(
            current_difficulty=normalized_difficulty,
            sessions=past_sessions or [],
        )
        return {
            "current_difficulty": fallback_res["current_difficulty"],
            "recommended_difficulty": fallback_res["recommended_difficulty"],
            "accuracy": fallback_res["performance"]["accuracy"],
            "sample_size": fallback_res["sample_size"],
            "adjusted": fallback_res["adjusted"],
            "reason": fallback_res["reason"],
            "action": "maintain",
            "prediction_source": "rule_based_fallback",
            "confidence": 0.50,
        }

    _, diff_pipeline, _, _ = load_all_ml_models()

    if diff_pipeline is None:
        fallback_res = calculate_adaptive_difficulty_from_sessions(
            current_difficulty=normalized_difficulty,
            sessions=past_sessions or [],
        )
        is_adjusted = fallback_res["adjusted"]
        rec = fallback_res["recommended_difficulty"]
        action = "maintain"
        if is_adjusted:
            action = "increase" if DIFFICULTY_LEVELS.index(rec) > DIFFICULTY_LEVELS.index(normalized_difficulty) else "decrease"
        return {
            "current_difficulty": fallback_res["current_difficulty"],
            "recommended_difficulty": fallback_res["recommended_difficulty"],
            "accuracy": fallback_res["performance"]["accuracy"],
            "sample_size": fallback_res["sample_size"],
            "adjusted": is_adjusted,
            "reason": fallback_res["reason"],
            "action": action,
            "prediction_source": "rule_based_fallback",
            "confidence": 0.65,
        }

    try:
        features_df = extract_prediction_features(
            alarm=alarm,
            user_profile=user_profile,
            past_sessions=past_sessions,
        )

        probs = diff_pipeline.predict_proba(features_df)[0]
        # Classes: 0 = decrease, 1 = maintain, 2 = increase
        action_idx = int(np.argmax(probs))
        confidence = float(probs[action_idx])
        action_map = {0: "decrease", 1: "maintain", 2: "increase"}
        action_str = action_map.get(action_idx, "maintain")

        curr_idx = DIFFICULTY_LEVELS.index(normalized_difficulty)
        adjusted = False

        if action_str == "increase" and curr_idx < len(DIFFICULTY_LEVELS) - 1:
            rec_diff = DIFFICULTY_LEVELS[curr_idx + 1]
            adjusted = True
            reason = (
                f"XGBoost Cognitive Classifier recommended promoting difficulty to "
                f"'{rec_diff.capitalize()}' ({confidence:.0%} confidence) based on strong accuracy and prompt challenge responses."
            )
        elif action_str == "decrease" and curr_idx > 0:
            rec_diff = DIFFICULTY_LEVELS[curr_idx - 1]
            adjusted = True
            reason = (
                f"XGBoost Cognitive Classifier recommended easing difficulty to "
                f"'{rec_diff.capitalize()}' ({confidence:.0%} confidence) to lower grogginess and rebuild morning momentum."
            )
        else:
            rec_diff = normalized_difficulty
            adjusted = False
            if action_str == "increase":
                reason = f"High challenge accuracy detected, but already at highest difficulty level ('{normalized_difficulty.capitalize()}')."
            elif action_str == "decrease":
                reason = f"Challenge friction detected, but already at beginner difficulty level ('{normalized_difficulty.capitalize()}')."
            else:
                reason = (
                    f"XGBoost Cognitive Classifier recommended maintaining '{normalized_difficulty.capitalize()}' "
                    f"difficulty ({confidence:.0%} confidence) for balanced cognitive challenge engagement."
                )

        # Compute empirical performance metrics for client transparency
        answered_results = [
            getattr(s, "is_correct")
            for s in (past_sessions or [])
            if getattr(s, "is_correct", None) is not None
        ]
        recent_results = answered_results[-5:] if answered_results else []
        performance = analyze_performance(recent_results)

        return {
            "current_difficulty": normalized_difficulty,
            "recommended_difficulty": rec_diff,
            "accuracy": performance["accuracy"],
            "sample_size": len(valid_sessions),
            "adjusted": adjusted,
            "reason": reason,
            "action": action_str,
            "prediction_source": "ml_model",
            "confidence": round(confidence, 2),
        }

    except Exception as e:
        print(f"[ML Intelligence Service] Error in ML adaptive difficulty: {e}. Falling back.")
        fallback_res = calculate_adaptive_difficulty_from_sessions(
            current_difficulty=normalized_difficulty,
            sessions=past_sessions or [],
        )
        return {
            "current_difficulty": fallback_res["current_difficulty"],
            "recommended_difficulty": fallback_res["recommended_difficulty"],
            "accuracy": fallback_res["performance"]["accuracy"],
            "sample_size": fallback_res["sample_size"],
            "adjusted": fallback_res["adjusted"],
            "reason": fallback_res["reason"],
            "action": "maintain",
            "prediction_source": "rule_based_fallback",
            "confidence": 0.50,
        }


# =====================================================================
# 3. PRIMARY ML RECOMMENDATIONS
# =====================================================================

def get_ml_recommendations(
    habit_score_data: Dict[str, Any],
    recent_sessions: Optional[List[Any]] = None,
    user_profile: Optional[Any] = None,
    alarms: Optional[List[Any]] = None,
    target_alarm: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """
    Generates behavioral recommendations primarily driven by XGBoost predictions:
    - Wake-up forecast & snooze risk drivers
    - Cognitive challenge adaptive tuning
    - Circadian schedule alignment
    Falls back gracefully to rule-based recommendations.
    """
    total_sessions = habit_score_data.get("total_sessions", 0)

    # 1. Cold start / Onboarding: Always include baseline rule
    if total_sessions < MIN_SESSIONS_FOR_TRENDS:
        return [
            {
                "category": "habit_improvement",
                "title": "Establish Your Morning Baseline",
                "message": (
                    f"You have recorded {total_sessions} alarm session(s). "
                    "Complete at least 3 cognitive alarm sessions to unlock full "
                    "personalized behavioral patterns and adaptive difficulty."
                ),
                "priority": "medium",
                "supporting_metric": {
                    "total_sessions": total_sessions,
                    "target": MIN_SESSIONS_FOR_TRENDS,
                },
                "prediction_source": "rule_based_fallback",
            },
            {
                "category": "wake_up_optimization",
                "title": "Consistency Foundation",
                "message": "Set your alarm at the same time each day to help calibrate your circadian rhythm.",
                "priority": "medium",
                "supporting_metric": {"target_sessions": 3},
                "prediction_source": "rule_based_fallback",
            },
            {
                "category": "sleep_improvement",
                "title": "Sleep Environment Setup",
                "message": "Keep your sleeping room cool and dark to facilitate smooth morning wakefulness.",
                "priority": "low",
                "supporting_metric": {},
                "prediction_source": "rule_based_fallback",
            },
        ]

    wake_pipeline, _, _, _ = load_all_ml_models()

    # If ML is offline, fall back to rule-based recommendations
    if wake_pipeline is None:
        recs = rule_based_recommendations(habit_score_data, recent_sessions, user_profile)
        for r in recs:
            r["prediction_source"] = "rule_based_fallback"
        return recs

    try:
        alarm_obj = target_alarm
        if not alarm_obj and alarms:
            alarm_obj = alarms[0]

        # Get wake-up prediction
        wake_pred = predict_wake_up_outcome(
            alarm=alarm_obj,
            user=None,
            user_profile=user_profile,
            past_sessions=recent_sessions,
        )

        # Get adaptive difficulty recommendation
        curr_diff = getattr(alarm_obj, "difficulty", "medium") if alarm_obj else "medium"
        diff_pred = get_ml_adaptive_difficulty(
            current_difficulty=curr_diff,
            alarm=alarm_obj,
            user=None,
            user_profile=user_profile,
            past_sessions=recent_sessions,
        )

        recommendations: List[Dict[str, Any]] = []

        # 1. ML Wake-Up & Snooze Optimization
        risk_prob = wake_pred.get("risk_probability", 0.3)
        risk_level = wake_pred.get("risk_level", "Moderate")
        if risk_prob >= 0.35 or risk_level in ["High", "Moderate"]:
            recommendations.append({
                "category": "wake_up_optimization",
                "title": "ML Wake-Up Alert: Elevated Snooze Risk",
                "message": (
                    f"XGBoost model forecasts a {int(risk_prob * 100)}% risk of morning snoozing or grogginess. "
                    f"{wake_pred.get('recommendation', 'Maintain consistent bedtime schedule.')}"
                ),
                "priority": "high" if risk_level == "High" else "medium",
                "supporting_metric": {
                    "snooze_delay_risk": f"{int(risk_prob * 100)}%",
                    "risk_level": risk_level,
                    "model_confidence": f"{int(max(risk_prob, 1 - risk_prob) * 100)}%",
                },
                "prediction_source": "ml_model",
            })

        # 2. ML Adaptive Challenge Tuning
        if diff_pred.get("adjusted") or diff_pred.get("action") in ["increase", "decrease"]:
            action = diff_pred.get("action", "maintain")
            recommendations.append({
                "category": "challenge_recommendation",
                "title": "AI Challenge Recommendation",
                "message": "XGBoost identified a potential difficulty adjustment based on recent behavioral and challenge-performance patterns.",
                "priority": "medium" if action == "decrease" else "low",
                "supporting_metric": {
                    "current_difficulty": diff_pred.get("current_difficulty", "medium"),
                    "recommended_difficulty": diff_pred.get("recommended_difficulty", "medium"),
                    "ml_confidence": f"{int(diff_pred.get('confidence', 0.8) * 100)}%",
                },
                "prediction_source": "ml_model",
            })

        # 3. Habit Consistency Insight
        w_consistency = habit_score_data.get("wake_up_consistency", 50.0)
        if w_consistency < THRESHOLD_CONSISTENCY_ALERT:
            recommendations.append({
                "category": "habit_improvement",
                "title": "Strengthen Wake-Up Consistency",
                "message": (
                    f"Your wake-up consistency score is {w_consistency}%. "
                    "Waking up at varying times disrupts your circadian clock. "
                    "Aim for a consistent wake-up time within a 15-minute window daily."
                ),
                "priority": "high",
                "supporting_metric": {
                    "wake_up_consistency": w_consistency,
                    "threshold": THRESHOLD_CONSISTENCY_ALERT,
                },
                "prediction_source": "ml_model",
            })

        # 4. Sleep Schedule Adherence
        s_adherence = habit_score_data.get("sleep_schedule_adherence", 50.0)
        if s_adherence < THRESHOLD_SLEEP_ADHERENCE_ALERT:
            recommendations.append({
                "category": "sleep_improvement",
                "title": "Harmonize Bedtime with Wake Schedule",
                "message": (
                    f"Your sleep schedule adherence is {s_adherence}%. "
                    "Ensure you target 7 to 8 hours of uninterrupted rest before your scheduled wake-up time."
                ),
                "priority": "medium",
                "supporting_metric": {
                    "sleep_schedule_adherence": s_adherence,
                    "target": THRESHOLD_SLEEP_ADHERENCE_ALERT,
                },
                "prediction_source": "ml_model",
            })

        # 5. Productivity Mastery (when performing well)
        overall_score = habit_score_data.get("overall_habit_score", 50.0)
        if overall_score >= THRESHOLD_HABIT_MASTERY and len(recommendations) < 3:
            recommendations.append({
                "category": "productivity",
                "title": "Capitalize on High Morning Momentum",
                "message": (
                    f"Your habit score is an outstanding {overall_score}/100. "
                    "Your cognitive arousal reaches peak efficiency within 20 minutes of waking. "
                    "Schedule high-focus deep work during your first morning hours."
                ),
                "priority": "low",
                "supporting_metric": {
                    "overall_habit_score": overall_score,
                    "mastery_threshold": THRESHOLD_HABIT_MASTERY,
                },
                "prediction_source": "ml_model",
            })

        # If empty (all metrics optimal), provide praise
        if not recommendations:
            recommendations.append({
                "category": "productivity",
                "title": "Optimal Circadian Rhythm Maintained",
                "message": "All behavioral and cognitive indicators are performing in the optimal zone. Keep up your routine!",
                "priority": "low",
                "supporting_metric": {"status": "Optimal"},
                "prediction_source": "ml_model",
            })

        return recommendations

    except Exception as e:
        print(f"[ML Intelligence Service] Error in ML recommendations: {e}. Falling back.")
        recs = rule_based_recommendations(habit_score_data, recent_sessions, user_profile)
        for r in recs:
            r["prediction_source"] = "rule_based_fallback"
        return recs
