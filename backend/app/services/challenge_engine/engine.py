from app.services.challenge_engine.extra_generators import (
    generate_extra_logic,
    generate_extra_word,
    generate_pattern_challenge,
    generate_quiz_challenge,
    generate_riddle_challenge,
)
from app.services.challenge_engine.logic_generator import (
    generate_logic_challenge,
)
from app.services.challenge_engine.math_generator import (
    generate_math_challenge,
)
from app.services.challenge_engine.memory_generator import (
    generate_memory_challenge,
)
from app.services.challenge_engine.word_generator import (
    generate_word_challenge,
)

DIFFICULTY_LEVELS = ["beginner", "easy", "medium", "hard", "expert"]
CHALLENGE_TYPES = [
    "math",
    "logic",
    "memory",
    "word",
    "pattern",
    "riddle",
    "quiz",
]


class ChallengeEngine:
    """
    Central engine responsible for generating
    cognitive challenges based on type and difficulty.
    """

    def generate_challenge(
        self,
        challenge_type: str,
        difficulty: str,
    ) -> dict:

        challenge_type = challenge_type.lower()
        difficulty = difficulty.lower()

        if difficulty not in DIFFICULTY_LEVELS:
            raise ValueError(
                "Invalid difficulty. Use beginner, easy, "
                "medium, hard, or expert."
            )

        if challenge_type == "math":
            return generate_math_challenge(difficulty)

        if challenge_type == "logic":
            if difficulty in {"beginner", "expert"}:
                return generate_extra_logic(difficulty)
            return generate_logic_challenge(difficulty)

        if challenge_type == "memory":
            return generate_memory_challenge(difficulty)

        if challenge_type == "word":
            if difficulty in {"beginner", "expert"}:
                return generate_extra_word(difficulty)
            return generate_word_challenge(difficulty)

        if challenge_type == "pattern":
            return generate_pattern_challenge(difficulty)

        if challenge_type == "riddle":
            return generate_riddle_challenge(difficulty)

        if challenge_type == "quiz":
            return generate_quiz_challenge(difficulty)

        raise ValueError(
            f"Unsupported challenge type: {challenge_type}"
        )


challenge_engine = ChallengeEngine()
