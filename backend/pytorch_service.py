import os
import torch
import torch.nn as nn


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
# Load trained model
# =========================================================

MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "pytorch_behavior_model.pth"
)


def load_model():

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"PyTorch model not found: {MODEL_PATH}"
        )

    model = BehaviorPredictionModel()

    model.load_state_dict(
        torch.load(
            MODEL_PATH,
            map_location=torch.device("cpu")
        )
    )

    model.eval()

    return model


# =========================================================
# Predict user behavior
# =========================================================

def predict_user_behavior(
    previous_accuracy,
    previous_attempts,
    previous_time,
    performance_trend
):
    """
    Predict the probability that the user will
    successfully complete the next challenge.

    Inputs:
        previous_accuracy  : previous challenge accuracy (0-1)
        previous_attempts  : average previous attempts
        previous_time      : average previous response time
        performance_trend  : normalized trend (0-1)

    Returns:
        predicted performance probability
        predicted percentage
        prediction class
    """

    model = load_model()

    # Same preprocessing used during training
    features = torch.tensor(
        [[
            previous_accuracy,
            min(previous_attempts / 5.0, 1.0),
            min(previous_time / 60.0, 1.0),
            performance_trend
        ]],
        dtype=torch.float32
    )

    with torch.no_grad():

        prediction = model(features).item()

    prediction_percentage = round(
        prediction * 100,
        2
    )

    if prediction >= 0.5:

        prediction_class = "likely_success"

    else:

        prediction_class = "likely_difficulty"

    return {
        "predicted_probability": round(
            prediction,
            4
        ),
        "predicted_performance_percentage":
            prediction_percentage,
        "prediction_class":
            prediction_class
    }


# =========================================================
# Standalone test
# =========================================================

if __name__ == "__main__":

    result = predict_user_behavior(
        previous_accuracy=0.75,
        previous_attempts=1.5,
        previous_time=20,
        performance_trend=0.5
    )

    print("\n========================================")
    print("PyTorch Behavior Prediction Test")
    print("========================================")

    print(
        "Predicted Probability:",
        result["predicted_probability"]
    )

    print(
        "Predicted Performance:",
        f'{result["predicted_performance_percentage"]}%'
    )

    print(
        "Prediction Class:",
        result["prediction_class"]
    )

    print("========================================")