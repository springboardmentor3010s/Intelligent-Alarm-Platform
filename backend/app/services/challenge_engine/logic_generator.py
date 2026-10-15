import random


class LogicChallengeGenerator:
    """
    Generates logical reasoning challenges
    based on the requested difficulty level.
    """

    def generate(self, difficulty: str) -> dict:
        difficulty = difficulty.lower()

        if difficulty == "easy":
            return self._generate_easy()

        if difficulty == "medium":
            return self._generate_medium()

        if difficulty == "hard":
            return self._generate_hard()

        raise ValueError(
            "Invalid difficulty. Use easy, medium, or hard."
        )

    def _generate_easy(self) -> dict:
        questions = [
            {
                "question": "If all cats are animals and Tom is a cat, is Tom an animal?",
                "answer": "yes",
            },
            {
                "question": "If today is Monday, what day will it be tomorrow?",
                "answer": "tuesday",
            },
            {
                "question": "If 5 birds are on a tree and 2 fly away, how many remain?",
                "answer": "3",
            },
        ]

        challenge = random.choice(questions)

        return {
            "challenge_type": "logic",
            "difficulty": "easy",
            "question": challenge["question"],
            "correct_answer": challenge["answer"],
            "options": None,
        }

    def _generate_medium(self) -> dict:
        questions = [
            {
                "question": "A clock shows 3:00. What angle is formed between the hour and minute hands?",
                "answer": "90",
            },
            {
                "question": "If 3 workers complete a task in 6 days, how many worker-days are required?",
                "answer": "18",
            },
            {
                "question": "A train travels 60 km in 1 hour. How far will it travel in 3 hours?",
                "answer": "180",
            },
        ]

        challenge = random.choice(questions)

        return {
            "challenge_type": "logic",
            "difficulty": "medium",
            "question": challenge["question"],
            "correct_answer": challenge["answer"],
            "options": None,
        }

    def _generate_hard(self) -> dict:
        questions = [
            {
                "question": "A farmer has chickens and cows. There are 10 heads and 28 legs. How many cows are there?",
                "answer": "4",
            },
            {
                "question": "If 5 machines make 5 products in 5 minutes, how many minutes will 100 machines need to make 100 products?",
                "answer": "5",
            },
            {
                "question": "A number is doubled and then increased by 10 to get 30. What is the number?",
                "answer": "10",
            },
        ]

        challenge = random.choice(questions)

        return {
            "challenge_type": "logic",
            "difficulty": "hard",
            "question": challenge["question"],
            "correct_answer": challenge["answer"],
            "options": None,
        }


def generate_logic_challenge(difficulty: str) -> dict:
    """
    Convenience function for generating a logic challenge.
    """

    generator = LogicChallengeGenerator()

    return generator.generate(difficulty)
