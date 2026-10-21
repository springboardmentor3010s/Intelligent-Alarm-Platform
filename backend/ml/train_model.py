import pandas as pd
import numpy as np
import joblib
import os

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier


def generate_synthetic_data(num_samples=10000):
    """
    Synthetic data for Adaptive Difficulty Engine.

    Features:
    0 = correctness ratio
    1 = average solve time
    2 = total attempts
    3 = current difficulty

    Labels:
    0 = Low
    1 = Medium
    2 = High
    """

    np.random.seed(42)

    data = []
    labels = []

    difficulties = np.random.randint(0, 4, num_samples)

    for diff in difficulties:

        correctness = np.random.uniform(0, 1)
        solve_time = np.random.uniform(5, 120)
        attempts = np.random.randint(1, 6)

        # Performance scoring logic
        if (
            correctness < 0.5
            or solve_time > 60
            or attempts >= 4
        ):
            label = 0

        elif (
            correctness >= 0.85
            and solve_time <= 25
            and attempts <= 2
        ):
            label = 2

        else:
            label = 1

        data.append([
            correctness,
            solve_time,
            attempts,
            diff
        ])

        labels.append(label)

    df = pd.DataFrame(
        data,
        columns=[
            "correctness",
            "solve_time",
            "attempt_count",
            "difficulty_level"
        ]
    )

    return df, np.array(labels)


def train():

    print("Generating synthetic data...")

    X, y = generate_synthetic_data(10000)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y
    )

    # -------------------------------------------------
    # Random Forest
    # -------------------------------------------------

    print("Training Random Forest...")

    rf_model = RandomForestClassifier(
        n_estimators=150,
        max_depth=10,
        random_state=42,
        class_weight="balanced"
    )

    rf_model.fit(X_train, y_train)

    # -------------------------------------------------
    # XGBoost
    # -------------------------------------------------

    print("Training XGBoost...")

    xgb_model = XGBClassifier(
        n_estimators=150,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="multi:softprob",
        num_class=3,
        eval_metric="mlogloss",
        random_state=42
    )

    xgb_model.fit(X_train, y_train)

    # -------------------------------------------------
    # Evaluation Accuracy
    # -------------------------------------------------

    rf_train_accuracy = rf_model.score(X_train, y_train)
    rf_test_accuracy = rf_model.score(X_test, y_test)
    xgb_train_accuracy = xgb_model.score(X_train, y_train)
    xgb_test_accuracy = xgb_model.score(X_test, y_test)

    print(f"Random Forest Training Accuracy: {rf_train_accuracy * 100:.2f}%")
    print(f"Random Forest Test Accuracy: {rf_test_accuracy * 100:.2f}%")
    print(f"XGBoost Training Accuracy: {xgb_train_accuracy * 100:.2f}%")
    print(f"XGBoost Test Accuracy: {xgb_test_accuracy * 100:.2f}%")

    # -------------------------------------------------
    # Save models
    # -------------------------------------------------

    base_dir = os.path.dirname(__file__)

    rf_path = os.path.join(
        base_dir,
        "rf_model.pkl"
    )

    xgb_path = os.path.join(
        base_dir,
        "xgb_model.json"
    )

    joblib.dump(rf_model, rf_path)
    xgb_model.save_model(xgb_path)

    print("Random Forest saved:", rf_path)
    print("XGBoost saved:", xgb_path)


if __name__ == "__main__":
    train()