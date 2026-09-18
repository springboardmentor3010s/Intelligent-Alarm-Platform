# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Measure the difficulty-model weights (Phase 6).

Loads `backend/ml_models/difficulty_model.pt` (if present) and reports:
  1. Held-out accuracy on a SYNTHETIC set generated with a different seed
     than training (seed 1234 vs 42) — guards against seed memorization.
  2. Monotonicity probes: sweeping success_rate 0→1 (other features fixed)
     must never step the prediction downward.
  3. Sanity spot-checks: a strong profile must not predict Beginner and a
     weak profile must not predict Expert.

This measures the synthetic-trained weights only; it says nothing about real
users (the model has never seen real user data). Exits 0 on pass, 1 on
failure, 2 when evaluation is impossible (no torch / no weights file).

Usage (from backend/):
    python scripts/evaluate_difficulty_model.py [--min-accuracy 0.80]
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import torch
except ImportError:
    print("SKIP: PyTorch not installed; cannot evaluate.")
    sys.exit(2)

from app.ai_engine.difficulty import MODEL_PATH, DifficultyPredictor  # noqa: E402
from train_difficulty_model import make_dataset  # noqa: E402

LABELS = ["Beginner", "Easy", "Medium", "Hard", "Expert"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--min-accuracy", type=float, default=0.80)
    args = parser.parse_args()

    if not MODEL_PATH.exists():
        print(f"SKIP: no weights at {MODEL_PATH}; rule-based fallback is active.")
        return 2

    model = DifficultyPredictor()
    try:
        state = torch.load(MODEL_PATH, map_location="cpu", weights_only=True)
        model.load_state_dict(state)
    except Exception as exc:
        print(f"FAIL: weights at {MODEL_PATH} could not be loaded: {exc}")
        return 1
    model.eval()

    failures = []

    # 1. Held-out synthetic accuracy (fresh seed, same generator contract).
    features, labels = make_dataset(n=4000, seed=1234)
    with torch.no_grad():
        preds = model(features).argmax(dim=1)
        acc = (preds == labels).float().mean().item()
    print(f"held-out synthetic accuracy (n=4000, seed=1234): {acc:.3f}")
    if acc < args.min_accuracy:
        failures.append(f"accuracy {acc:.3f} < threshold {args.min_accuracy:.2f}")

    # 2. Monotonicity: success sweep must be non-decreasing.
    with torch.no_grad():
        sweep = torch.tensor(
            [[s, 5.0, 0.4, 0.3] for s in (i / 20.0 for i in range(21))],
            dtype=torch.float32,
        )
        sweep_preds = model(sweep).argmax(dim=1).tolist()
    for prev, cur in zip(sweep_preds, sweep_preds[1:]):
        if cur < prev:
            failures.append(f"non-monotonic success sweep: {sweep_preds}")
            break
    else:
        print(f"monotonicity sweep: OK {sweep_preds[0]} -> {sweep_preds[-1]}")

    # 3. Sanity extremes.
    with torch.no_grad():
        strong = model(torch.tensor([[0.95, 2.0, 0.0, 1.0]])).argmax(dim=1).item()
        weak = model(torch.tensor([[0.10, 12.0, 1.0, 0.0]])).argmax(dim=1).item()
    print(f"strong profile -> {LABELS[strong]}; weak profile -> {LABELS[weak]}")
    if strong == 0:
        failures.append("strong profile predicted Beginner")
    if weak == 4:
        failures.append("weak profile predicted Expert")

    if failures:
        print("FAIL:")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print("PASS: all model measurements within thresholds.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
