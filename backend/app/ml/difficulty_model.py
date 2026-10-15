"""
XGBoost Difficulty Prediction Model

Wraps XGBoost classifier for adaptive difficulty prediction.
Falls back gracefully when model is unavailable or data is insufficient.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np

from app.ml.features import DIFFICULTY_LEVELS, DIFF_ENC, FEATURE_NAMES

logger = logging.getLogger(__name__)

# Model artifact paths — relative to this file's location, not machine-specific
_ML_DIR   = Path(__file__).parent
_ROOT_DIR = _ML_DIR.parent.parent          # backend/
MODEL_DIR = _ROOT_DIR / "models"
MODEL_PATH    = MODEL_DIR / "difficulty_model.json"
METADATA_PATH = MODEL_DIR / "difficulty_model_meta.json"

# Minimum samples required to trust the model
MIN_TRAINING_SAMPLES = 30

# Reverse mapping: int → difficulty string
_DEC_DIFF = {v: k for k, v in DIFF_ENC.items()}


class DifficultyModel:
    """
    Thin wrapper around an XGBoost classifier for difficulty prediction.

    Usage:
        model = DifficultyModel()
        if model.is_ready:
            prediction = model.predict(feature_vector)
        else:
            # use rule-based fallback
    """

    def __init__(self):
        self._clf = None
        self._meta: dict = {}
        self._load_if_exists()

    # ── Public interface ──────────────────────────────────────────────────────

    @property
    def is_ready(self) -> bool:
        """True when a trained model is loaded and had sufficient training data."""
        if self._clf is None:
            return False
        return self._meta.get("n_samples", 0) >= MIN_TRAINING_SAMPLES

    @property
    def status(self) -> dict:
        """Return model status dict for the /ml/status endpoint."""
        return {
            "model_available": self._clf is not None,
            "is_ready": self.is_ready,
            "min_samples_required": MIN_TRAINING_SAMPLES,
            "n_training_samples": self._meta.get("n_samples", 0),
            "trained_at": self._meta.get("trained_at"),
            "xgboost_version": self._meta.get("xgboost_version"),
            "accuracy": self._meta.get("accuracy"),
            "n_features": len(FEATURE_NAMES),
            "feature_names": FEATURE_NAMES,
            "difficulty_levels": DIFFICULTY_LEVELS,
            "model_path": str(MODEL_PATH),
            "fallback_reason": self._fallback_reason(),
        }

    def predict(self, feature_vector: np.ndarray) -> Optional[str]:
        """
        Predict next difficulty from a 14-element feature vector.

        Returns:
            Difficulty string (e.g. "MEDIUM") or None if model not ready.
        """
        if not self.is_ready:
            return None
        try:
            import xgboost as xgb
            dmatrix = xgb.DMatrix(
                feature_vector.reshape(1, -1),
                feature_names=FEATURE_NAMES,
            )
            raw = self._clf.predict(dmatrix)
            pred_int = int(raw[0])
            result = _DEC_DIFF.get(pred_int)
            if result not in DIFFICULTY_LEVELS:
                logger.warning("XGBoost predicted out-of-range class %d", pred_int)
                return None
            return result
        except Exception as exc:
            logger.error("XGBoost prediction failed: %s", exc)
            return None

    def predict_proba(self, feature_vector: np.ndarray) -> Optional[dict]:
        """Return class probabilities dict {difficulty: probability}."""
        if not self.is_ready:
            return None
        try:
            proba_arr = self._clf.inplace_predict(feature_vector.reshape(1, -1))
            if proba_arr.ndim == 2:
                return {_DEC_DIFF[i]: float(p) for i, p in enumerate(proba_arr[0])}
            return None
        except Exception:
            return None

    # ── Internal ──────────────────────────────────────────────────────────────

    def _load_if_exists(self):
        if not MODEL_PATH.exists():
            logger.info("No trained model found at %s", MODEL_PATH)
            return
        try:
            import xgboost as xgb
            clf = xgb.Booster()
            clf.load_model(str(MODEL_PATH))
            self._clf = clf
            if METADATA_PATH.exists():
                with open(METADATA_PATH) as f:
                    self._meta = json.load(f)
            logger.info(
                "XGBoost model loaded — %d training samples, accuracy=%.3f",
                self._meta.get("n_samples", 0),
                self._meta.get("accuracy", 0.0),
            )
        except Exception as exc:
            logger.error("Failed to load XGBoost model: %s", exc)
            self._clf = None

    def reload(self):
        """Reload model from disk (called after training)."""
        self._clf = None
        self._meta = {}
        self._load_if_exists()

    def _fallback_reason(self) -> str:
        if self._clf is None:
            return "Model not trained yet. Run train_difficulty_model.py to train."
        n = self._meta.get("n_samples", 0)
        if n < MIN_TRAINING_SAMPLES:
            return f"Insufficient training data ({n} samples, need {MIN_TRAINING_SAMPLES})."
        return "none"


# Module-level singleton — imported by adaptive_difficulty.py
_model_instance: Optional[DifficultyModel] = None


def get_model() -> DifficultyModel:
    """Return the module-level singleton, loading it once."""
    global _model_instance
    if _model_instance is None:
        _model_instance = DifficultyModel()
    return _model_instance


def reload_model():
    """Force reload after training."""
    global _model_instance
    if _model_instance is not None:
        _model_instance.reload()
    else:
        _model_instance = DifficultyModel()
