import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error
import numpy as np

from database import SessionLocal
from models import Challenge, ChallengeResult


# =========================================================
# PyTorch Behavior Prediction Model
# =========================================================

class BehaviorPredictionModel(nn.Module):

    def __init__(self):
        super().__init__()

        self.network = nn.Sequential(
            nn.Linear(4, 16),
            nn.ReLU(),

            nn.Linear(16, 8),
            nn.ReLU(),

            nn.Linear(8, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        return self.network(x)


# =========================================================
# Load and prepare sequential behavior data
# =========================================================

def load_training_data():

    db = SessionLocal()

    try:

        results = (
            db.query(ChallengeResult)
            .order_by(
                ChallengeResult.user_id,
                ChallengeResult.completed_at
            )
            .all()
        )

        features = []
        targets = []

        # Keep previous behavior separately for each user
        user_history = {}

        for result in results:

            user_id = result.user_id

            if user_id not in user_history:
                user_history[user_id] = []

            history = user_history[user_id]

            # -------------------------------------------------
            # We need previous behavior to predict THIS result.
            # -------------------------------------------------

            if len(history) >= 3:

                recent_results = history[-3:]

                # Previous accuracy
                previous_accuracy = (
                    sum(
                        1 for r in recent_results
                        if r.is_correct
                    )
                    / len(recent_results)
                )

                # Previous average attempts
                previous_attempts = np.mean([
                    r.attempts if r.attempts else 1
                    for r in recent_results
                ])

                # Previous average response time
                previous_times = [
                    r.time_taken
                    for r in recent_results
                    if r.time_taken is not None
                ]

                if previous_times:
                    previous_time = np.mean(previous_times)
                else:
                    previous_time = 30.0

                # Previous performance trend
                if len(recent_results) >= 2:

                    first_accuracy = (
                        1 if recent_results[0].is_correct else 0
                    )

                    last_accuracy = (
                        1 if recent_results[-1].is_correct else 0
                    )

                    performance_trend = (
                        last_accuracy - first_accuracy
                    )

                else:
                    performance_trend = 0

                # -------------------------------------------------
                # Input features
                # -------------------------------------------------

                feature_row = [
                    previous_accuracy,
                    min(previous_attempts / 5.0, 1.0),
                    min(previous_time / 60.0, 1.0),
                    (performance_trend + 1) / 2.0
                ]

                # -------------------------------------------------
                # Target = THIS challenge's actual result
                # -------------------------------------------------

                target = (
                    1.0
                    if result.is_correct
                    else 0.0
                )

                features.append(feature_row)
                targets.append(target)

            # Add current result to history AFTER creating features
            history.append(result)

        return (
            np.array(features, dtype=np.float32),
            np.array(targets, dtype=np.float32)
        )

    finally:
        db.close()


# =========================================================
# Train PyTorch model
# =========================================================

def train_model():

    print("\n========================================")
    print("PyTorch Behavior Model Training")
    print("========================================")

    X, y = load_training_data()

    print(f"Usable sequential records: {len(X)}")

    if len(X) < 10:

        print("\nNot enough sequential records.")

        print(
            "At least 10 records with previous "
            "behavior are required."
        )

        return

    # -----------------------------------------------------
    # Train / Test split
    # -----------------------------------------------------

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y
    )

    X_train = torch.tensor(
        X_train,
        dtype=torch.float32
    )

    X_test = torch.tensor(
        X_test,
        dtype=torch.float32
    )

    y_train = torch.tensor(
        y_train.reshape(-1, 1),
        dtype=torch.float32
    )

    y_test = torch.tensor(
        y_test.reshape(-1, 1),
        dtype=torch.float32
    )

    # -----------------------------------------------------
    # Dataset
    # -----------------------------------------------------

    dataset = TensorDataset(
        X_train,
        y_train
    )

    dataloader = DataLoader(
        dataset,
        batch_size=8,
        shuffle=True
    )

    # -----------------------------------------------------
    # Model
    # -----------------------------------------------------

    model = BehaviorPredictionModel()

    criterion = nn.BCELoss()

    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=0.001
    )

    # -----------------------------------------------------
    # Training
    # -----------------------------------------------------

    epochs = 100

    for epoch in range(epochs):

        model.train()

        total_loss = 0

        for batch_X, batch_y in dataloader:

            optimizer.zero_grad()

            predictions = model(batch_X)

            loss = criterion(
                predictions,
                batch_y
            )

            loss.backward()

            optimizer.step()

            total_loss += loss.item()

        if (epoch + 1) % 20 == 0:

            average_loss = (
                total_loss / len(dataloader)
            )

            print(
                f"Epoch [{epoch + 1}/{epochs}] "
                f"Loss: {average_loss:.4f}"
            )

    # =====================================================
    # Evaluation
    # =====================================================

    model.eval()

    with torch.no_grad():

        predictions = model(X_test)

    predictions_np = predictions.numpy()
    actual_np = y_test.numpy()

    mae = mean_absolute_error(
        actual_np,
        predictions_np
    )

    mse = mean_squared_error(
        actual_np,
        predictions_np
    )

    rmse = np.sqrt(mse)

    # -----------------------------------------------------
    # Classification accuracy
    # -----------------------------------------------------

    predicted_classes = (
        predictions_np >= 0.5
    ).astype(int)

    actual_classes = (
        actual_np >= 0.5
    ).astype(int)

    classification_accuracy = (
        np.mean(
            predicted_classes == actual_classes
        ) * 100
    )

    print("\n========================================")
    print("PyTorch Model Evaluation")
    print("========================================")

    print(f"Training Records : {len(X_train)}")
    print(f"Test Records     : {len(X_test)}")

    print(
        f"Classification Accuracy : "
        f"{classification_accuracy:.2f}%"
    )

    print(
        f"MAE : {mae:.4f}"
    )

    print(
        f"RMSE : {rmse:.4f}"
    )

    # =====================================================
    # Save model
    # =====================================================

    torch.save(
        model.state_dict(),
        "pytorch_behavior_model.pth"
    )

    print("\nModel saved successfully:")

    print(
        "pytorch_behavior_model.pth"
    )

    print("\n========================================")
    print("Training Completed")
    print("========================================")


# =========================================================
# Run training
# =========================================================

if __name__ == "__main__":

    train_model()