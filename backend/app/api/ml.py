"""
ML Admin API
Provides model status and training trigger endpoints.
Admin-only. Does NOT expose training data or model weights.
"""
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from app.core.security import require_role

router = APIRouter(prefix="/ml", tags=["ML"])

_admin_only = require_role("ADMINISTRATOR")


@router.get("/status")
def model_status(_=Depends(_admin_only)):
    """Return XGBoost model status — whether trained, sample count, metrics."""
    try:
        from app.ml.difficulty_model import get_model
        return get_model().status
    except Exception as exc:
        return {"model_available": False, "error": str(exc)}


@router.post("/train")
def trigger_training(
    background_tasks: BackgroundTasks,
    demo: bool = False,
    _=Depends(_admin_only),
):
    """
    Trigger model training in the background.
    demo=true uses synthetic data (clearly labeled).
    demo=false uses real database records.
    """
    def _train():
        from app.ml.train_difficulty_model import train
        train(use_demo=demo)

    background_tasks.add_task(_train)
    return {
        "message": "Training started in background.",
        "demo_mode": demo,
        "note": "Use GET /ml/status to check progress after a few seconds.",
    }
