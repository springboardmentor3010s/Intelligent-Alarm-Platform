import os
import logging
import joblib
import pandas as pd
import numpy as np
from xgboost import XGBClassifier

logger = logging.getLogger(__name__)

BASE_DIR = os.path.join(
    os.path.dirname(__file__),
    "..",
    "ml"
)

RF_PATH = os.path.join(
    BASE_DIR,
    "rf_model.pkl"
)

XGB_PATH = os.path.join(
    BASE_DIR,
    "xgb_model.json"
)

_cached_rf_model = None
_cached_xgb_model = None


def load_models():
    """
    Loads and caches the Random Forest and XGBoost models.
    Avoids re-reading model files from disk on every request.
    """
    global _cached_rf_model, _cached_xgb_model

    if _cached_rf_model is None or _cached_xgb_model is None:
        if not os.path.exists(RF_PATH):
            raise FileNotFoundError(f"Random Forest model not found at {RF_PATH}")
        if not os.path.exists(XGB_PATH):
            raise FileNotFoundError(f"XGBoost model not found at {XGB_PATH}")

        _cached_rf_model = joblib.load(RF_PATH)

        xgb = XGBClassifier()
        xgb.load_model(XGB_PATH)
        _cached_xgb_model = xgb

    return _cached_rf_model, _cached_xgb_model


def predict_performance(
    correctness: float,
    solve_time: float,
    attempts: int,
    difficulty: int
):
    """
    Ensemble prediction combining Random Forest and XGBoost models.
    Input features match the exact format used during training:
    ['correctness', 'solve_time', 'attempt_count', 'difficulty_level'].

    Classes:
    0 = Low
    1 = Medium
    2 = High
    """
    rf_model, xgb_model = load_models()

    features = pd.DataFrame([{
        "correctness": float(correctness),
        "solve_time": float(solve_time),
        "attempt_count": int(attempts),
        "difficulty_level": int(difficulty)
    }], columns=["correctness", "solve_time", "attempt_count", "difficulty_level"])

    rf_probability = rf_model.predict_proba(features)[0]
    xgb_probability = xgb_model.predict_proba(features)[0]

    # Ensemble averaging
    ensemble_probability = (rf_probability + xgb_probability) / 2
    prediction = int(np.argmax(ensemble_probability))

    labels = {
        0: "Low",
        1: "Medium",
        2: "High"
    }

    return {
        "performance_level": labels[prediction],
        "performance_class": prediction,
        "probabilities": {
            "Low": float(ensemble_probability[0]),
            "Medium": float(ensemble_probability[1]),
            "High": float(ensemble_probability[2])
        }
    }
