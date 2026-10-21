"""
challenge_service.py

Cognitive Challenge Generation and Validation Engine.
Implements all 7 challenge types from the official project specification:
  1. Math Problems (math)
  2. Logic Puzzles (logic)
  3. Memory Challenges (memory)
  4. Word Games (word)
  5. Pattern Recognition (pattern)
  6. Riddles (riddle)
  7. Quick Quizzes (quiz)

And supports all 5 official difficulty tiers:
  beginner, easy, medium, hard, expert
"""

import random
import re
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation

from ..models.challenge import Challenge

SUPPORTED_CHALLENGE_TYPES = [
    "math",
    "logic",
    "memory",
    "word",
    "pattern",
    "riddle",
    "quiz",
]

SUPPORTED_DIFFICULTIES = [
    "beginner",
    "easy",
    "medium",
    "hard",
    "expert",
]


def get_supported_challenge_types():
    return list(SUPPORTED_CHALLENGE_TYPES)


def resolve_challenge_difficulty(db, user, default_difficulty="medium"):
    """
    Resolve the active difficulty tier from user profile, alarm, or recent history.
    Never collapses beginner or expert — preserves the full 5-tier system.
    """
    history = (
        db.query(Challenge)
        .filter(Challenge.user_id == user.id, Challenge.is_correct.isnot(None))
        .order_by(Challenge.created_at.desc(), Challenge.question_number.desc())
        .limit(10)
        .all()
    )

    if not history:
        selected = default_difficulty or "medium"
    else:
        selected = getattr(user, "difficulty_preference", None) or (
            default_difficulty or "medium"
        )
    selected = selected.lower().strip()
    if selected in SUPPORTED_DIFFICULTIES:
        return selected
    return "medium"


def _normalise_question_key(value):
    return str(value or "").strip().lower()


def _append_unique_question(questions, seen, candidate, used_questions=None):
    if not candidate:
        return False

    question_text = str(candidate.get("question", "")).strip()
    if not question_text:
        return False

    normalized = _normalise_question_key(question_text)
    if normalized in seen:
        return False
    if used_questions is not None and normalized in used_questions:
        return False

    seen.add(normalized)
    questions.append({
        "question": question_text,
        "answer": str(candidate.get("answer", "")).strip(),
        "options": candidate.get("options", None),
    })
    return True


def _normalise_text(value):
    if value is None:
        return ""

    text = str(value).strip().lower()
    text = text.replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    text = text.strip(" .,!?:;\"'()[]{}")
    return text


def _normalise_numeric_value(value):
    if value is None:
        return None

    cleaned = str(value).strip().lower().replace("_", "")
    cleaned = cleaned.replace(",", "")
    cleaned = cleaned.strip(" \t\r\n\"'`()[]{}")

    if cleaned in {"", "none", "null"}:
        return None

    try:
        number = Decimal(cleaned)
    except InvalidOperation:
        return None

    if not number.is_finite():
        return None

    return number


def answers_match(submitted_answer, correct_answer):
    if submitted_answer is None or correct_answer is None:
        return False

    left = _normalise_text(submitted_answer)
    right = _normalise_text(correct_answer)

    if left == right:
        return True

    left_normalised = _normalise_numeric_value(submitted_answer)
    right_normalised = _normalise_numeric_value(correct_answer)

    if left_normalised is not None and right_normalised is not None:
        return left_normalised == right_normalised

    # Allow common synonyms (e.g. Paris vs paris, carbon dioxide vs co2)
    synonyms = {
        "co2": "carbon dioxide",
        "carbon dioxide": "co2",
        "h2o": "water",
        "water": "h2o",
    }
    if synonyms.get(left) == right or synonyms.get(right) == left:
        return True

    return False


def can_start_challenge(alarm, now=None):
    if alarm is None:
        return False

    if getattr(alarm, "challenge_completed", False):
        return False

    last_triggered = getattr(alarm, "last_triggered", None)

    if last_triggered is None:
        return False

    if isinstance(last_triggered, str):
        try:
            last_triggered = datetime.fromisoformat(last_triggered)
        except ValueError:
            return False

    if now is None:
        now = datetime.utcnow()

    return now - last_triggered <= timedelta(minutes=5)


# ============================================================
# QUESTION GENERATION PER TYPE & 5 DIFFICULTIES
# ============================================================

def _generate_math(difficulty):
    diff = difficulty.lower()
    if diff == "beginner":
        a = random.randint(1, 10)
        b = random.randint(1, 10)
        op = random.choice(["+", "-"])
        if op == "+":
            return {"question": f"What is {a} + {b}?", "answer": str(a + b)}
        if b > a:
            a, b = b, a
        return {"question": f"What is {a} - {b}?", "answer": str(a - b)}

    if diff == "easy":
        a = random.randint(10, 25)
        b = random.randint(5, 20)
        op = random.choice(["+", "-"])
        if op == "+":
            return {"question": f"What is {a} + {b}?", "answer": str(a + b)}
        if b > a:
            a, b = b, a
        return {"question": f"What is {a} - {b}?", "answer": str(a - b)}

    if diff == "hard":
        a = random.randint(12, 40)
        b = random.randint(6, 18)
        c = random.randint(10, 50)
        op = random.choice(["mult", "mixed"])
        if op == "mult":
            return {"question": f"What is {a} × {b}?", "answer": str(a * b)}
        return {"question": f"What is ({a} × {b}) + {c}?", "answer": str((a * b) + c)}

    if diff == "expert":
        a = random.randint(15, 60)
        b = random.randint(12, 30)
        c = random.randint(25, 100)
        op = random.choice(["mixed_sub", "expression"])
        if op == "mixed_sub":
            ans = (a * b) - c
            return {"question": f"What is ({a} × {b}) - {c}?", "answer": str(ans)}
        d = random.randint(2, 5)
        ans = (a * b) + (c * d)
        return {"question": f"What is ({a} × {b}) + ({c} × {d})?", "answer": str(ans)}

    # Medium default
    a = random.randint(8, 25)
    b = random.randint(4, 15)
    c = random.randint(2, 20)
    op = random.choice(["mult", "mixed"])
    if op == "mult":
        return {"question": f"What is {a} × {b}?", "answer": str(a * b)}
    return {"question": f"What is ({a} × {b}) + {c}?", "answer": str((a * b) + c)}


def _generate_logic(difficulty):
    diff = difficulty.lower()
    beginner_pool = [
        {"question": "What comes next: 1, 2, 3, 4, ?", "answer": "5"},
        {"question": "What comes next: 2, 4, 6, 8, ?", "answer": "10"},
        {"question": "What comes next: 5, 10, 15, 20, ?", "answer": "25"},
        {"question": "What comes next: 10, 20, 30, 40, ?", "answer": "50"},
    ]
    easy_pool = [
        {"question": "What comes next: 1, 3, 5, 7, ?", "answer": "9"},
        {"question": "What comes next: 3, 6, 9, 12, ?", "answer": "15"},
        {"question": "What comes next: 4, 8, 12, 16, ?", "answer": "20"},
        {"question": "What comes next: 2, 6, 10, 14, ?", "answer": "18"},
    ]
    medium_pool = [
        {"question": "What comes next: 1, 4, 7, 10, ?", "answer": "13"},
        {"question": "What comes next: 3, 8, 13, 18, ?", "answer": "23"},
        {"question": "What comes next: 4, 8, 16, 32, ?", "answer": "64"},
        {"question": "What comes next: 5, 10, 20, 40, ?", "answer": "80"},
    ]
    hard_pool = [
        {"question": "What comes next: 1, 4, 9, 16, 25, ?", "answer": "36"},
        {"question": "What comes next: 2, 5, 10, 17, 26, ?", "answer": "37"},
        {"question": "What comes next: 3, 6, 12, 24, 48, ?", "answer": "96"},
        {"question": "What comes next: 2, 3, 5, 8, 13, ?", "answer": "21"},
    ]
    expert_pool = [
        {"question": "What comes next: 1, 8, 27, 64, ?", "answer": "125"},
        {"question": "What comes next: 1, 2, 6, 24, 120, ?", "answer": "720"},
        {"question": "What comes next: 2, 6, 12, 20, 30, ?", "answer": "42"},
        {"question": "What comes next: 3, 5, 9, 17, 33, ?", "answer": "65"},
    ]

    pools = {
        "beginner": beginner_pool,
        "easy": easy_pool,
        "medium": medium_pool,
        "hard": hard_pool,
        "expert": expert_pool,
    }
    return random.choice(pools.get(diff, medium_pool))


def _generate_memory(difficulty):
    diff = difficulty.lower()
    digits_map = {
        "beginner": 3,
        "easy": 4,
        "medium": 6,
        "hard": 8,
        "expert": 10,
    }
    digits = digits_map.get(diff, 6)
    number = "".join(str(random.randint(0, 9)) for _ in range(digits))
    return {
        "question": f"Remember this {digits}-digit sequence: {number}. What was the number?",
        "answer": number,
    }


def _generate_word(difficulty):
    diff = difficulty.lower()
    beginner_words = [
        {"question": "Unscramble: TAC", "answer": "CAT"},
        {"question": "Unscramble: GOD", "answer": "DOG"},
        {"question": "Unscramble: NUS", "answer": "SUN"},
        {"question": "Unscramble: YBO", "answer": "BOY"},
    ]
    easy_words = [
        {"question": "Unscramble: EMOH", "answer": "HOME"},
        {"question": "Unscramble: KOB", "answer": "BOOK"},
        {"question": "Unscramble: RETAW", "answer": "WATER"},
        {"question": "Unscramble: NIRAT", "answer": "TRAIN"},
    ]
    medium_words = [
        {"question": "Unscramble: PPAEL", "answer": "APPLE"},
        {"question": "Unscramble: RANOGE", "answer": "ORANGE"},
        {"question": "Unscramble: ANANAB", "answer": "BANANA"},
        {"question": "Unscramble: ELPMIX", "answer": "SIMPLE"},
    ]
    hard_words = [
        {"question": "Unscramble: RETUPMOC", "answer": "COMPUTER"},
        {"question": "Unscramble: TNAHPLE", "answer": "ELEPHANT"},
        {"question": "Unscramble: YTISREVINU", "answer": "UNIVERSITY"},
    ]
    expert_words = [
        {"question": "Unscramble: NOITACUDE", "answer": "EDUCATION"},
        {"question": "Unscramble: YGOLONHCET", "answer": "TECHNOLOGY"},
        {"question": "Unscramble: NOITAVONNI", "answer": "INNOVATION"},
        {"question": "Unscramble: GNIDNATREDNU", "answer": "UNDERSTANDING"},
    ]

    pools = {
        "beginner": beginner_words,
        "easy": easy_words,
        "medium": medium_words,
        "hard": hard_words,
        "expert": expert_words,
    }
    return random.choice(pools.get(diff, medium_words))


def _generate_pattern(difficulty):
    diff = difficulty.lower()
    beginner_patterns = [
        {"question": "Pattern recognition: A, B, C, D, ?", "answer": "E"},
        {"question": "Pattern recognition: 10, 20, 30, 40, ?", "answer": "50"},
        {"question": "Pattern recognition: Up, Down, Up, Down, ?", "answer": "Up"},
    ]
    easy_patterns = [
        {"question": "Pattern recognition: A1, B2, C3, D4, ?", "answer": "E5"},
        {"question": "Pattern recognition: 2, 4, 2, 4, ?", "answer": "2"},
        {"question": "Pattern recognition: Red, Blue, Red, Blue, ?", "answer": "Red"},
    ]
    medium_patterns = [
        {"question": "Pattern recognition: 64, 32, 16, 8, ?", "answer": "4"},
        {"question": "Pattern recognition: Z, Y, X, W, ?", "answer": "V"},
        {"question": "Pattern recognition: 1A, 2B, 3C, 4D, ?", "answer": "5E"},
    ]
    hard_patterns = [
        {"question": "Pattern recognition: 3, 9, 27, 81, ?", "answer": "243"},
        {"question": "Pattern recognition: 1, A, 2, B, 3, C, 4, ?", "answer": "D"},
        {"question": "Pattern recognition: 2, 3, 5, 7, 11, ?", "answer": "13"},
    ]
    expert_patterns = [
        {"question": "Pattern recognition: 1, 8, 27, 64, ?", "answer": "125"},
        {"question": "Pattern recognition: 2, 6, 18, 54, ?", "answer": "162"},
        {"question": "Pattern recognition: A, C, F, J, O, ?", "answer": "U"},
    ]

    pools = {
        "beginner": beginner_patterns,
        "easy": easy_patterns,
        "medium": medium_patterns,
        "hard": hard_patterns,
        "expert": expert_patterns,
    }
    return random.choice(pools.get(diff, medium_patterns))


def _generate_riddle(difficulty):
    diff = difficulty.lower()
    beginner_riddles = [
        {"question": "I have hands but cannot clap. What am I?", "answer": "clock"},
        {"question": "What has a face and two hands but no legs?", "answer": "clock"},
        {"question": "What has keys but cannot open locks?", "answer": "keyboard"},
    ]
    easy_riddles = [
        {"question": "What has one eye but cannot see?", "answer": "needle"},
        {"question": "What gets wetter as it dries?", "answer": "towel"},
        {"question": "What has a head and a tail but no body?", "answer": "coin"},
    ]
    medium_riddles = [
        {"question": "What can travel around the world while staying in one corner?", "answer": "stamp"},
        {"question": "What has legs but does not walk?", "answer": "table"},
        {"question": "What has words but never speaks?", "answer": "book"},
    ]
    hard_riddles = [
        {"question": "What disappears the moment you say its name?", "answer": "silence"},
        {"question": "The more you take, the more you leave behind. What are they?", "answer": "footsteps"},
        {"question": "What has cities, roads and rivers but no people, cars or water?", "answer": "map"},
    ]
    expert_riddles = [
        {"question": "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", "answer": "echo"},
        {"question": "You see me once in June, twice in November, but not at all in May. What am I?", "answer": "e"},
        {"question": "What belongs to you, but everyone else uses it more than you do?", "answer": "name"},
    ]

    pools = {
        "beginner": beginner_riddles,
        "easy": easy_riddles,
        "medium": medium_riddles,
        "hard": hard_riddles,
        "expert": expert_riddles,
    }
    return random.choice(pools.get(diff, medium_riddles))


def _generate_quiz(difficulty):
    diff = difficulty.lower()
    beginner_quizzes = [
        {"question": "Quick Quiz: How many hours are there in one full day?", "answer": "24"},
        {"question": "Quick Quiz: How many days are in a regular week?", "answer": "7"},
        {"question": "Quick Quiz: How many months are in a year?", "answer": "12"},
    ]
    easy_quizzes = [
        {"question": "Quick Quiz: What is the capital city of France?", "answer": "Paris"},
        {"question": "Quick Quiz: How many continents are there on Earth?", "answer": "7"},
        {"question": "Quick Quiz: What is the boiling point of water in Celsius?", "answer": "100"},
    ]
    medium_quizzes = [
        {"question": "Quick Quiz: Which planet is known as the Red Planet?", "answer": "Mars"},
        {"question": "Quick Quiz: How many seconds are in one hour?", "answer": "3600"},
        {"question": "Quick Quiz: What primary organ pumps blood throughout the human body?", "answer": "heart"},
    ]
    hard_quizzes = [
        {"question": "Quick Quiz: What is the chemical formula for water?", "answer": "H2O"},
        {"question": "Quick Quiz: What is the largest ocean on Earth?", "answer": "Pacific"},
        {"question": "Quick Quiz: What is the hardest known natural mineral?", "answer": "diamond"},
    ]
    expert_quizzes = [
        {"question": "Quick Quiz: What gas do plants primarily absorb during photosynthesis?", "answer": "carbon dioxide"},
        {"question": "Quick Quiz: What is the speed of light in kilometers per second approximately (to nearest thousand)?", "answer": "300000"},
        {"question": "Quick Quiz: What is the main structural component of plant cell walls?", "answer": "cellulose"},
    ]

    pools = {
        "beginner": beginner_quizzes,
        "easy": easy_quizzes,
        "medium": medium_quizzes,
        "hard": hard_quizzes,
        "expert": expert_quizzes,
    }
    return random.choice(pools.get(diff, medium_quizzes))


def generate_questions(
    challenge_type="math",
    difficulty="medium",
    count=5,
    used_questions=None,
):
    """
    Generate unique challenge questions for any of the 7 supported challenge types
    and 5 supported difficulty levels.
    """
    challenge_type = (challenge_type or "math").lower().strip()
    difficulty = (difficulty or "medium").lower().strip()

    if challenge_type not in SUPPORTED_CHALLENGE_TYPES:
        challenge_type = "math"
    if difficulty not in SUPPORTED_DIFFICULTIES:
        difficulty = "medium"

    count = max(1, min(int(count), 15))
    used = set(_normalise_question_key(value) for value in (used_questions or []))
    questions = []
    seen = set()

    generators = {
        "math": _generate_math,
        "logic": _generate_logic,
        "memory": _generate_memory,
        "word": _generate_word,
        "pattern": _generate_pattern,
        "riddle": _generate_riddle,
        "quiz": _generate_quiz,
    }
    generator = generators.get(challenge_type, _generate_math)

    generation_attempts = 0
    max_attempts = count * 150
    while len(questions) < count and generation_attempts < max_attempts:
        generation_attempts += 1
        candidate = generator(difficulty)
        if not _append_unique_question(questions, seen, candidate, used):
            if len(questions) == count:
                break
            continue
        if len(questions) >= count:
            break

    # If count not reached due to small pool, relax used filter
    if len(questions) < count:
        while len(questions) < count:
            candidate = generator(difficulty)
            candidate["question"] = f"{candidate['question']} (#{len(questions) + 1})"
            questions.append(candidate)

    return questions[:count]


def create_challenge(
    challenge_type="math",
    difficulty="medium",
    count=5
):
    questions = generate_questions(
        challenge_type=challenge_type,
        difficulty=difficulty,
        count=count
    )
    return {
        "challenge_type": challenge_type,
        "difficulty": difficulty,
        "total_questions": len(questions),
        "questions": questions
    }