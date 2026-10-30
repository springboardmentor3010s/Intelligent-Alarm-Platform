# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Train and save the difficulty-prediction model for CerebroKognit.

SYNTHETIC TRAINING — READ FIRST: this script generates a deterministic
synthetic dataset whose labels follow a hand-built skill rule (matches the
production feature/label distribution). The saved weights have NEVER seen
real user data. Do not describe this model as production learning,
personalization, or trained-on-user-data in docs, UI copy, or reports.
`AI_FEATURES.md` records this provenance as the model's documented status.

Trains the DifficultyPredictor defined in app/ai_engine/difficulty.py and
saves its state_dict to backend/ml_models/difficulty_model.pt (loadable with
torch.load(..., weights_only=True)) plus a `difficulty_model.meta.json`
training record consumed by `GET /analytics/ml-status`.

Usage (from backend/):
    python scripts/train_difficulty_model.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import torch
    import torch.nn as nn
except ImportError:
    print("PyTorch not installed in this environment; cannot train.")
    sys.exit(1)

from app.ai_engine.difficulty import (  # noqa: E402
    META_PATH,
    MODEL_PATH,
    MODEL_VERSION,
    TRAINING_DATA,
    DifficultyPredictor,
)

SEED = 42


def make_dataset(n: int = 5000, seed: int = SEED):
    """Synthetic samples matching the features used at inference time.

    Inference features (in app/services/ml_inference.py): [success_rate],
    [avg_time_seconds / 60.0] (minutes), [snooze_count / 5.0],
    [streak_length / 10.0]. Labels are derived from a plausible skill rule.
    """
    torch.manual_seed(seed)

    success_rate = torch.rand(n)
    avg_time_min = torch.empty(n).uniform_(1.0, 15.0)  # typical completion minutes
    snooze_count = torch.randint(0, 6, (n,)).float()
    streak_length = torch.randint(0, 16, (n,)).float()

    # Skill in [0,1] favouring accuracy, speed, low snoozing, long streaks.
    skill = (
        0.55 * success_rate
        + 0.20 * (1.0 - (avg_time_min - 1.0) / 14.0)
        + 0.15 * (1.0 - snooze_count / 5.0)
        + 0.10 * (streak_length / 10.0).clamp(max=1.0)
    )
    labels = (skill * 4.0).round().clamp(0, 4).long()

    features = torch.stack(
        [success_rate, avg_time_min, snooze_count / 5.0, streak_length / 10.0],
        dim=1,
    )
    return features, labels


def main() -> None:
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)

    features, labels = make_dataset(n=20000)
    n = features.size(0)
    split = int(n * 0.8)

    model = DifficultyPredictor()
    optimizer = torch.optim.Adam(model.parameters(), lr=3e-3)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=150, gamma=0.5)
    criterion = nn.CrossEntropyLoss()

    train_x, train_y = features[:split], labels[:split]
    val_x, val_y = features[split:], labels[split:]

    epochs = 600
    for epoch in range(1, epochs + 1):
        model.train()
        optimizer.zero_grad()
        loss = criterion(model(train_x), train_y)
        loss.backward()
        optimizer.step()
        scheduler.step()

        if epoch % 50 == 0 or epoch == epochs:
            model.eval()
            with torch.no_grad():
                val_pred = model(val_x).argmax(dim=1)
                val_acc = (val_pred == val_y).float().mean().item()
            print(f"epoch {epoch:3d}  train_loss={loss.item():.4f}  val_acc={val_acc:.3f}")

    # Report a few per-feature sanity predictions.
    model.eval()
    with torch.no_grad():
        samples = torch.tensor([
            [0.95, 2.0, 0.0, 1.0],   # strong, fast, no snooze, long streak -> Expert/Hard
            [0.15, 12.0, 5.0, 0.0],  # weak, slow, max snooze, no streak -> Beginner
            [0.50, 6.0, 2.0, 0.5],   # average -> Medium
        ])
        preds = model(samples).argmax(dim=1).tolist()
    labels_str = ["Beginner", "Easy", "Medium", "Hard", "Expert"]
    for row, p in zip(samples.tolist(), preds):
        print(f"features={row}  -> predicted: {labels_str[p]}")

    torch.save(model.state_dict(), MODEL_PATH)
    print(f"Model saved to {MODEL_PATH} ({MODEL_PATH.stat().st_size} bytes)")

    # Training provenance record for `GET /analytics/ml-status`.
    import datetime as _dt
    import json as _json

    meta = {
        "model_version": MODEL_VERSION,
        "training_data": TRAINING_DATA,
        "status": "trained",
        "trained_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        "dataset": "synthetic-20000-seed42",
        "seed": SEED,
        "val_accuracy": round(val_acc, 4),
        "features": ["success_rate", "avg_time_minutes", "snooze_rate", "streak_norm"],
        "note": "Synthetic rule-generated labels; never trained on real user data.",
    }
    META_PATH.write_text(_json.dumps(meta, indent=2), encoding="utf-8")
    print(f"Training record saved to {META_PATH}")


if __name__ == "__main__":
    main()
