def combine_predictions(
    sklearn_predictions,
    xgboost_predictions,
    tensorflow_predictions
):
    """
    Combine Scikit-learn, XGBoost, and TensorFlow predictions.

    Weights:
        Scikit-learn = 35%
        XGBoost      = 35%
        TensorFlow   = 30%
    """

    weights = {
        "sklearn": 0.35,
        "xgboost": 0.35,
        "tensorflow": 0.30,
    }

    ensemble_predictions = {}

    for difficulty in ["easy", "medium", "hard"]:
        sklearn_score = float(
            sklearn_predictions.get(difficulty, 0) or 0
        )

        xgboost_score = float(
            xgboost_predictions.get(difficulty, 0) or 0
        )

        tensorflow_data = tensorflow_predictions.get(
            difficulty, {}
        ) or {}

        tensorflow_score = float(
            tensorflow_data.get("percentage", 0) or 0
        )

        combined_score = (
            weights["sklearn"] * sklearn_score
            + weights["xgboost"] * xgboost_score
            + weights["tensorflow"] * tensorflow_score
        )

        ensemble_predictions[difficulty] = round(
            combined_score, 2
        )

    selected_difficulty = max(
        ensemble_predictions,
        key=ensemble_predictions.get
    )

    confidence = ensemble_predictions[selected_difficulty]

    return {
        "difficulty": selected_difficulty,
        "confidence": confidence,
        "predictions": ensemble_predictions,
        "method": "ai-ensemble"
    }
