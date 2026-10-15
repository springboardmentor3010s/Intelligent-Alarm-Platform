"""
Prediction API routes for XGBoost Wake-Up Prediction.

Provides endpoints for probabilistic wake-up forecasting, snooze risk assessment,
and actionable behavioral insights for upcoming alarms.
"""

from datetime import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import Alarm, AlarmSession, User, UserProfile
from app.schemas.ml import WakeUpPredictionResponse
from app.services.ml_prediction_service import (
    get_model_pipeline_and_metadata,
    predict_wake_up_outcome,
)
from app.utils.dependencies import get_current_user


router = APIRouter(
    prefix="/api/predictions",
    tags=["Predictions"],
)


@router.get(
    "/wake-up",
    response_model=WakeUpPredictionResponse,
    summary="Predict wake-up probability for next or primary alarm",
)
def get_wake_up_prediction(
    alarm_id: Optional[int] = Query(None, description="Optional specific alarm ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns an XGBoost-driven probabilistic forecast for the user's upcoming alarm.
    Identifies high-risk circadian factors, difficulty friction, and behavioral patterns.
    """
    # 1. Retrieve the target alarm
    alarm = None
    if alarm_id is not None:
        alarm = (
            db.query(Alarm)
            .filter(
                Alarm.id == alarm_id,
                Alarm.user_id == current_user.id,
            )
            .first()
        )
        if not alarm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Alarm with ID {alarm_id} not found for this user.",
            )
    else:
        # Prioritize active alarms, then most recently created
        alarm = (
            db.query(Alarm)
            .filter(
                Alarm.user_id == current_user.id,
                Alarm.is_active.is_(True),
            )
            .order_by(Alarm.alarm_time.asc())
            .first()
        )
        if not alarm:
            alarm = (
                db.query(Alarm)
                .filter(Alarm.user_id == current_user.id)
                .order_by(Alarm.id.desc())
                .first()
            )

    # 2. Retrieve user profile
    user_profile = (
        db.query(UserProfile)
        .filter(UserProfile.user_id == current_user.id)
        .first()
    )

    # 3. If user has no alarms at all, create an in-memory baseline alarm
    if not alarm:
        preferred_time = getattr(user_profile, "preferred_wake_time", None) or time(7, 0)
        alarm = Alarm(
            id=0,
            user_id=current_user.id,
            name="Target Wake-Up Schedule",
            alarm_time=preferred_time,
            challenge_type="math",
            is_active=True,
        )

    # 4. Retrieve historical completed sessions for this user (strictly past data)
    past_sessions = (
        db.query(AlarmSession)
        .join(Alarm, Alarm.id == AlarmSession.alarm_id)
        .filter(Alarm.user_id == current_user.id)
        .order_by(AlarmSession.started_at.desc())
        .limit(30)
        .all()
    )

    # 5. Execute ML prediction
    prediction_result = predict_wake_up_outcome(
        alarm=alarm,
        user=current_user,
        user_profile=user_profile,
        past_sessions=past_sessions,
    )

    # Attach alarm metadata
    prediction_result["alarm_id"] = alarm.id if alarm.id != 0 else None
    prediction_result["alarm_name"] = alarm.name
    prediction_result["alarm_time"] = str(alarm.alarm_time)

    return prediction_result


@router.get(
    "/wake-up/{alarm_id}",
    response_model=WakeUpPredictionResponse,
    summary="Predict wake-up probability for a specific alarm",
)
def get_wake_up_prediction_for_alarm(
    alarm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns an XGBoost-driven probabilistic forecast for a specific alarm owned by the user.
    """
    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == current_user.id,
        )
        .first()
    )
    if not alarm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alarm with ID {alarm_id} not found for this user.",
        )

    user_profile = (
        db.query(UserProfile)
        .filter(UserProfile.user_id == current_user.id)
        .first()
    )

    past_sessions = (
        db.query(AlarmSession)
        .join(Alarm, Alarm.id == AlarmSession.alarm_id)
        .filter(Alarm.user_id == current_user.id)
        .order_by(AlarmSession.started_at.desc())
        .limit(30)
        .all()
    )

    prediction_result = predict_wake_up_outcome(
        alarm=alarm,
        user=current_user,
        user_profile=user_profile,
        past_sessions=past_sessions,
    )

    prediction_result["alarm_id"] = alarm.id
    prediction_result["alarm_name"] = alarm.name
    prediction_result["alarm_time"] = str(alarm.alarm_time)

    return prediction_result


@router.get(
    "/model-info",
    summary="Get ML model metadata and benchmark performance metrics",
)
def get_model_info(
    current_user: User = Depends(get_current_user),
):
    """
    Returns public metadata and evaluation metrics about the active XGBoost model artifact.
    """
    _, metadata = get_model_pipeline_and_metadata()

    if not metadata:
        return {
            "status": "offline",
            "model_version": "0.0.0",
            "algorithm": "Circadian Heuristic Baseline",
            "dataset_origin": "none",
            "dataset_notice": "ML model artifact not loaded. System operates on rule-based fallbacks.",
        }

    return {
        "status": "online",
        "model_version": metadata.get("model_version"),
        "algorithm": metadata.get("algorithm"),
        "trained_at": metadata.get("trained_at"),
        "dataset_origin": metadata.get("dataset_origin"),
        "dataset_notice": metadata.get("dataset_notice"),
        "dataset_stats": metadata.get("dataset_stats"),
        "target_definition": metadata.get("target_definition"),
        "metrics": metadata.get("metrics"),
        "feature_importances": metadata.get("feature_importances"),
    }
