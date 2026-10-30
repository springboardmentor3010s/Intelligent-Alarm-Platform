# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Difficulty prediction engine (AI/ML, Phase 6).

Honesty contract (read before citing this module in docs):

- The PyTorch weights in `difficulty_model.pt` were trained on a SYNTHETIC,
  rule-generated dataset (`scripts/train_difficulty_model.py`, seed 42). The
  model has NEVER seen real user data and must never be described as
  production learning or personalization.
- The model is one advisory input: callers (e.g. `ChallengeService`) clamp its
  output to ±1 step of the user's anchor difficulty.
- When torch or the weights are unavailable, the transparent rule engine
  (`_rule_based_difficulty`, 6 measurable signals) decides instead. The
  serving path always reports which method was used.

Model: feedforward 4 → 16 → 5 (see `features.MODEL_FEATURES` for the frozen
input contract). Version: `MODEL_VERSION`.
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .features import (
    DIFFICULTY_ORDER,
    MODEL_FEATURES,
    build_rule_signals,
    normalize_model_features,
)

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).parent.parent.parent / "ml_models"
MODEL_PATH = MODEL_DIR / "difficulty_model.pt"
META_PATH = MODEL_DIR / "difficulty_model.meta.json"

MODEL_VERSION = "1.0.0"
# Provenance of the shipped weights. Never claim otherwise in docs or UI copy.
TRAINING_DATA = "synthetic"
FALLBACK_NAME = "rule_based_v2"

# Difficulty labels indexed 0-4 (canonical order shared with features.py).
DIFFICULTY_LABELS = list(DIFFICULTY_ORDER)

# Legacy single-signal thresholds (kept for backward-compatible callers).
RULE_THRESHOLDS = {
    "high_performer": 0.80,   # success_rate > 80% → increase difficulty
    "low_performer": 0.30,    # success_rate < 30% → decrease difficulty
}


def _rule_votes(signals: Dict[str, Any]) -> Tuple[int, List[str]]:
    """Score the 6 measurable signals; return (steps, reasons).

    The neutral signal vector scores exactly 0 (anchor unchanged). Each signal
    is monotonic: improving it never lowers the vote.
    """
    acc = signals["recent_accuracy"]
    avg_time = signals["avg_time_seconds"]
    snooze = signals["snooze_frequency"]
    failed = signals["failed_attempts"]
    wake = signals["wake_up_consistency"]

    steps = 0
    reasons: List[str] = []

    if acc >= 0.85:
        steps += 2
        reasons.append(f"recent accuracy {acc:.0%} is high")
    elif acc >= 0.65:
        steps += 1
        reasons.append(f"recent accuracy {acc:.0%} is solid")
    elif acc >= 0.50:
        reasons.append(f"recent accuracy {acc:.0%} is average")
    elif acc >= 0.30:
        steps -= 1
        reasons.append(f"recent accuracy {acc:.0%} is low")
    else:
        steps -= 2
        reasons.append(f"recent accuracy {acc:.0%} is very low")

    if avg_time <= 25:
        steps += 1
        reasons.append(f"average solve time {avg_time:.0f}s is fast")
    elif avg_time >= 120:
        steps -= 1
        reasons.append(f"average solve time {avg_time:.0f}s is slow")

    if snooze >= 4.0:
        steps -= 2
        reasons.append(f"snooze frequency {snooze:.1f}/alarm is very high")
    elif snooze >= 2.0:
        steps -= 1
        reasons.append(f"snooze frequency {snooze:.1f}/alarm is elevated")
    elif snooze <= 0.5:
        steps += 1
        reasons.append("no snoozing recently")

    if failed >= 3:
        steps -= 2
        reasons.append(f"{failed} failed attempts recently")
    elif failed >= 1:
        steps -= 1
        reasons.append(f"{failed} failed attempt(s) recently")

    if wake >= 80:
        steps += 1
        reasons.append(f"wake-up consistency {wake:.0f} is strong")
    elif wake < 40:
        steps -= 1
        reasons.append(f"wake-up consistency {wake:.0f} is weak")

    return max(-2, min(2, steps)), reasons


def _merge_signals(success_rate: float, anchor: str, signals: Dict[str, Any]) -> Dict[str, Any]:
    """Combine the positional accuracy with keyword signals (kwargs win)."""
    merged = dict(signals)
    merged.setdefault("recent_accuracy", success_rate)
    merged["recent_difficulty"] = anchor
    return build_rule_signals(**merged)


def _rule_based_difficulty(
    success_rate: float,
    current_difficulty: str = "Medium",
    **signals: Any,
) -> str:
    """Transparent rule engine over the 6 measurable signals.

    Backward compatible: called with only (success_rate, current_difficulty)
    it behaves like the legacy ±1 rule; extra keyword signals engage the full
    6-signal vote (still monotonic per signal).
    """
    anchor = current_difficulty if current_difficulty in DIFFICULTY_LABELS else "Medium"
    if not signals:
        idx = DIFFICULTY_LABELS.index(anchor)
        if success_rate > RULE_THRESHOLDS["high_performer"] and idx < 4:
            return DIFFICULTY_LABELS[idx + 1]
        if success_rate < RULE_THRESHOLDS["low_performer"] and idx > 0:
            return DIFFICULTY_LABELS[idx - 1]
        return anchor

    full = _merge_signals(success_rate, anchor, signals)
    steps, _ = _rule_votes(full)
    idx = DIFFICULTY_LABELS.index(anchor)
    return DIFFICULTY_LABELS[max(0, min(4, idx + steps))]


def explain_difficulty(
    success_rate: float,
    current_difficulty: str = "Medium",
    predicted: Optional[str] = None,
    method: str = FALLBACK_NAME,
    **signals: Any,
) -> str:
    """Human-readable reason for a difficulty recommendation.

    Every difficulty suggestion shipped to users or coaches must carry this
    explanation; silent difficulty changes are not allowed.
    """
    anchor = current_difficulty if current_difficulty in DIFFICULTY_LABELS else "Medium"
    full = _merge_signals(success_rate, anchor, signals)
    _, reasons = _rule_votes(full)
    target = predicted or _rule_based_difficulty(success_rate, anchor, **signals)
    basis = "; ".join(reasons) if reasons else "steady recent performance"
    source = "learned model (synthetic-trained, advisory only)" if method == "ml" else "transparent performance rules"
    return (
        f"Recommended {target} (from {anchor}) because {basis}. "
        f"Basis: {source}."
    )


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
except (ImportError, OSError):  # OSError: torch raises WinError 4551 when Smart App Control/WDAC blocks its DLLs
    _torch_available = False
    logger.warning("PyTorch not available; ML inference disabled, using rule-based fallback.")


class MLInferenceService:
    """Service for ML-based difficulty prediction with graceful fallback."""

    _model: Optional[object] = None
    _model_loaded: bool = False
    _training_meta: Optional[dict] = None

    @classmethod
    def reset_cache(cls) -> None:
        """Clear cached model/meta (test isolation)."""
        cls._model = None
        cls._model_loaded = False
        cls._training_meta = None

    @classmethod
    def _load_model(cls) -> bool:
        """Load the pre-trained model from disk."""
        if cls._model_loaded:
            return cls._model is not None

        cls._model_loaded = True

        if not _torch_available:
            return False

        if not MODEL_PATH.exists():
            logger.info("No trained model at %s; using rule-based fallback.", MODEL_PATH)
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
            logger.error("Failed to load ML model: %s", e)
            return False

    @classmethod
    def training_metadata(cls) -> Dict[str, Any]:
        """Provenance of the shipped weights (synthetic training record)."""
        if cls._training_meta is not None:
            return cls._training_meta
        meta: Dict[str, Any] = {
            "model_version": MODEL_VERSION,
            "training_data": TRAINING_DATA,
            "status": "no-record",
            "detail": "No training record found next to the weights; treat as synthetic-trained.",
        }
        try:
            if META_PATH.exists():
                record = json.loads(META_PATH.read_text(encoding="utf-8"))
                if isinstance(record, dict):
                    meta = dict(record)
                    meta.setdefault("model_version", MODEL_VERSION)
                    meta.setdefault("training_data", TRAINING_DATA)
                    meta.setdefault("status", "recorded")
        except Exception as e:
            logger.warning("Could not read training metadata: %s", e)
        cls._training_meta = meta
        return meta

    @classmethod
    def predict_difficulty(
        cls,
        success_rate: float,
        avg_time_seconds: float,
        snooze_count: int,
        streak_length: int,
        current_difficulty: str = "Medium",
        failed_attempts: int = 0,
        wake_up_consistency: float = 50.0,
        snooze_frequency: Optional[float] = None,
    ) -> Tuple[str, str]:
        """Predict optimal difficulty level.

        The ML path always uses the frozen 4-feature contract. The fallback
        uses the legacy single-signal rule unless the caller supplies measured
        multi-signal context (`snooze_frequency` etc.), which engages the
        transparent 6-signal rule engine.

        Returns:
            Tuple of (predicted_difficulty, method_used)
            method_used is "ml" or "rule_based"
        """
        anchor = current_difficulty if current_difficulty in DIFFICULTY_LABELS else "Medium"
        if cls._load_model() and cls._model is not None:
            try:
                vector = normalize_model_features(
                    success_rate, avg_time_seconds, snooze_count, streak_length
                )
                features = torch.tensor([vector], dtype=torch.float32)
                with torch.no_grad():
                    logits = cls._model(features)
                    pred_idx = logits.argmax(dim=1).item()

                predicted = DIFFICULTY_LABELS[min(max(int(pred_idx), 0), 4)]
                # Privacy: log only the transition + method, never features or ids.
                logger.info(
                    "difficulty_predict method=ml anchor=%s predicted=%s",
                    anchor,
                    predicted,
                )
                return predicted, "ml"
            except Exception as e:
                logger.error("ML inference failed: %s; falling back to rules.", e)

        # Rule-based fallback.
        if snooze_frequency is None and not failed_attempts and wake_up_consistency == 50.0:
            # Legacy caller: exact historical single-signal behavior.
            predicted = _rule_based_difficulty(success_rate, anchor)
        else:
            # Measured multi-signal context: transparent 6-signal vote.
            predicted = _rule_based_difficulty(
                success_rate,
                anchor,
                avg_time_seconds=avg_time_seconds,
                snooze_frequency=snooze_count if snooze_frequency is None else snooze_frequency,
                failed_attempts=failed_attempts,
                wake_up_consistency=wake_up_consistency,
            )
        logger.info(
            "difficulty_predict method=%s anchor=%s predicted=%s",
            FALLBACK_NAME,
            anchor,
            predicted,
        )
        return predicted, "rule_based"

    @classmethod
    def get_model_status(cls) -> dict:
        """Return model availability, version, fallback, and training record."""
        cls._load_model()
        return {
            "torch_available": _torch_available,
            "model_loaded": cls._model is not None,
            "model_exists": MODEL_PATH.exists(),
            "model_path": str(MODEL_PATH),
            "model_version": MODEL_VERSION,
            "training_data": TRAINING_DATA,
            "fallback": FALLBACK_NAME,
            "fallback_available": True,
            "feature_contract": list(MODEL_FEATURES),
            "last_training": cls.training_metadata(),
        }


def get_model_status() -> dict:
    """Module-level alias for `MLInferenceService.get_model_status`."""
    return MLInferenceService.get_model_status()


def recommend_difficulty(db: Any, user_id: int, anchor: str = "Medium") -> Tuple[str, str, str]:
    """DB-backed difficulty recommendation over 6 measured signals.

    Gathers recent accuracy, completion time, snooze frequency, failed
    attempts, recent difficulty, and wake-up consistency from real rows, runs
    the model-or-rules prediction, and returns
    (predicted_difficulty, method, explanation). Callers clamp the result to
    their own safety band; the explanation must travel with any user-visible
    difficulty suggestion.
    """
    from sqlalchemy.orm import Session as _Session  # noqa: F401 (typing only)

    from ..Models import Alarm, ChallengeAttempt, HabitScore

    ended = (
        db.query(ChallengeAttempt)
        .filter(ChallengeAttempt.user_id == user_id, ChallengeAttempt.end_time.isnot(None))
        .order_by(ChallengeAttempt.end_time.desc())
        .limit(5)
        .all()
    )
    if not ended:
        return anchor, "rule_based", (
            f"Staying at {anchor}: no answered attempts yet, so there is no "
            "performance evidence to justify a move."
        )

    total_q = sum(a.total_questions for a in ended) or 1
    success_rate = sum(a.correct_answers for a in ended) / total_q
    times = [a.time_taken_seconds for a in ended if a.time_taken_seconds and a.time_taken_seconds > 0]
    avg_time = sum(times) / len(times) if times else 30.0
    failed = sum(1 for a in ended if not a.completed)

    alarms = db.query(Alarm).filter(Alarm.user_id == user_id).all()
    snooze_frequency = (
        sum(a.times_snoozed for a in alarms) / len(alarms) if alarms else 0.0
    )

    latest_score = (
        db.query(HabitScore)
        .filter(HabitScore.user_id == user_id)
        .order_by(HabitScore.date.desc())
        .first()
    )
    wake = float(latest_score.wake_up_consistency) if latest_score else 50.0

    streak = 0
    for attempt in ended:
        if attempt.completed:
            streak += 1
        else:
            break

    predicted, method = MLInferenceService.predict_difficulty(
        success_rate=success_rate,
        avg_time_seconds=avg_time,
        snooze_count=int(sum(a.times_snoozed for a in alarms)),
        streak_length=streak,
        current_difficulty=anchor,
        failed_attempts=failed,
        wake_up_consistency=wake,
        snooze_frequency=snooze_frequency,
    )

    # Optional RL bandit blend (Phase D). Off by default so the deterministic
    # rule/ML recommendation stays reproducible; when enabled the bandit may
    # override the recommendation using recent per-arm outcomes.
    bandit_arm = _bandit_blend(anchor, predicted, ended, success_rate, avg_time, streak)
    if bandit_arm is not None and bandit_arm != predicted:
        method = f"{method}+bandit"
        predicted = bandit_arm

    explanation = explain_difficulty(
        success_rate,
        anchor,
        predicted=predicted,
        method=method,
        avg_time_seconds=avg_time,
        snooze_frequency=snooze_frequency,
        failed_attempts=failed,
        wake_up_consistency=wake,
    )
    return predicted, method, explanation


def _bandit_blend(
    anchor: str,
    predicted: str,
    attempts: List[Any],
    success_rate: float,
    avg_time: float,
    streak: int,
) -> Optional[str]:
    """Return a bandit-chosen difficulty, or None when blending is disabled."""
    from ..core import config as _config

    if not _config.is_rl_bandit_enabled():
        return None

    from .rl_policy import Context, ContextualBandit

    bandit = ContextualBandit()
    # Neutral prior on every arm so unseen difficulties aren't auto-explored.
    for arm in bandit.arms:
        bandit.count[arm] = 1.0
        bandit.mean[arm] = 0.5
    # Seed each arm from real recent attempts: completing an arm = reward 1.
    for attempt in attempts:
        challenge = getattr(attempt, "challenge", None)
        arm = getattr(challenge, "difficulty", None)
        if arm in bandit.arms:
            bandit.update(arm, 1.0 if attempt.completed else 0.0)
    ctx = Context(
        success_rate=success_rate,
        avg_time_sec=avg_time,
        attempts_recent=streak,
        preferred=anchor,
    )
    return bandit.blend(predicted, ctx, blend_ratio=_config.get_rl_blend_ratio())
