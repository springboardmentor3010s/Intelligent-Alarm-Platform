from sklearn.tree import DecisionTreeClassifier


# Difficulty levels
DIFFICULTY_LEVELS = [
    "Beginner",
    "Easy",
    "Medium",
    "Hard",
    "Expert"
]


# Training data
# [accuracy, completion_rate, snooze_count, wake_consistency, previous_difficulty]

X = [
    [20, 30, 5, 30, 0],
    [30, 40, 4, 40, 0],
    [40, 50, 3, 45, 1],

    [50, 60, 2, 60, 1],
    [55, 65, 2, 65, 1],

    [65, 70, 1, 70, 2],
    [70, 75, 1, 75, 2],

    [75, 80, 1, 80, 2],
    [80, 85, 1, 85, 3],

    [85, 90, 0, 90, 3],
    [90, 95, 0, 95, 3],

    [95, 100, 0, 95, 4],
    [100, 100, 0, 100, 4]
]


# Expected output for training data
y = [
    "Beginner",
    "Beginner",
    "Easy",

    "Easy",
    "Easy",

    "Medium",
    "Medium",

    "Medium",
    "Hard",

    "Hard",
    "Hard",

    "Expert",
    "Expert"
]


# Create Decision Tree ML model
model = DecisionTreeClassifier(
    max_depth=4,
    random_state=42
)


# Train the model
model.fit(X, y)


# Function to predict difficulty
def predict_difficulty(
    accuracy,
    completion_rate,
    snooze_count,
    wake_consistency,
    previous_difficulty
):

    if previous_difficulty not in DIFFICULTY_LEVELS:
        previous_difficulty = "Easy"

    previous_index = DIFFICULTY_LEVELS.index(
        previous_difficulty
    )

    features = [[
        float(accuracy),
        float(completion_rate),
        float(snooze_count),
        float(wake_consistency),
        previous_index
    ]]

    # ML prediction
    prediction = model.predict(features)[0]

    # Prediction confidence
    probabilities = model.predict_proba(features)[0]

    confidence = round(
        float(max(probabilities)) * 100,
        2
    )

    return {
        "difficulty": prediction,
        "confidence": confidence,
        "model": "Decision Tree Classifier"
    }