import numpy as np
import tensorflow as tf
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Dense, Input


DIFFICULTY_MAP = {
    "easy": 0,
    "medium": 1,
    "hard": 2,
}


def prepare_training_data(training_rows):
    """
    Convert challenge history into TensorFlow training data.

    Features:
    1. Previous accuracy
    2. Time taken
    3. Number of attempts
    4. Challenge difficulty

    Target:
    0 = incorrect
    1 = correct
    """

    X = []
    y = []

    if not training_rows:
        return np.array([]), np.array([])

    # Oldest → newest
    rows = list(reversed(training_rows))

    correct_so_far = 0

    for index, row in enumerate(rows):

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
            DIFFICULTY_MAP[difficulty],
        ])

        y.append(
            1 if row.get("is_correct") else 0
        )

        if row.get("is_correct"):
            correct_so_far += 1

    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)


def build_model():
    """
    Create the TensorFlow neural network.
    """

    model = Sequential([
        Input(shape=(4,)),

        Dense(16, activation="relu"),

        Dense(8, activation="relu"),

        Dense(1, activation="sigmoid"),
    ])

    model.compile(
        optimizer="adam",
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )

    return model


def train_model(training_rows):
    """
    Train TensorFlow model using challenge history.
    """

    X, y = prepare_training_data(training_rows)

    # Need enough historical data
    if len(X) < 10:
        return None

    # Need both correct and incorrect examples
    if len(set(y.tolist())) < 2:
        return None

    model = build_model()

    model.fit(
        X,
        y,
        epochs=30,
        batch_size=8,
        verbose=0,
    )

    return model


def predict_success_probability(
    training_rows,
    current_accuracy,
    average_time,
    average_attempts,
    difficulty="easy",
):
    """
    Predict probability that the user will correctly
    solve a challenge of the given difficulty.
    """

    model = train_model(training_rows)

    # Not enough history yet
    if model is None:
        return {
            "probability": None,
            "percentage": None,
            "method": "tensorflow-not-enough-data",
        }

    difficulty_value = DIFFICULTY_MAP.get(
        difficulty,
        0,
    )

    features = np.array(
        [[
            float(current_accuracy),
            float(average_time or 0),
            float(average_attempts or 1),
            difficulty_value,
        ]],
        dtype=np.float32,
    )

    probability = float(
        model.predict(features, verbose=0)[0][0]
    )

    probability = max(
        0.0,
        min(1.0, probability),
    )

    return {
        "probability": round(probability, 4),
        "percentage": round(probability * 100, 2),
        "method": "tensorflow",
    }