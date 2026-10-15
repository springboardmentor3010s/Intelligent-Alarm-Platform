
import random


def generate_word_challenge(difficulty: str) -> dict:
    """
    Generate a word-based cognitive challenge
    based on the selected difficulty.
    """

    difficulty = difficulty.lower()

    challenges = {
        "easy": [
            {
                "question": "Which word is the opposite of 'hot'?",
                "answer": "cold",
                "options": ["cold", "warm", "heat", "fire"],
            },
            {
                "question": "Which word is a fruit?",
                "answer": "apple",
                "options": ["carrot", "apple", "potato", "onion"],
            },
            {
                "question": "Which word is a synonym of 'quick'?",
                "answer": "fast",
                "options": ["slow", "fast", "late", "weak"],
            },
        ],
        "medium": [
            {
                "question": "Which word does NOT belong: Apple, Mango, Carrot, Banana?",
                "answer": "carrot",
                "options": ["Apple", "Mango", "Carrot", "Banana"],
            },
            {
                "question": "Which word is closest in meaning to 'ancient'?",
                "answer": "old",
                "options": ["new", "modern", "old", "future"],
            },
            {
                "question": "Which word is the opposite of 'expand'?",
                "answer": "contract",
                "options": ["increase", "contract", "grow", "extend"],
            },
        ],
        "hard": [
            {
                "question": "Which word does NOT belong: Mercury, Venus, Mars, Moon?",
                "answer": "moon",
                "options": ["Mercury", "Venus", "Mars", "Moon"],
            },
            {
                "question": "Which word is closest in meaning to 'meticulous'?",
                "answer": "careful",
                "options": ["careless", "careful", "quick", "uncertain"],
            },
            {
                "question": "Which word is the opposite of 'ambiguous'?",
                "answer": "clear",
                "options": ["uncertain", "confusing", "clear", "complex"],
            },
        ],
    }

    if difficulty not in challenges:
        raise ValueError(
            f"Unsupported difficulty level: {difficulty}"
        )

    challenge = random.choice(challenges[difficulty])

    return {
        "challenge_type": "word",
        "difficulty": difficulty,
        "question": challenge["question"],
        "correct_answer": challenge["answer"],
        "options": challenge["options"],
    }
