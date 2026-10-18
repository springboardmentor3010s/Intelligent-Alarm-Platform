import torch
import torch.nn as nn


class BehaviorPredictionModel(nn.Module):
    """
    PyTorch model for learning user challenge behavior.

    Input features:
        1. Challenge accuracy (%)
        2. Average attempts
        3. Average response time (seconds)
        4. Recent performance (%)
        5. Difficulty level (0=Easy, 1=Medium, 2=Hard)

    Output:
        Predicted performance score (%)
    """

    def __init__(self):
        super().__init__()

        self.network = nn.Sequential(
            nn.Linear(5, 16),
            nn.ReLU(),

            nn.Linear(16, 8),
            nn.ReLU(),

            nn.Linear(8, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        return self.network(x)


def create_model():
    """Create a new PyTorch behavior model."""
    return BehaviorPredictionModel()


def predict_behavior(
    accuracy,
    average_attempts,
    average_time,
    recent_performance,
    difficulty
):
    """
    Generate a behavior prediction using the PyTorch model.

    This is currently the prediction component.
    Training will be connected to real project data next.
    """

    model = create_model()

    # Convert difficulty to numerical value
    difficulty_map = {
        "easy": 0,
        "medium": 1,
        "hard": 2
    }

    if isinstance(difficulty, str):
        difficulty = difficulty_map.get(difficulty.lower(), 0)

    # Normalize input values
    features = torch.tensor([
        [
            accuracy / 100.0,
            min(average_attempts / 5.0, 1.0),
            min(average_time / 60.0, 1.0),
            recent_performance / 100.0,
            difficulty / 2.0
        ]
    ], dtype=torch.float32)

    model.eval()

    with torch.no_grad():
        prediction = model(features).item()

    return round(prediction * 100, 2)


if __name__ == "__main__":
    # Simple standalone test
    prediction = predict_behavior(
        accuracy=80,
        average_attempts=1.2,
        average_time=15,
        recent_performance=85,
        difficulty="medium"
    )

    print("PyTorch Behavior Prediction:", prediction)