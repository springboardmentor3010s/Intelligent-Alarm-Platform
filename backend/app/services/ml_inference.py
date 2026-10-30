# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Compatibility facade for the difficulty engine.

Canonical home: `app.ai_engine.difficulty`.

`DifficultyPredictor` is only defined when PyTorch is available (mirrors the
legacy module so torch-less runtime images keep rule-based fallback).
"""

from ..ai_engine import difficulty as _engine

DIFFICULTY_LABELS = _engine.DIFFICULTY_LABELS
MODEL_DIR = _engine.MODEL_DIR
MODEL_PATH = _engine.MODEL_PATH
RULE_THRESHOLDS = _engine.RULE_THRESHOLDS
MLInferenceService = _engine.MLInferenceService
_rule_based_difficulty = _engine._rule_based_difficulty
get_model_status = _engine.get_model_status
_torch_available = getattr(_engine, "_torch_available", False)

try:
    DifficultyPredictor = _engine.DifficultyPredictor
except AttributeError:
    DifficultyPredictor = None

__all__ = [
    "DIFFICULTY_LABELS",
    "DifficultyPredictor",
    "MLInferenceService",
    "MODEL_DIR",
    "MODEL_PATH",
    "RULE_THRESHOLDS",
    "get_model_status",
]
