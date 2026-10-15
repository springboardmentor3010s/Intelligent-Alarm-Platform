"""
XGBoost Difficulty Model Training Pipeline
==========================================

Usage (from backend/ directory):
    venv\\Scripts\\python.exe -m app.ml.train_difficulty_model

Or with synthetic demo data (clearly labeled):
    venv\\Scripts\\python.exe -m app.ml.train_difficulty_model --demo

The --demo flag generates synthetic challenge records for demonstration.
Synthetic data is NEVER mixed with real user data.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

# Ensure backend/ is on sys.path when run as a module
_BACKEND = Path(__file__).parent.parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.ml.features import (
    DIFFICULTY_LEVELS, DIFF_ENC, FEATURE_NAMES,
    build_dataset_from_records, build_feature_vector,
)
from app.ml.difficulty_model import MODEL_DIR, MODEL_PATH, METADATA_PATH, MIN_TRAINING_SAMPLES

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)


# ── Synthetic demo data generator ─────────────────────────────────────────────

def _generate_synthetic_records(n_users: int = 10, challenges_per_user: int = 50) -> dict:
    """
    Generate clearly-labeled SYNTHETIC challenge records for demo/testing.
    These are NOT real user data.

    Simulates realistic performance patterns:
    - Users start at BEGINNER and progress based on performance
    - Higher difficulty → lower accuracy
    - Response time increases with difficulty
    """
    import random
    from app.services.adaptive_difficulty import compute_next_difficulty

    rng = random.Random(42)   # fixed seed for reproducibility

    # Accuracy by difficulty (simulated)
    ACCURACY = {
        "BEGINNER": 0.90, "EASY": 0.80, "MEDIUM": 0.65,
        "HARD": 0.50, "EXPERT": 0.35,
    }
    TIME_LIMITS = {
        "BEGINNER": 120, "EASY": 90, "MEDIUM": 60, "HARD": 45, "EXPERT": 30,
    }
    CHALLENGE_TYPES = ["math", "logic", "memory", "word", "pattern", "riddle", "quiz"]

    records = {}
    for user_id in range(1, n_users + 1):
        user_challenges = []
        current_diff = "BEGINNER"
        for i in range(challenges_per_user):
            ctype = rng.choice(CHALLENGE_TYPES)
            acc = ACCURACY[current_diff]
            is_correct = rng.random() < acc
            attempts = 1 if is_correct else rng.randint(1, 3)
            tl = TIME_LIMITS[current_diff]
            # Faster for easier difficulties
            base_time = tl * rng.uniform(0.2, 0.8)
            if not is_correct:
                base_time *= rng.uniform(1.2, 2.0)
            duration = min(base_time, tl * 2.5)
            score = max(0, int(100 * acc * (1 - (attempts - 1) * 0.1))) if is_correct else 0

            # Use a simple dict-like object
            challenge = {
                "difficulty": current_diff,
                "challenge_type": ctype,
                "is_correct": is_correct,
                "attempts": attempts,
                "score": score,
                "completion_duration_seconds": round(duration, 1),
                "time_limit_seconds": tl,
                "completed_at": datetime.now(timezone.utc) if is_correct else None,
            }
            user_challenges.append(challenge)

            # Advance difficulty using rule-based logic
            recent = [bool(c["is_correct"]) for c in user_challenges[-10:]]
            current_diff = compute_next_difficulty(current_diff, recent)

        records[user_id] = user_challenges

    return records


# ── Training ──────────────────────────────────────────────────────────────────

def train(use_demo: bool = False) -> dict:
    """
    Main training function.

    Args:
        use_demo: if True, use synthetic data (clearly labeled)

    Returns:
        dict with training results and metrics
    """
    try:
        import xgboost as xgb
        xgb_version = xgb.__version__
    except ImportError:
        logger.error("xgboost is not installed. Run: pip install xgboost")
        sys.exit(1)

    # ── Load data ─────────────────────────────────────────────────────────────
    if use_demo:
        logger.info("=" * 60)
        logger.info("DEMO MODE — using SYNTHETIC data (not real user data)")
        logger.info("=" * 60)
        challenges_by_user = _generate_synthetic_records(n_users=20, challenges_per_user=60)
        data_source = "synthetic_demo"
    else:
        logger.info("Loading real challenge data from database...")
        challenges_by_user = _load_real_data()
        data_source = "real_database"

    # ── Build features ────────────────────────────────────────────────────────
    X, y = build_dataset_from_records(challenges_by_user)
    n_samples = len(X)
    logger.info("Dataset: %d samples, %d features", n_samples, X.shape[1] if n_samples else 0)

    if n_samples < MIN_TRAINING_SAMPLES:
        msg = (
            f"Insufficient data: {n_samples} samples (need {MIN_TRAINING_SAMPLES}). "
            f"Use --demo for a demonstration with synthetic data."
        )
        logger.warning(msg)
        return {
            "success": False,
            "reason": msg,
            "n_samples": n_samples,
            "data_source": data_source,
        }

    # ── Class distribution ────────────────────────────────────────────────────
    unique, counts = np.unique(y, return_counts=True)
    dist = {DIFFICULTY_LEVELS[int(k)]: int(v) for k, v in zip(unique, counts)}
    logger.info("Class distribution: %s", dist)

    # ── Train / test split ────────────────────────────────────────────────────
    from sklearn.model_selection import train_test_split

    if n_samples >= 60:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y if len(unique) > 1 else None
        )
        has_test_set = True
    else:
        # Too few samples for a meaningful split — train on all, report limitation
        X_train, y_train = X, y
        X_test, y_test = X, y
        has_test_set = False
        logger.warning(
            "Only %d samples — training on full dataset. "
            "Evaluation metrics are in-sample (optimistic). "
            "Collect more real data for reliable evaluation.",
            n_samples,
        )

    logger.info("Train: %d  |  Test: %d", len(X_train), len(X_test))

    # ── XGBoost training ──────────────────────────────────────────────────────
    n_classes = len(DIFFICULTY_LEVELS)

    dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=FEATURE_NAMES)
    dtest  = xgb.DMatrix(X_test,  label=y_test,  feature_names=FEATURE_NAMES)

    params = {
        "objective":        "multi:softmax",
        "num_class":        n_classes,
        "max_depth":        4,
        "learning_rate":    0.1,
        "subsample":        0.8,
        "colsample_bytree": 0.8,
        "eval_metric":      "merror",
        "seed":             42,
        "verbosity":        0,
        "device":           "cpu",
    }

    evals = [(dtrain, "train"), (dtest, "eval")]
    evals_result = {}

    clf = xgb.train(
        params,
        dtrain,
        num_boost_round=100,
        evals=evals,
        evals_result=evals_result,
        early_stopping_rounds=15,
        verbose_eval=False,
    )

    # ── Evaluation ────────────────────────────────────────────────────────────
    y_pred = clf.predict(dtest).astype(int)

    from sklearn.metrics import (
        accuracy_score, classification_report, confusion_matrix
    )

    accuracy = float(accuracy_score(y_test, y_pred))
    report   = classification_report(
        y_test, y_pred,
        labels=list(range(n_classes)),
        target_names=DIFFICULTY_LEVELS,
        zero_division=0,
        output_dict=True,
    )
    cm = confusion_matrix(y_test, y_pred, labels=list(range(n_classes))).tolist()

    logger.info("Accuracy: %.4f  (in-sample=%s)", accuracy, not has_test_set)
    logger.info("Classification report:\n%s",
                classification_report(y_test, y_pred,
                                      labels=list(range(n_classes)),
                                      target_names=DIFFICULTY_LEVELS,
                                      zero_division=0))

    # ── Save model ────────────────────────────────────────────────────────────
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    clf.save_model(str(MODEL_PATH))

    meta = {
        "trained_at":       datetime.now(timezone.utc).isoformat(),
        "xgboost_version":  xgb_version,
        "n_samples":        n_samples,
        "n_train":          len(X_train),
        "n_test":           len(X_test),
        "has_proper_split": has_test_set,
        "data_source":      data_source,
        "accuracy":         round(accuracy, 4),
        "in_sample_eval":   not has_test_set,
        "class_distribution": dist,
        "feature_names":    FEATURE_NAMES,
        "difficulty_levels": DIFFICULTY_LEVELS,
        "params":           params,
        "best_iteration":   clf.best_iteration if hasattr(clf, "best_iteration") else 100,
        "classification_report": report,
        "confusion_matrix": cm,
    }
    with open(METADATA_PATH, "w") as f:
        json.dump(meta, f, indent=2)

    logger.info("Model saved to %s", MODEL_PATH)
    logger.info("Metadata saved to %s", METADATA_PATH)

    # Reload the singleton
    from app.ml.difficulty_model import reload_model
    reload_model()

    return {"success": True, **meta}


def _load_real_data() -> dict:
    """Load CognitiveChallenge records from the real database."""
    import os
    from dotenv import load_dotenv
    load_dotenv(_BACKEND / ".env")

    from app.db.database import SessionLocal
    from app.models.models import CognitiveChallenge

    db = SessionLocal()
    try:
        rows = (
            db.query(CognitiveChallenge)
            .filter(CognitiveChallenge.is_correct.isnot(None))
            .order_by(CognitiveChallenge.user_id, CognitiveChallenge.started_at)
            .all()
        )
        by_user: dict = {}
        for row in rows:
            by_user.setdefault(row.user_id, []).append(row)
        logger.info("Loaded %d answered challenges from %d users", len(rows), len(by_user))
        return by_user
    finally:
        db.close()


# ── CLI entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train XGBoost difficulty model")
    parser.add_argument(
        "--demo", action="store_true",
        help="Use synthetic demo data (clearly labeled, not real user data)"
    )
    args = parser.parse_args()
    result = train(use_demo=args.demo)
    if not result.get("success"):
        sys.exit(1)
