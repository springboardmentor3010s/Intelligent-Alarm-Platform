import random


# =========================================================
# MATH
# =========================================================

def generate_math_challenge(difficulty="medium"):
    if difficulty == "beginner":
        a = random.randint(1, 10)
        b = random.randint(1, 10)
        operations = ["+", "-"]

    elif difficulty == "easy":
        a = random.randint(5, 20)
        b = random.randint(5, 20)
        operations = ["+", "-", "*"]

    elif difficulty == "hard":
        a = random.randint(20, 100)
        b = random.randint(10, 50)
        operations = ["+", "-", "*"]

    elif difficulty == "expert":
        a = random.randint(50, 200)
        b = random.randint(10, 100)
        operations = ["+", "-", "*"]

    else:
        a = random.randint(10, 50)
        b = random.randint(5, 30)
        operations = ["+", "-", "*"]

    operation = random.choice(operations)

    if operation == "+":
        answer = a + b

    elif operation == "-":
        answer = a - b

    else:
        answer = a * b

    return {
        "challenge_type": "math",
        "question": f"What is {a} {operation} {b}?",
        "correct_answer": str(answer),
        "difficulty": difficulty,
    }


# =========================================================
# MEMORY
# =========================================================

def generate_memory_challenge(difficulty="medium"):

    if difficulty == "beginner":
        length = 3

    elif difficulty == "easy":
        length = 4

    elif difficulty == "hard":
        length = 6

    elif difficulty == "expert":
        length = 8

    else:
        length = 5

    numbers = [
        random.randint(1, 9)
        for _ in range(length)
    ]

    sequence = " ".join(map(str, numbers))

    return {
        "challenge_type": "memory",
        "question": (
            f"Remember this sequence: {sequence}. "
            "Enter the numbers in the same order."
        ),
        "correct_answer": sequence,
        "difficulty": difficulty,
    }

# =========================================================
# LOGIC
# =========================================================

def generate_logic_challenge(difficulty="medium"):

    if difficulty == "beginner":
        number = random.randint(1, 5)
        multiplier = 2

    elif difficulty == "easy":
        number = random.randint(2, 10)
        multiplier = 2

    elif difficulty == "hard":
        number = random.randint(5, 15)
        multiplier = 3

    elif difficulty == "expert":
        number = random.randint(5, 20)
        multiplier = 4

    else:
        number = random.randint(2, 10)
        multiplier = 2

    # Example:
    # number = 8, multiplier = 2
    # 8 → 16 → 32 → 64

    sequence = [
        number,
        number * multiplier,
        number * multiplier * multiplier,
    ]

    # The next number follows the same multiplication pattern
    answer = sequence[-1] * multiplier

    return {
        "challenge_type": "logic",
        "question": (
            f"What is the next number in this sequence: "
            f"{sequence[0]}, {sequence[1]}, {sequence[2]}, ?"
        ),
        "correct_answer": str(answer),
        "difficulty": difficulty,
    }
# =========================================================
# WORD GAME
# =========================================================

def generate_word_challenge(difficulty="medium"):

    words = [
        ("APPLE", "How many letters are in the word APPLE?", "5"),
        ("PYTHON", "How many letters are in the word PYTHON?", "6"),
        ("COMPUTER", "How many letters are in the word COMPUTER?", "8"),
        ("ALARM", "How many letters are in the word ALARM?", "5"),
        ("COGNITIVE", "How many letters are in the word COGNITIVE?", "9"),
    ]

    word, question, answer = random.choice(words)

    return {
        "challenge_type": "word",
        "question": question,
        "correct_answer": answer,
        "difficulty": difficulty,
    }


# =========================================================
# PATTERN RECOGNITION
# =========================================================

def generate_pattern_challenge(difficulty="medium"):

    start = random.randint(1, 10)

    step = {
        "beginner": 1,
        "easy": 2,
        "medium": 3,
        "hard": 5,
        "expert": 7,
    }.get(difficulty, 3)

    numbers = [
        start,
        start + step,
        start + step * 2,
        start + step * 3,
    ]

    answer = start + step * 4

    return {
        "challenge_type": "pattern",
        "question": (
            f"Find the missing number: "
            f"{numbers[0]}, {numbers[1]}, "
            f"{numbers[2]}, {numbers[3]}, ?"
        ),
        "correct_answer": str(answer),
        "difficulty": difficulty,
    }


# =========================================================
# RIDDLE
# =========================================================

def generate_riddle_challenge(difficulty="medium"):

    riddles = [
        {
            "question": "I have hands but cannot clap. What am I?",
            "answer": "clock",
        },
        {
            "question": "I have keys but cannot open locks. What am I?",
            "answer": "keyboard",
        },
        {
            "question": "I am full of holes but can hold water. What am I?",
            "answer": "sponge",
        },
        {
            "question": "What has a face and two hands but no arms or legs?",
            "answer": "clock",
        },
    ]

    riddle = random.choice(riddles)

    return {
        "challenge_type": "riddle",
        "question": riddle["question"],
        "correct_answer": riddle["answer"],
        "difficulty": difficulty,
    }


# =========================================================
# QUICK QUIZ
# =========================================================

def generate_quiz_challenge(difficulty="medium"):

    questions = [
        {
            "question": "What is the capital of India?",
            "answer": "new delhi",
        },
        {
            "question": "How many days are there in a week?",
            "answer": "7",
        },
        {
            "question": "Which planet is known as the Red Planet?",
            "answer": "mars",
        },
        {
            "question": "What is 10 + 15?",
            "answer": "25",
        },
        {
            "question": "Which language is primarily used with React?",
            "answer": "javascript",
        },
    ]

    quiz = random.choice(questions)

    return {
        "challenge_type": "quiz",
        "question": quiz["question"],
        "correct_answer": quiz["answer"],
        "difficulty": difficulty,
    }


# =========================================================
# MAIN CHALLENGE GENERATOR
# =========================================================

def generate_challenge(
    challenge_type=None,
    difficulty="medium",
):

    supported_types = [
        "math",
        "logic",
        "memory",
        "word",
        "pattern",
        "riddle",
        "quiz",
    ]

    supported_difficulties = [
        "beginner",
        "easy",
        "medium",
        "hard",
        "expert",
    ]

    if challenge_type is None:
        challenge_type = random.choice(supported_types)

    challenge_type = challenge_type.lower()
    difficulty = difficulty.lower()

    if challenge_type not in supported_types:
        raise ValueError(
            f"Unsupported challenge type: {challenge_type}"
        )

    if difficulty not in supported_difficulties:
        difficulty = "medium"

    if challenge_type == "math":
        return generate_math_challenge(difficulty)

    if challenge_type == "memory":
        return generate_memory_challenge(difficulty)

    if challenge_type == "logic":
        return generate_logic_challenge(difficulty)

    if challenge_type == "word":
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