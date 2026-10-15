import random


class MemoryChallengeGenerator:
    """
    Generates memory-based cognitive challenges
    based on the requested difficulty level.
    """

    def generate(self, difficulty: str) -> dict:
        difficulty = difficulty.lower()

        if difficulty == "beginner":
            return self._generate_sequence("beginner", 3)

        if difficulty == "expert":
            return self._generate_sequence("expert", 10)

        if difficulty == "easy":
            return self._generate_easy()

        if difficulty == "medium":
            return self._generate_medium()

        if difficulty == "hard":
            return self._generate_hard()

        raise ValueError(
            "Invalid difficulty. Use beginner, easy, medium, "
            "hard, or expert."
        )

    def _generate_sequence(self, difficulty: str, length: int) -> dict:
        sequence = "".join(
            random.choices("0123456789", k=length)
        )

        return {
            "challenge_type": "memory",
            "difficulty": difficulty,
            "question": (
                f"Remember this sequence: {sequence}. "
                "What was the sequence?"
            ),
            "correct_answer": sequence,
            "options": None,
        }

    def _generate_easy(self) -> dict:
        sequence = "".join(
            random.choices("0123456789", k=4)
        )

        question = (
            f"Remember this sequence: {sequence}. "
            "What was the sequence?"
        )

        return {
            "challenge_type": "memory",
            "difficulty": "easy",
            "question": question,
            "correct_answer": sequence,
            "options": None,
        }

    def _generate_medium(self) -> dict:
        sequence = "".join(
            random.choices("0123456789", k=6)
        )

        question = (
            f"Remember this sequence: {sequence}. "
            "What was the sequence?"
        )

        return {
            "challenge_type": "memory",
            "difficulty": "medium",
            "question": question,
            "correct_answer": sequence,
            "options": None,
        }

    def _generate_hard(self) -> dict:
        sequence = "".join(
            random.choices("0123456789", k=8)
        )

        question = (
            f"Remember this sequence: {sequence}. "
            "What was the sequence?"
        )

        return {
            "challenge_type": "memory",
            "difficulty": "hard",
            "question": question,
            "correct_answer": sequence,
            "options": None,
        }


def generate_memory_challenge(difficulty: str) -> dict:
    """
    Convenience function for generating a memory challenge.
    """

    generator = MemoryChallengeGenerator()

    return generator.generate(difficulty)