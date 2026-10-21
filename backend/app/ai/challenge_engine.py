"""
challenge_engine.py

AI Cognitive Challenge generation engine.
Supports all 7 official challenge types:
  math, logic, memory, word, pattern, riddle, quiz
And all 5 official difficulty tiers:
  beginner, easy, medium, hard, expert
"""

from ..services.challenge_service import (
    generate_questions,
    create_challenge,
    answers_match,
    SUPPORTED_CHALLENGE_TYPES,
    SUPPORTED_DIFFICULTIES,
)


def generate_challenge_question(challenge_type="math", difficulty="medium"):
    """Generate a single challenge question."""
    questions = generate_questions(
        challenge_type=challenge_type,
        difficulty=difficulty,
        count=1,
    )
    return questions[0] if questions else {"question": "What is 2 + 2?", "answer": "4"}