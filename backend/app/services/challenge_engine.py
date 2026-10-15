"""
Cognitive Challenge Engine — Milestone 2
7 challenge types × 5 difficulty levels.
Adaptive difficulty delegated to AdaptiveDifficultyService (rule-based, no ML).
correct_answer is NEVER returned to the frontend.
"""
import random
import time
from typing import Tuple, Optional

DIFFICULTY_LEVELS = ["BEGINNER", "EASY", "MEDIUM", "HARD", "EXPERT"]
CHALLENGE_TYPES   = ["math", "logic", "memory", "word", "pattern", "riddle", "quiz"]

# Default challenge type for alarm demonstrations
DEFAULT_ALARM_CHALLENGE_TYPE = "math"

# Time limits per difficulty (seconds)
TIME_LIMITS = {
    "BEGINNER": 120,
    "EASY":     90,
    "MEDIUM":   60,
    "HARD":     45,
    "EXPERT":   30,
}

# Map profile preference strings → canonical level
_PREF_MAP = {
    "beginner": "BEGINNER", "easy": "EASY", "medium": "MEDIUM",
    "hard": "HARD", "expert": "EXPERT",
}


def _rng(salt: int = 0) -> random.Random:
    return random.Random(int(time.time() * 1000) + salt)


# ── 1. MATH ───────────────────────────────────────────────────────────────────

def _math_beginner(r: random.Random) -> Tuple[str, str]:
    variant = r.randint(0, 2)
    if variant == 0:
        a, b = r.randint(2, 15), r.randint(2, 15)
        return f"{a} + {b} = ?", str(a + b)
    elif variant == 1:
        a, b = r.randint(5, 20), r.randint(1, 10)
        if a < b:
            a, b = b, a
        return f"{a} - {b} = ?", str(a - b)
    else:
        a, b = r.randint(2, 9), r.randint(2, 5)
        return f"{a} x {b} = ?", str(a * b)


def _math_easy(r: random.Random) -> Tuple[str, str]:
    variant = r.randint(0, 2)
    if variant == 0:
        a, b = r.randint(10, 50), r.randint(10, 50)
        return f"{a} + {b} = ?", str(a + b)
    elif variant == 1:
        a, b = r.randint(15, 99), r.randint(5, 30)
        if a < b:
            a, b = b, a
        return f"{a} - {b} = ?", str(a - b)
    else:
        b = r.randint(2, 12)
        a = b * r.randint(2, 12)
        return f"{a} / {b} = ?", str(a // b)


def _math_medium(r: random.Random) -> Tuple[str, str]:
    variant = r.randint(0, 2)
    if variant == 0:
        a, b, c = r.randint(5, 30), r.randint(2, 12), r.randint(5, 40)
        return f"{a} x {b} - {c} = ?", str(a * b - c)
    elif variant == 1:
        b = r.randint(2, 12)
        a = b * r.randint(3, 15)
        c = r.randint(5, 30)
        return f"{a} / {b} + {c} = ?", str(a // b + c)
    else:
        pct = r.choice([10, 20, 25, 50])
        base = r.choice([80, 120, 160, 200, 240, 300])
        ans = (pct * base) // 100
        return f"{pct}% of {base} = ?", str(ans)


def _math_hard(r: random.Random) -> Tuple[str, str]:
    variant = r.randint(0, 2)
    if variant == 0:
        a, b, c = r.randint(2, 10), r.randint(5, 20), r.randint(5, 30)
        return f"{a} x ({b} + {c}) = ?", str(a * (b + c))
    elif variant == 1:
        pct = r.choice([25, 30, 40, 15])
        base = r.choice([120, 200, 360, 480])
        add = r.randint(10, 60)
        ans = (pct * base) // 100 + add
        return f"{pct}% of {base} + {add} = ?", str(ans)
    else:
        a = r.randint(2, 8)
        x = r.randint(3, 15)
        b = r.randint(2, 20)
        c = a * x + b
        return f"If {a}x + {b} = {c}, find x.", str(x)


def _math_expert(r: random.Random) -> Tuple[str, str]:
    variant = r.randint(0, 2)
    if variant == 0:
        a, b = r.randint(10, 40), r.randint(10, 40)
        c, d = r.randint(3, 9), r.randint(10, 50)
        return f"({a} + {b}) x {c} - {d} = ?", str((a + b) * c - d)
    elif variant == 1:
        a = r.randint(2, 8)
        b = r.randint(2, 8)
        c = a * r.randint(2, 6)
        ans = (b * c) // a
        return f"If {a}:{b} = {c}:?, find ?.", str(ans)
    else:
        c = r.randint(1, 4)
        a = c + r.randint(2, 5)
        b = r.randint(2, 15)
        d = r.randint(2, 15)
        x = (d + b) // (a - c)
        d = x * (a - c) - b
        return f"If {a}x - {b} = {c}x + {d}, find x.", str(x)


_MATH_DISPATCH = {
    "BEGINNER": _math_beginner,
    "EASY":     _math_easy,
    "MEDIUM":   _math_medium,
    "HARD":     _math_hard,
    "EXPERT":   _math_expert,
}


def _math(difficulty: str) -> Tuple[str, str]:
    r = _rng(1)
    return _MATH_DISPATCH.get(difficulty, _math_medium)(r)


# ── 2. LOGIC ──────────────────────────────────────────────────────────────────

_LOGIC_POOL = {
    "BEGINNER": [
        ("If all cats are animals and Whiskers is a cat, is Whiskers an animal? (yes/no)", "yes"),
        ("It is sunny. If it is sunny, I wear sunglasses. Am I wearing sunglasses? (yes/no)", "yes"),
        ("All apples are fruits. Is an apple a fruit? (yes/no)", "yes"),
        ("If today is Friday, tomorrow is Saturday. Today is Friday. What is tomorrow?", "saturday"),
        ("All fish live in water. Nemo is a fish. Does Nemo live in water? (yes/no)", "yes"),
    ],
    "EASY": [
        ("If all dogs are animals and Rex is a dog, is Rex an animal? (yes/no)", "yes"),
        ("All birds have wings. A penguin is a bird. Does a penguin have wings? (yes/no)", "yes"),
        ("If it is raining the ground is wet. It is raining. Is the ground wet? (yes/no)", "yes"),
        ("All roses are flowers. Can roses fade quickly? (yes/no)", "yes"),
        ("If today is Monday, tomorrow is Tuesday. Today is Monday. What is tomorrow?", "tuesday"),
    ],
    "MEDIUM": [
        ("If A > B and B > C, is A > C? (yes/no)", "yes"),
        ("All squares are rectangles. Is every rectangle a square? (yes/no)", "no"),
        ("If no cats are dogs and Tom is a cat, is Tom a dog? (yes/no)", "no"),
        ("John is taller than Mary. Mary is taller than Sue. Is John taller than Sue? (yes/no)", "yes"),
        ("A is north of B. B is north of C. Is A north of C? (yes/no)", "yes"),
    ],
    "HARD": [
        ("Some A are B. All B are C. Are some A definitely C? (yes/no)", "yes"),
        ("If P implies Q, and Q is false, is P true? (yes/no)", "no"),
        ("All M are P. No S are M. Can some S be P? (yes/no)", "yes"),
        ("If neither A nor B is true, is 'A or B' true? (yes/no)", "no"),
        ("All kind people are honest. No honest person is cruel. Are kind people cruel? (yes/no)", "no"),
    ],
    "EXPERT": [
        ("If all A are B, and no B are C, can any A be C? (yes/no)", "no"),
        ("P implies Q. Q implies R. P is true. Is R true? (yes/no)", "yes"),
        ("Some X are Y. No Y are Z. Are some X definitely not Z? (yes/no)", "yes"),
        ("If it is false that 'some cats are dogs', what can we conclude? All cats are not dogs, or no cats are dogs? (all/no)", "no"),
        ("All brave people are strong. Some strong people are wise. Are all brave people wise? (yes/no)", "no"),
    ],
}

def _logic(difficulty: str) -> Tuple[str, str]:
    r = _rng(2)
    q, a = r.choice(_LOGIC_POOL.get(difficulty, _LOGIC_POOL["MEDIUM"]))
    return q, a.lower()


# ── 3. MEMORY ─────────────────────────────────────────────────────────────────

def _memory(difficulty: str) -> Tuple[str, str]:
    r = _rng(3)
    length = {"BEGINNER": 3, "EASY": 4, "MEDIUM": 6, "HARD": 8, "EXPERT": 10}.get(difficulty, 5)
    seq = [str(r.randint(0, 9)) for _ in range(length)]
    return (
        f"Memorise this sequence, then type it back without spaces:\n{' '.join(seq)}",
        "".join(seq),
    )


# ── 4. WORD ───────────────────────────────────────────────────────────────────

_WORD_POOL = {
    "BEGINNER": [
        ("Unscramble: TAC", "cat"),
        ("Unscramble: GOD", "dog"),
        ("Unscramble: NUS", "sun"),
        ("Unscramble: PUC", "cup"),
        ("Unscramble: TAH", "hat"),
    ],
    "EASY": [
        ("Unscramble: ELPPA", "apple"),
        ("Unscramble: OUSHE", "house"),
        ("Unscramble: RETAW", "water"),
        ("Unscramble: IGHTL", "light"),
        ("Unscramble: OCLCK", "clock"),
    ],
    "MEDIUM": [
        ("What is the opposite of 'ancient'?", "modern"),
        ("What is the opposite of 'expand'?", "contract"),
        ("Complete: 'Early to bed and early to rise makes a man healthy, wealthy and ___'", "wise"),
        ("Unscramble: BNRDIA", "brain"),
        ("What word means both a timepiece and to observe? (one word)", "watch"),
    ],
    "HARD": [
        ("What 7-letter word contains the letters A, L, R, M, A, A, L?", "malarial"),
        ("Rearrange 'LISTEN' to form another word", "silent"),
        ("What word is spelled the same forwards and backwards? (5 letters, a type of vehicle)", "racecar"),
        ("Unscramble: TNLLEGIINCE", "intelligence"),
        ("What single word can follow 'sun', 'moon', and 'day'? (5 letters)", "light"),
    ],
    "EXPERT": [
        ("Rearrange 'ASTRONOMER' to form a two-word phrase meaning 'moon starer'", "moon starer"),
        ("What 8-letter word has 'kst' in the middle, 'br' at the start, and 'le' at the end?", "brisktle"),
        ("Unscramble: YCPSOHLGO", "psychology"),
        ("What word contains all five vowels exactly once? (10 letters, means 'teaching')", "education"),
        ("Rearrange 'SCHOOLMASTER' to form a phrase meaning 'the classroom'", "the classroom"),
    ],
}

def _word(difficulty: str) -> Tuple[str, str]:
    r = _rng(4)
    q, a = r.choice(_WORD_POOL.get(difficulty, _WORD_POOL["MEDIUM"]))
    return q, a.lower()


# ── 5. PATTERN ────────────────────────────────────────────────────────────────

def _pattern(difficulty: str) -> Tuple[str, str]:
    r = _rng(5)
    if difficulty == "BEGINNER":
        start, step = r.randint(1, 5), r.choice([1, 2])
        seq = [start + step * i for i in range(4)]
        return f"What comes next? {', '.join(map(str, seq))}, ?", str(start + step * 4)

    elif difficulty == "EASY":
        start, step = r.randint(1, 5), r.choice([2, 3, 5])
        seq = [start + step * i for i in range(4)]
        return f"What comes next? {', '.join(map(str, seq))}, ?", str(start + step * 4)

    elif difficulty == "MEDIUM":
        start, mult = r.randint(2, 6), r.choice([2, 3])
        seq = [start * (mult ** i) for i in range(4)]
        return f"What comes next? {', '.join(map(str, seq))}, ?", str(start * (mult ** 4))

    elif difficulty == "HARD":
        a, b = r.randint(1, 4), r.randint(1, 4)
        seq = [a, b]
        for _ in range(4):
            seq.append(seq[-1] + seq[-2])
        return f"What comes next? {', '.join(map(str, seq))}, ?", str(seq[-1] + seq[-2])

    else:  # EXPERT
        # Alternating two interleaved sequences
        a_start, a_step = r.randint(1, 5), r.randint(2, 4)
        b_start, b_step = r.randint(10, 20), r.randint(3, 6)
        seq = []
        for i in range(3):
            seq.append(a_start + a_step * i)
            seq.append(b_start + b_step * i)
        next_val = a_start + a_step * 3
        return f"What comes next? {', '.join(map(str, seq))}, ?", str(next_val)


# ── 6. RIDDLE ─────────────────────────────────────────────────────────────────

_RIDDLE_POOL = {
    "BEGINNER": [
        ("I have hands but cannot clap. What am I?", "clock"),
        ("I am always in front of you but cannot be seen. What am I?", "future"),
        ("What has teeth but cannot bite?", "comb"),
        ("What gets wetter the more it dries?", "towel"),
        ("I have a tail and a head but no body. What am I?", "coin"),
    ],
    "EASY": [
        ("The more you take, the more you leave behind. What am I?", "footsteps"),
        ("I speak without a mouth and hear without ears. What am I?", "echo"),
        ("What has cities but no houses, forests but no trees, and water but no fish?", "map"),
        ("I have keys but no locks, space but no room. What am I?", "keyboard"),
        ("What can travel around the world while staying in a corner?", "stamp"),
    ],
    "MEDIUM": [
        ("I have branches but no fruit, trunk but no leaves. What am I?", "bank"),
        ("The more you remove from me, the bigger I become. What am I?", "hole"),
        ("I am not alive but I grow; I don't have lungs but I need air. What am I?", "fire"),
        ("What has one eye but cannot see?", "needle"),
        ("I am always hungry and must always be fed. What am I?", "fire"),
    ],
    "HARD": [
        ("I have cities but no houses, mountains but no trees, water but no fish, and deserts but no sand. What am I?", "map"),
        ("What can run but never walks, has a mouth but never talks, has a head but never weeps, has a bed but never sleeps?", "river"),
        ("I am taken from a mine and shut up in a wood. I help everyone, yet I am used by everyone. What am I?", "pencil"),
        ("The person who makes it sells it. The person who buys it doesn't use it. The person who uses it doesn't know it. What is it?", "coffin"),
        ("I have no life but I can die. What am I?", "battery"),
    ],
    "EXPERT": [
        ("What is so fragile that saying its name breaks it?", "silence"),
        ("I am not alive, but I can grow; I don't have lungs, but I need air; I don't have a mouth, but water kills me. What am I?", "fire"),
        ("The more you have of it, the less you see. What is it?", "darkness"),
        ("What has roots as nobody sees, is taller than trees, up, up, up it goes, and yet never grows?", "mountain"),
        ("I have cities, but no houses live there. I have mountains, but no trees grow there. I have water, but no fish swim there. I have roads, but no cars drive there. What am I?", "map"),
    ],
}

def _riddle(difficulty: str) -> Tuple[str, str]:
    r = _rng(6)
    q, a = r.choice(_RIDDLE_POOL.get(difficulty, _RIDDLE_POOL["MEDIUM"]))
    return q, a.lower()


# ── 7. QUIZ ───────────────────────────────────────────────────────────────────

_QUIZ_POOL = {
    "BEGINNER": [
        ("How many days are in a week?", "7"),
        ("How many months are in a year?", "12"),
        ("What colour do you get when you mix red and white?", "pink"),
        ("How many sides does a triangle have?", "3"),
        ("What is 2 + 2?", "4"),
    ],
    "EASY": [
        ("What is the capital of France?", "paris"),
        ("How many continents are there on Earth?", "7"),
        ("What is the largest planet in our solar system?", "jupiter"),
        ("How many hours are in a day?", "24"),
        ("What is the chemical symbol for water?", "h2o"),
    ],
    "MEDIUM": [
        ("What is the square root of 144?", "12"),
        ("In which year did World War II end?", "1945"),
        ("What is the speed of light in km/s? (approximate, 3 digits)", "300000"),
        ("What element has the atomic number 1?", "hydrogen"),
        ("How many bones are in the adult human body?", "206"),
    ],
    "HARD": [
        ("What is the powerhouse of the cell?", "mitochondria"),
        ("What is the value of Pi to 4 decimal places?", "3.1416"),
        ("Who wrote 'On the Origin of Species'?", "darwin"),
        ("What is the chemical formula for table salt?", "nacl"),
        ("In what year was the Eiffel Tower completed?", "1889"),
    ],
    "EXPERT": [
        ("What is Avogadro's number? (scientific notation base, 6 digits)", "602214"),
        ("What is the Pythagorean theorem? (format: a^2+b^2=c^2)", "a^2+b^2=c^2"),
        ("What is the derivative of sin(x)?", "cos(x)"),
        ("What is the name of the theorem that states every even integer > 2 is the sum of two primes?", "goldbach"),
        ("What is the speed of sound in air at 20°C in m/s?", "343"),
    ],
}

def _quiz(difficulty: str) -> Tuple[str, str]:
    r = _rng(7)
    q, a = r.choice(_QUIZ_POOL.get(difficulty, _QUIZ_POOL["MEDIUM"]))
    return q, a.lower()


# ── Adaptive Difficulty (delegated to AdaptiveDifficultyService) ──────────────
# Keep these shims so existing callers don't break
from app.services.adaptive_difficulty import (
    compute_next_difficulty,
    get_starting_difficulty,
    POLICY as ADAPTIVE_POLICY,
)


def get_adaptive_difficulty(
    recent_results: list,
    preference: Optional[str] = None,
) -> str:
    """Shim: returns starting difficulty adjusted by recent results."""
    base = get_starting_difficulty(preference)
    return compute_next_difficulty(base, recent_results)


def pick_challenge_type(recent_types: list) -> str:
    """Avoid repeating the same type consecutively."""
    r = _rng(0)
    avoid = set(recent_types[-2:]) if recent_types else set()
    candidates = [t for t in CHALLENGE_TYPES if t not in avoid]
    return r.choice(candidates or CHALLENGE_TYPES)


# ── Public API ────────────────────────────────────────────────────────────────

def generate_challenge(challenge_type: str = None, difficulty: str = None) -> dict:
    """Generate a challenge. correct_answer stored server-side only."""
    difficulty = (difficulty or "MEDIUM").upper()
    if difficulty not in DIFFICULTY_LEVELS:
        difficulty = "MEDIUM"

    r = _rng(0)
    if not challenge_type or challenge_type not in CHALLENGE_TYPES:
        challenge_type = r.choice(CHALLENGE_TYPES)

    generators = {
        "math":    _math,
        "logic":   _logic,
        "memory":  _memory,
        "word":    _word,
        "pattern": _pattern,
        "riddle":  _riddle,
        "quiz":    _quiz,
    }
    question, correct_answer = generators[challenge_type](difficulty)
    return {
        "challenge_type": challenge_type,
        "difficulty": difficulty,
        "question": question,
        "correct_answer": correct_answer,
        "time_limit_seconds": TIME_LIMITS.get(difficulty, 60),
    }


def check_answer(user_answer: str, correct_answer: str) -> bool:
    ua = user_answer.strip().lower()
    ca = correct_answer.strip().lower()
    if ua == ca:
        return True
    try:
        return float(ua) == float(ca)
    except ValueError:
        return False


def compute_score(correct: bool, attempts: int, duration: float, time_limit: float) -> int:
    """Compute 0-100 score for a single challenge attempt."""
    if not correct:
        return 0
    base = 100
    # Penalty: -10 per extra attempt beyond the first
    attempt_penalty = max(0, (attempts - 1) * 10)
    # Speed bonus/penalty: full marks if completed in <=50% of time limit
    if time_limit > 0:
        ratio = duration / time_limit
        speed_penalty = max(0, int((ratio - 0.5) * 40))
    else:
        speed_penalty = 0
    return max(10, base - attempt_penalty - speed_penalty)
