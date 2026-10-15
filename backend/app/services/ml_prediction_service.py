"""
ML Prediction Service for Wake-Up Prediction.

Loads the trained XGBoost model pipeline, coordinates feature extraction,
generates probabilistic wake-up forecasts, identifies key risk drivers,
and provides a safe fallback to rule-based logic when model is unavailable.
"""

import os
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import joblib

from app.services.ml_feature_extractor import extract_prediction_features


_MODEL_PIPELINE = None
_MODEL_METADATA = None


def get_model_pipeline_and_metadata():
    """Lazily loads the trained XGBoost model pipeline and metadata."""
    global _MODEL_PIPELINE, _MODEL_METADATA

    if _MODEL_PIPELINE is not None and _MODEL_METADATA is not None:
        return _MODEL_PIPELINE, _MODEL_METADATA

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_path = os.path.join(base_dir, "ml", "models", "xgb_wake_model.joblib")
    metadata_path = os.path.join(base_dir, "ml", "models", "model_metadata.json")

    if os.path.exists(model_path) and os.path.exists(metadata_path):
        try:
            _MODEL_PIPELINE = joblib.load(model_path)
            with open(metadata_path, "r", encoding="utf-8") as f:
                _MODEL_METADATA = json.load(f)
            return _MODEL_PIPELINE, _MODEL_METADATA
        except Exception as e:
            print(f"[ML Prediction Service] Warning: Failed to load model artifact: {e}")
            return None, None

    return None, None


def generate_risk_factors_and_insights(features_df, prob_on_time: float) -> List[Dict[str, str]]:
    """Derives human-interpretable risk drivers from the input feature values."""
    insights = []
    row = features_df.iloc[0]

    alarm_hour = int(row["alarm_hour"])
    sched_diff = int(row["schedule_diff_minutes"])
    diff_num = int(row["difficulty_num"])
    is_weekend = int(row["is_weekend"])
    prior_snooze = float(row["prior_snooze_rate"])

    if alarm_hour < 6:
        insights.append({
            "factor": "Early Morning Timing",
            "impact": "Negative",
            "description": f"Alarm at {alarm_hour:02d}:{int(row['alarm_minute']):02d} AM occurs during deep circadian sleep nadir (+25% snooze risk).",
        })
    elif 6 <= alarm_hour <= 8:
        insights.append({
            "factor": "Optimal Circadian Window",
            "impact": "Positive",
            "description": "Alarm time aligns well with natural morning cortisol awakening response.",
        })

    if sched_diff >= 45:
        insights.append({
            "factor": "Schedule Discrepancy",
            "impact": "Negative",
            "description": f"Alarm differs by {sched_diff} minutes from preferred wake target, increasing grogginess.",
        })

    if diff_num >= 3:
        insights.append({
            "factor": "Cognitive Challenge Friction",
            "impact": "Negative",
            "description": f"{row['challenge_type'].capitalize()} challenge on Hard difficulty requires high working memory immediately upon waking.",
        })

    if is_weekend:
        insights.append({
            "factor": "Weekend Sleep Inertia",
            "impact": "Negative",
            "description": "Weekend schedule typically exhibits higher psychological snooze propensity.",
        })

    if prior_snooze > 0.3:
        insights.append({
            "factor": "Historical Snooze Tendency",
            "impact": "Negative",
            "description": f"Recent sessions show a {prior_snooze:.0%} snooze frequency.",
        })
    elif prior_snooze == 0.0:
        insights.append({
            "factor": "Consistent Snooze Discipline",
            "impact": "Positive",
            "description": "Zero snoozes recorded in recent alarm sessions.",
        })

    if not insights:
        insights.append({
            "factor": "Balanced Routine",
            "impact": "Neutral",
            "description": "Standard schedule with moderate challenge load.",
        })

    return insights


def predict_wake_up_outcome(
    alarm: Any,
    user: Any,
    user_profile: Optional[Any] = None,
    past_sessions: Optional[List[Any]] = None,
) -> Dict[str, Any]:
    """
    Main prediction entrypoint.
    Executes XGBoost model inference if available; gracefully falls back to rule-based baseline.
    """
    pipeline, metadata = get_model_pipeline_and_metadata()

    # Fallback to rule-based logic if ML pipeline is unavailable
    if pipeline is None:
        return _rule_based_fallback(alarm, user, user_profile, past_sessions)

    try:
        features_df = extract_prediction_features(
            alarm=alarm,
            user_profile=user_profile,
            past_sessions=past_sessions,
        )

        probabilities = pipeline.predict_proba(features_df)[0]
        # Class 1 = On-Time Wakeup, Class 0 = Delayed/Snooze
        prob_on_time = float(probabilities[1])
        prob_delayed = float(probabilities[0])

        if prob_on_time >= 0.75:
            risk_level = "Low"
            recommendation = "Optimal setup. Current schedule and challenge align well with consistent wake-up."
        elif prob_on_time >= 0.50:
            risk_level = "Moderate"
            recommendation = "Consider ensuring 7+ hours of sleep tonight to prevent morning snooze impulse."
        else:
            risk_level = "High"
            recommendation = "High snooze risk detected. Suggest shifting challenge to Medium difficulty or preparing an earlier bedtime."

        insights = generate_risk_factors_and_insights(features_df, prob_on_time)

        # Extract features dictionary for API visibility
        features_dict = {
            col: (float(features_df[col].iloc[0]) if isinstance(features_df[col].iloc[0], (int, float)) else str(features_df[col].iloc[0]))
            for col in features_df.columns
        }

        dataset_origin = metadata.get("dataset_origin", "synthetic_circadian_benchmark")
        model_source = "synthetic_benchmark_model" if "synthetic" in dataset_origin else "real_validated_model"

        # Generate list of text risk factors
        negative_insights = [i["description"] for i in insights if i["impact"] == "Negative"]
        risk_factors = negative_insights if negative_insights else ["No acute circadian risk factors detected."]

        confidence_note = (
            "Based on calibrated synthetic circadian benchmark model. "
            "Real production history is insufficient (<30 sessions) for individualized model calibration."
        )

        return {
            "prediction": "ON_TIME" if prob_on_time >= 0.5 else "DELAYED_RISK",
            "on_time_probability": round(prob_on_time, 2),
            "risk_probability": round(prob_delayed, 2),
            "prediction_source": model_source,
            "confidence_note": confidence_note,
            "risk_factors": risk_factors,
            "recommendation": recommendation,
            "risk_level": risk_level,
            "insights": insights,
            "extracted_features": features_dict,
            "model_version": metadata.get("model_version", "1.0.0"),
            "model_algorithm": metadata.get("algorithm", "XGBoost Classifier"),
            "disclaimer": (
                "Forecast generated by XGBoost Classifier trained on a calibrated circadian benchmark dataset. "
                "Prediction provides an estimated risk score for proactive habit improvement and is not a clinical diagnosis."
            ),
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
            "fallback_reason": None,
        }

    except Exception as e:
        print(f"[ML Prediction Service] Inference error: {e}. Falling back to rule-based logic.")
        return _rule_based_fallback(alarm, user, user_profile, past_sessions, error_reason=str(e))


def _rule_based_fallback(
    alarm: Any,
    user: Any,
    user_profile: Optional[Any] = None,
    past_sessions: Optional[List[Any]] = None,
    error_reason: Optional[str] = None,
) -> Dict[str, Any]:
    """Graceful fallback when model is not trained or encounters an exception."""
    past_sessions = past_sessions or []
    valid_past = [s for s in past_sessions if getattr(s, "session_status", None) == "completed"]

    if valid_past:
        on_time_count = sum(
            1
            for s in valid_past
            if (getattr(s, "snooze_count", 0) or 0) == 0
            and getattr(s, "is_correct", None) is True
            and (getattr(s, "response_time_seconds", 0) or 0) <= 60
        )
        base_rate = on_time_count / len(valid_past)
    else:
        base_rate = 0.70

    prob_on_time = max(0.10, min(0.95, round(base_rate, 2)))
    prob_delayed = round(1.0 - prob_on_time, 2)

    return {
        "prediction": "ON_TIME" if prob_on_time >= 0.5 else "DELAYED_RISK",
        "on_time_probability": prob_on_time,
        "risk_probability": prob_delayed,
        "prediction_source": "rule_based_fallback",
        "confidence_note": "ML model artifact is offline or uncalibrated. Output derived from rule-based baseline.",
        "risk_factors": ["Operating on heuristic baseline rules."],
        "recommendation": "Maintain regular bedtime schedule to support consistent waking.",
        "risk_level": "Low" if prob_on_time >= 0.75 else ("Moderate" if prob_on_time >= 0.50 else "High"),
        "insights": [
            {
                "factor": "Rule-Based Prior",
                "impact": "Neutral",
                "description": "Estimated from historical session consistency rules.",
            }
        ],
        "extracted_features": {},
        "model_version": "0.0.0",
        "model_algorithm": "Circadian Heuristic Baseline",
        "disclaimer": "ML model artifact is currently offline. Output represents a rule-based circadian baseline.",
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "fallback_reason": error_reason or "ML model artifact not loaded",
    }
