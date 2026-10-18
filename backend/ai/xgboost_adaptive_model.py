"""
XGBoost Adaptive Difficulty Model

Uses previous challenge performance to predict
the probability that the user will successfully
complete a challenge at each difficulty level.
"""

from xgboost import XGBClassifier
import numpy as np


DIFFICULTY_MAP = {
    "easy": 0,
    "medium": 1,
    "hard": 2
}


def prepare_training_data(training_rows):
    X = []
    y = []

    if not training_rows:
        return np.array([]), np.array([])

    training_rows = list(reversed(training_rows))

    correct_so_far = 0

    for index, row in enumerate(training_rows):

        previous_accuracy = (
            0
            if index == 0
            else (correct_so_far / index) * 100
        )

        time_taken = row.get("time_taken") or 0
        attempts = row.get("attempts") or 1
        difficulty = row.get("difficulty")

        if difficulty not in DIFFICULTY_MAP:
            continue

        X.append([
            previous_accuracy,
            float(time_taken),
            float(attempts),
            DIFFICULTY_MAP[difficulty]
        ])

        y.append(
            1 if row.get("is_correct") else 0
        )

        if row.get("is_correct"):
            correct_so_far += 1

    return np.array(X), np.array(y)


def train_model(training_rows):

    X, y = prepare_training_data(training_rows)

    # XGBoost needs enough examples
    if len(X) < 5:
        return None

    # Binary classification needs both classes
    if len(set(y)) < 2:
        return None

    model = XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42
    )

    model.fit(X, y)

    return model


def predict_best_difficulty(
    training_rows,
    current_accuracy,
    average_time,
    average_attempts,
    current_difficulty="easy"
):

    model = train_model(training_rows)

    # If insufficient data, use the existing rule-based fallback
    if model is None:

        if (
            current_accuracy >= 80
            and average_attempts <= 1.5
            and (
                average_time is None
                or average_time <= 15
            )
        ):

            if current_difficulty == "easy":
                selected = "medium"
            elif current_difficulty == "medium":
                selected = "hard"
            else:
                selected = "hard"

        elif (
            current_accuracy <= 50
            or average_attempts >= 2.5
            or (
                average_time is not None
                and average_time > 30
            )
        ):

            if current_difficulty == "hard":
                selected = "medium"
            elif current_difficulty == "medium":
                selected = "easy"
            else:
                selected = "easy"

        else:
            selected = current_difficulty

        return {
            "difficulty": selected,
            "method": "xgboost-fallback",
            "confidence": None,
            "predictions": None
        }

    predictions = {}

    for difficulty, difficulty_value in DIFFICULTY_MAP.items():

        features = np.array([[
            float(current_accuracy),
            float(average_time or 0),
            float(average_attempts),
            difficulty_value
        ]])

        probability = model.predict_proba(features)[0][1]

        predictions[difficulty] = float(probability)

    # Select the highest predicted success probability
    selected = max(
        predictions,
        key=predictions.get
    )

    return {
        "difficulty": selected,
        "method": "xgboost",
        "confidence": round(
            predictions[selected] * 100,
            2
        ),
        "predictions": {
            difficulty: round(
                probability * 100,
                2
            )
            for difficulty, probability
            in predictions.items()
        }
    }