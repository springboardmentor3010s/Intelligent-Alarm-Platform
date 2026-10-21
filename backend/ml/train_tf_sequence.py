import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping


def generate_synthetic_sequences(num_samples=10000, seq_length=7):
    """
    Generates synthetic 7-day sequences of user behavior.

    Features per day:
        [snooze_count, wake_up_delay_minutes]

    Labels:
        0 = Declining
        1 = Stable
        2 = Improving
    """

    np.random.seed(42)

    X = []
    y = []

    for _ in range(num_samples):

        trend = np.random.choice([0, 1, 2])

        sequence = []

        base_snooze = np.random.randint(1, 5)
        base_delay = np.random.uniform(5.0, 30.0)

        for day in range(seq_length):

            if trend == 0:
                # Declining:
                # snooze and wake-up delay increase
                snooze = (
                    base_snooze
                    + day
                    + np.random.randint(0, 2)
                )

                delay = (
                    base_delay
                    + (day * 5)
                    + np.random.uniform(-2, 2)
                )

            elif trend == 2:
                # Improving:
                # snooze and wake-up delay decrease
                snooze = max(
                    0,
                    base_snooze - day + np.random.randint(0, 2)
                )

                delay = max(
                    0,
                    base_delay - (day * 5)
                    + np.random.uniform(-2, 2)
                )

            else:
                # Stable
                snooze = (
                    base_snooze
                    + np.random.randint(-1, 2)
                )

                delay = (
                    base_delay
                    + np.random.uniform(-5, 5)
                )

            sequence.append([
                max(0, snooze),
                max(0, delay)
            ])

        X.append(sequence)
        y.append(trend)

    return np.array(X, dtype=np.float32), np.array(y)


def train_tf_sequence():

    print("Generating synthetic 7-day sequence data...")

    X, y = generate_synthetic_sequences(
        num_samples=10000,
        seq_length=7
    )

    y_categorical = tf.keras.utils.to_categorical(
        y,
        num_classes=3
    )

    print("Input shape:", X.shape)

    print("Building TensorFlow LSTM Model...")

    model = Sequential([
        LSTM(
            32,
            input_shape=(7, 2),
            return_sequences=False
        ),

        Dropout(0.2),

        Dense(
            16,
            activation="relu"
        ),

        Dense(
            3,
            activation="softmax"
        )
    ])

    model.compile(
        optimizer="adam",
        loss="categorical_crossentropy",
        metrics=["accuracy"]
    )

    early_stop = EarlyStopping(
        monitor="val_loss",
        patience=3,
        restore_best_weights=True
    )

    print("Training TensorFlow LSTM...")

    model.fit(
        X,
        y_categorical,
        epochs=10,
        batch_size=32,
        validation_split=0.2,
        callbacks=[early_stop],
        verbose=1
    )

    model_path = os.path.join(
        os.path.dirname(__file__),
        "tf_sequence_model.keras"
    )

    model.save(model_path)

    print(
        f"7-day LSTM model saved to: {model_path}"
    )


if __name__ == "__main__":
    train_tf_sequence()
