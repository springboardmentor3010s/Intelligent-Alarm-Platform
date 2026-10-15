def analyze_performance(results):
    """
    Analyze recent challenge results.

    results should contain boolean values:
    True  = correct
    False = incorrect
    """

    if not results:
        return {
            "total": 0,
            "correct": 0,
            "incorrect": 0,
            "accuracy": 0,
        }

    total = len(results)
    correct = sum(results)
    incorrect = total - correct

    accuracy = (correct / total) * 100

    return {
        "total": total,
        "correct": correct,
        "incorrect": incorrect,
        "accuracy": round(accuracy, 2),
    }