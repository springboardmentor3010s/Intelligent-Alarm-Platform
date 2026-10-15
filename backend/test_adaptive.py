from app.services.adaptive_difficulty import adjust_difficulty


tests = [
    ("beginner", True),
    ("easy", True),
    ("medium", True),
    ("hard", False),
    ("expert", True),
    ("medium", False),
]


for difficulty, correct in tests:
    new_difficulty = adjust_difficulty(
        difficulty,
        correct
    )

    print(
        f"Current: {difficulty} | "
        f"Correct: {correct} | "
        f"Next: {new_difficulty}"
    )