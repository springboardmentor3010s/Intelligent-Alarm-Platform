"""Adaptive difficulty service.

Facade over the isolated `ai_engine` difficulty engine exposing difficulty
adaptation semantics to the rest of the application.
"""

from typing import Any

from ..ai_engine.difficulty import MLInferenceService


class AdaptiveDifficultyService:
    """Adapt challenge difficulty to a user's performance."""

    @classmethod
    def predict_difficulty(cls, *args: Any, **kwargs: Any) -> Any:
        """Predict the next difficulty via the ML model (rule fallback)."""
        return MLInferenceService.predict_difficulty(*args, **kwargs)

    @classmethod
    def adapt_difficulty(cls, *args: Any, **kwargs: Any) -> Any:
        """Alias for `predict_difficulty` (semantic naming for callers)."""
        return MLInferenceService.predict_difficulty(*args, **kwargs)

    @classmethod
    def get_model_status(cls) -> dict:
        """Return ML model load/health diagnostics."""
        return MLInferenceService.get_model_status()
