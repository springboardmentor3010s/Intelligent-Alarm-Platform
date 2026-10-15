import random


class MathChallengeGenerator:
    """
    Generates mathematical cognitive challenges
    based on the requested difficulty level.
    """

    def generate(self, difficulty: str) -> dict:
        difficulty = difficulty.lower()

        if difficulty == "beginner":
            return self._generate_beginner()

        if difficulty == "expert":
            return self._generate_expert()

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

    def _generate_beginner(self) -> dict:
        operation = random.choice(["+", "-"])

        first = random.randint(2, 9)
        second = random.randint(1, 9)

        if operation == "-" and second > first:
            first, second = second, first

        answer = (
            first + second
            if operation == "+"
            else first - second
        )

        return {
            "challenge_type": "math",
            "difficulty": "beginner",
            "question": f"What is {first} {operation} {second}?",
            "correct_answer": str(answer),
            "options": None,
        }

    def _generate_expert(self) -> dict:
        a = random.randint(10, 60)
        b = random.randint(5, 40)
        c = random.randint(3, 12)
        d = random.randint(10, 90)

        expression = f"({a} + {b}) * {c} - {d}"
        answer = (a + b) * c - d

        return {
            "challenge_type": "math",
            "difficulty": "expert",
            "question": f"Solve: {expression}",
            "correct_answer": str(answer),
            "options": None,
        }

    def _generate_easy(self) -> dict:
        operation = random.choice(["+", "-"])

        first = random.randint(5, 30)
        second = random.randint(1, 20)

        if operation == "-" and second > first:
            first, second = second, first

        answer = (
            first + second
            if operation == "+"
            else first - second
        )

        question = f"What is {first} {operation} {second}?"

        return {
            "challenge_type": "math",
            "difficulty": "easy",
            "question": question,
            "correct_answer": str(answer),
            "options": None,
        }

    def _generate_medium(self) -> dict:
        operation = random.choice(["*", "+", "-"])

        if operation == "*":
            first = random.randint(5, 15)
            second = random.randint(2, 10)
            answer = first * second

        elif operation == "+":
            first = random.randint(20, 100)
            second = random.randint(10, 80)
            answer = first + second

        else:
            first = random.randint(30, 100)
            second = random.randint(10, first)
            answer = first - second

        question = f"What is {first} {operation} {second}?"

        return {
            "challenge_type": "math",
            "difficulty": "medium",
            "question": question,
            "correct_answer": str(answer),
            "options": None,
        }

    @staticmethod
    def _evaluate(a: int, op1: str, b: int, op2: str, c: int) -> int:
        """Evaluate a op1 b op2 c with * before + and -, without eval()."""
        if op1 == "*":
            left = a * b
            return left + c if op2 == "+" else left - c
        right = b * c
        return a + right if op1 == "+" else a - right

    def _generate_hard(self) -> dict:
        first = random.randint(10, 50)
        second = random.randint(2, 20)
        third = random.randint(2, 20)

        operation1, operation2 = random.choice(
            [
                ("+", "*"),
                ("-", "*"),
                ("*", "+"),
                ("*", "-"),
            ]
        )

        expression = (
            f"{first} {operation1} "
            f"{second} {operation2} {third}"
        )

        answer = self._evaluate(
            first, operation1, second, operation2, third
        )

        question = f"Solve: {expression}"

        return {
            "challenge_type": "math",
            "difficulty": "hard",
            "question": question,
            "correct_answer": str(answer),
            "options": None,
        }


def generate_math_challenge(difficulty: str) -> dict:
    """
    Convenience function for generating a math challenge.
    """

    generator = MathChallengeGenerator()

    return generator.generate(difficulty)
