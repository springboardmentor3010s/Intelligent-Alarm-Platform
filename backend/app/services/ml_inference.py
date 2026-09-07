"""ML inference service for adaptive difficulty prediction.

Uses a lightweight PyTorch model to predict optimal challenge difficulty
based on user performance history. Falls back to rule-based logic if
model is unavailable or inference fails.

Model: Simple feedforward network
Input features: success_rate, avg_time, snooze_count, streak_length
Output: difficulty_level (0=Beginner, 1=Easy, 2=Medium, 3=Hard, 4=Expert)
"""

import logging
from typing import Optional, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).parent.parent.parent / "ml_models"
MODEL_PATH = MODEL_DIR / "difficulty_model.pt"

# Difficulty labels indexed 0-4
DIFFICULTY_LABELS = ["Beginner", "Easy", "Medium", "Hard", "Expert"]

# Rule-based fallback thresholds
RULE_THRESHOLDS = {
    "high_performer": 0.80,   # success_rate > 80% → increase difficulty
    "low_performer": 0.30,    # success_rate < 30% → decrease difficulty
}


def _rule_based_difficulty(
    success_rate: float,
    current_difficulty: str = "Medium",
) -> str:
    """Fallback rule-based difficulty adjustment."""
    idx = DIFFICULTY_LABELS.index(current_difficulty) if current_difficulty in DIFFICULTY_LABELS else 2

    if success_rate > RULE_THRESHOLDS["high_performer"] and idx < 4:
        return DIFFICULTY_LABELS[idx + 1]
    elif success_rate < RULE_THRESHOLDS["low_performer"] and idx > 0:
        return DIFFICULTY_LABELS[idx - 1]
    return current_difficulty


try:
    import torch
    import torch.nn as nn

    class DifficultyPredictor(nn.Module):
        """Lightweight feedforward network for difficulty prediction."""

        def __init__(self, input_dim: int = 4, hidden_dim: int = 16, output_dim: int = 5):
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(input_dim, hidden_dim),
                nn.ReLU(),
                nn.Dropout(0.2),
                nn.Linear(hidden_dim, hidden_dim),
                nn.ReLU(),
                nn.Dropout(0.2),
                nn.Linear(hidden_dim, output_dim),
            )

        def forward(self, x):
            return self.net(x)

    _torch_available = True
except ImportError:
    _torch_available = False
    logger.warning("PyTorch not available; ML inference disabled, using rule-based fallback.")


class MLInferenceService:
    """Service for ML-based difficulty prediction with graceful fallback."""

    _model: Optional[object] = None
    _model_loaded: bool = False

    @classmethod
    def _load_model(cls) -> bool:
        """Load the pre-trained model from disk."""
        if cls._model_loaded:
            return cls._model is not None

        cls._model_loaded = True

        if not _torch_available:
            return False

        if not MODEL_PATH.exists():
            logger.info(f"No trained model at {MODEL_PATH}; using rule-based fallback.")
            return False

        try:
            model = DifficultyPredictor()
            state_dict = torch.load(MODEL_PATH, map_location="cpu", weights_only=True)
            model.load_state_dict(state_dict)
            model.eval()
            cls._model = model
            logger.info("ML difficulty model loaded successfully.")
            return True
        except Exception as e:
            logger.error(f"Failed to load ML model: {e}")
            return False

    @classmethod
    def predict_difficulty(
        cls,
        success_rate: float,
        avg_time_seconds: float,
        snooze_count: int,
        streak_length: int,
        current_difficulty: str = "Medium",
    ) -> Tuple[str, str]:
        """Predict optimal difficulty level.

        Returns:
            Tuple of (predicted_difficulty, method_used)
            method_used is "ml" or "rule_based"
        """
        if cls._load_model() and cls._model is not None:
            try:
                features = torch.tensor(
                    [[success_rate, avg_time_seconds / 60.0, snooze_count / 5.0, streak_length / 10.0]],
                    dtype=torch.float32,
                )
                with torch.no_grad():
                    logits = cls._model(features)
                    pred_idx = logits.argmax(dim=1).item()

                predicted = DIFFICULTY_LABELS[min(max(pred_idx, 0), 4)]
                return predicted, "ml"
            except Exception as e:
                logger.error(f"ML inference failed: {e}; falling back to rules.")

        # Rule-based fallback
        predicted = _rule_based_difficulty(success_rate, current_difficulty)
        return predicted, "rule_based"

    @classmethod
    def get_model_status(cls) -> dict:
        """Return model loading status and info."""
        cls._load_model()
        return {
            "torch_available": _torch_available,
            "model_loaded": cls._model is not None,
            "model_path": str(MODEL_PATH),
            "model_exists": MODEL_PATH.exists(),
        }
