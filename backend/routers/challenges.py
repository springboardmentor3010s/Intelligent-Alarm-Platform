from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import random
import json
from datetime import datetime

from database import get_db
from Models.challenge import Challenge, ChallengeAttempt, WakeUpEvent
from Models.alarm import Alarm
from Models.user import UserProfile
from auth import get_current_user
from services.analytics import adapt_alarm_difficulty, calculate_daily_habit_score, get_user_adaptive_difficulty
from services.notification_service import create_notification

router = APIRouter(prefix="/challenges", tags=["Challenges"])


class GenerateChallengeRequest(BaseModel):
    alarm_id: int | None = None
    wake_up_event_id: int | None = None
    difficulty: str | None = None
    challenge_type: str | None = None
    is_test: bool = False


class SubmitChallengeRequest(BaseModel):
    answer: str
    solve_time: int = 0


DIFFICULTIES = [
    "Beginner",
    "Easy",
    "Medium",
    "Hard",
    "Expert",
]

CHALLENGE_TYPES = [
    "Math Problems",
    "Logic Puzzles",
    "Memory Challenges",
    "Word Games",
    "Pattern Recognition",
    "Riddles",
    "Quick Quizzes",
]


def normalize_difficulty(difficulty):
    if not difficulty:
        return "Medium"

    difficulty = difficulty.strip().title()

    if difficulty not in DIFFICULTIES:
        return "Medium"

    return difficulty


def normalize_challenge_type(challenge_type):
    if not challenge_type:
        return random.choice(CHALLENGE_TYPES)

    value = challenge_type.strip().lower()

    for challenge_type_name in CHALLENGE_TYPES:
        if value == challenge_type_name.lower():
            return challenge_type_name

    if value in ["math", "mathematics"]:
        return "Math Problems"

    if value in ["logic", "logic puzzle"]:
        return "Logic Puzzles"

    if value in ["memory", "memory challenge", "sequence"]:
        return "Memory Challenges"

    if value in ["word", "word game"]:
        return "Word Games"

    if value in ["pattern", "pattern recognition"]:
        return "Pattern Recognition"

    if value in ["riddle", "riddles"]:
        return "Riddles"

    if value in ["quiz", "quick quiz", "quick quizzes"]:
        return "Quick Quizzes"

    if value in ["all", "all types", "all types (mixed)", "mixed", "random"]:
        return random.choice(CHALLENGE_TYPES)

    return random.choice(CHALLENGE_TYPES)


def get_difficulty_level(difficulty):
    levels = {
        "Beginner": 1,
        "Easy": 2,
        "Medium": 3,
        "Hard": 4,
        "Expert": 5,
    }

    return levels.get(difficulty, 3)


def generate_math(difficulty):
    level = get_difficulty_level(difficulty)

    if level == 1:
        # Beginner: simple single-digit arithmetic
        a = random.randint(1, 9)
        b = random.randint(1, 9)
        op = random.choice(["+", "-"])
        if op == "-" and a < b:
            a, b = b, a
        correct = a + b if op == "+" else a - b
        question = f"What is {a} {op} {b}?"

    elif level == 2:
        # Easy: basic arithmetic with slightly greater complexity
        mode = random.choice(["add_sub", "mul"])
        if mode == "add_sub":
            a = random.randint(10, 30)
            b = random.randint(2, 9)
            op = random.choice(["+", "-"])
            if op == "-" and a < b:
                a, b = b, a
            correct = a + b if op == "+" else a - b
            question = f"What is {a} {op} {b}?"
        else:
            a = random.randint(2, 9)
            b = random.randint(2, 9)
            correct = a * b
            question = f"What is {a} * {b}?"

    elif level == 3:
        # Medium: standard two-digit operations
        mode = random.choice(["add_sub", "mul"])
        if mode == "add_sub":
            a = random.randint(20, 95)
            b = random.randint(11, 50)
            op = random.choice(["+", "-"])
            if op == "-" and a < b:
                a, b = b, a
            correct = a + b if op == "+" else a - b
            question = f"What is {a} {op} {b}?"
        else:
            a = random.randint(11, 20)
            b = random.randint(3, 8)
            correct = a * b
            question = f"What is {a} * {b}?"

    elif level == 4:
        # Hard: multi-step arithmetic or more complex calculations
        pattern = random.choice(["mul_add", "mul_sub", "grouped"])
        if pattern == "mul_add":
            a = random.randint(4, 12)
            b = random.randint(3, 9)
            c = random.randint(5, 30)
            correct = (a * b) + c
            question = f"What is ({a} * {b}) + {c}?"
        elif pattern == "mul_sub":
            a = random.randint(5, 12)
            b = random.randint(4, 9)
            c = random.randint(2, 20)
            if (a * b) < c:
                c = random.randint(1, max(1, (a * b) - 1))
            correct = (a * b) - c
            question = f"What is ({a} * {b}) - {c}?"
        else:
            a = random.randint(5, 15)
            b = random.randint(3, 12)
            c = random.randint(2, 6)
            correct = (a + b) * c
            question = f"What is ({a} + {b}) * {c}?"

    else:
        # Expert: challenging calculations or complex multi-step operations
        pattern = random.choice(["two_pairs_add", "two_pairs_sub", "two_digit_mul_add"])
        if pattern == "two_pairs_add":
            a = random.randint(7, 16)
            b = random.randint(4, 9)
            c = random.randint(6, 14)
            d = random.randint(3, 8)
            correct = (a * b) + (c * d)
            question = f"What is ({a} * {b}) + ({c} * {d})?"
        elif pattern == "two_pairs_sub":
            a = random.randint(9, 18)
            b = random.randint(5, 10)
            c = random.randint(4, 12)
            d = random.randint(2, 6)
            if (a * b) < (c * d):
                a, c = c + 5, a
            correct = (a * b) - (c * d)
            question = f"What is ({a} * {b}) - ({c} * {d})?"
        else:
            a = random.randint(14, 32)
            b = random.randint(11, 24)
            c = random.randint(15, 75)
            op = random.choice(["+", "-"])
            correct = (a * b) + c if op == "+" else (a * b) - c
            question = f"What is ({a} * {b}) {op} {c}?"

    options = {correct}

    while len(options) < 4:
        offset = random.randint(
            1,
            max(5, abs(correct) // 5 + 5)
        )
        wrong = correct + random.choice([-offset, offset])

        if wrong != correct:
            options.add(wrong)

    options = list(options)
    random.shuffle(options)

    return (
        question,
        json.dumps([str(option) for option in options]),
        str(correct),
    )


def generate_memory(difficulty):
    word_pool = [
        "Apple",
        "Banana",
        "Orange",
        "Grape",
        "Mango",
        "Peach",
        "Plum",
        "Kiwi",
        "Lemon",
        "Cherry",
        "Papaya",
        "Guava",
    ]

    level = get_difficulty_level(difficulty)

    lengths = {
        1: 3,
        2: 4,
        3: 5,
        4: 7,
        5: 9,
    }

    length = lengths[level]

    selected = random.sample(word_pool, length)

    position = random.randint(1, length)

    question = (
        f"Remember these words: {', '.join(selected)}. "
        f"What was word number {position}?"
    )

    correct = selected[position - 1]

    options = {correct}

    while len(options) < 4:
        options.add(random.choice(word_pool))

    options = list(options)
    random.shuffle(options)

    return (
        question,
        json.dumps(options),
        correct,
    )


def generate_logic(difficulty):
    level = get_difficulty_level(difficulty)

    if level == 1:
        # Beginner: simple counting step of +2, +5, or +10
        base = random.choice([2, 5, 10])
        start = random.choice([base, base * 2])
        numbers = [start + base * i for i in range(5)]
        odd_index = random.randint(1, 3)
        odd_value = numbers[odd_index] + random.choice([1, 3])
        numbers[odd_index] = odd_value

    elif level == 2:
        # Easy: single-digit table multiples (3, 4, 6, 7, 8, 9)
        base = random.choice([3, 4, 6, 7, 8, 9])
        start_factor = random.randint(1, 4)
        numbers = [base * (start_factor + i) for i in range(5)]
        odd_index = random.randint(0, 4)
        offset = random.choice([1, 2, 5])
        odd_value = numbers[odd_index] + offset
        if odd_value % base == 0:
            odd_value += 1
        numbers[odd_index] = odd_value

    elif level == 3:
        # Medium: two-digit multiples (11 to 16) or prime sequence with an imposter
        mode = random.choice(["multiples", "primes"])
        if mode == "multiples":
            base = random.randint(11, 16)
            numbers = [base * (i + 1) for i in range(5)]
            odd_index = random.randint(0, 4)
            odd_value = numbers[odd_index] + random.choice([2, 3, 5, 7])
            numbers[odd_index] = odd_value
        else:
            prime_sets = [
                ([11, 13, 17, 19, 23], 2, 21),   # 11, 13, 21, 19, 23 (21 is composite)
                ([29, 31, 37, 41, 43], 1, 33),   # 29, 33, 37, 41, 43
                ([47, 53, 59, 61, 67], 3, 63),   # 47, 53, 59, 63, 67
                ([71, 73, 79, 83, 89], 2, 77),   # 71, 73, 77, 83, 89
            ]
            primes, odd_index, odd_value = random.choice(prime_sets)
            numbers = primes.copy()
            numbers[odd_index] = odd_value

    elif level == 4:
        # Hard: perfect squares, cubes, or triangular numbers with an imposter
        mode = random.choice(["squares", "cubes", "triangular"])
        if mode == "squares":
            start_n = random.randint(3, 7)
            numbers = [i ** 2 for i in range(start_n, start_n + 5)]
            odd_index = random.randint(1, 3)
            odd_value = numbers[odd_index] + random.choice([3, 5, 7])
            numbers[odd_index] = odd_value
        elif mode == "cubes":
            start_n = random.randint(2, 4)
            numbers = [i ** 3 for i in range(start_n, start_n + 5)]
            odd_index = random.randint(1, 3)
            odd_value = numbers[odd_index] + random.choice([5, 11, 17])
            numbers[odd_index] = odd_value
        else:
            offset = random.randint(1, 8)
            numbers = [int(i * (i + 1) / 2) + offset for i in range(1, 6)]
            odd_index = random.randint(0, 4)
            odd_value = numbers[odd_index] + random.choice([3, 5, 7])
            numbers[odd_index] = odd_value

    else:
        # Expert: powers of 2 with offsets, Fibonacci sequences, or alternating geometric
        mode = random.choice(["powers_of_two", "fibonacci", "alternating"])
        if mode == "powers_of_two":
            start_p = random.randint(1, 4)
            offset = random.randint(1, 5)
            numbers = [(2 ** i) + offset for i in range(start_p, start_p + 5)]
            odd_index = random.randint(1, 3)
            odd_value = numbers[odd_index] + random.choice([3, 5, 9])
            numbers[odd_index] = odd_value
        elif mode == "fibonacci":
            a = random.randint(4, 9)
            b = random.randint(5, 11)
            fibo = [a, b, a + b, a + 2 * b, 2 * a + 3 * b]
            odd_index = random.randint(2, 3)
            odd_value = fibo[odd_index] + random.choice([3, 5, 7])
            numbers = fibo.copy()
            numbers[odd_index] = odd_value
        else:
            curr = random.randint(3, 7)
            seq = [curr]
            for i in range(4):
                curr = curr * 2 if i % 2 == 0 else curr - 2
                seq.append(curr)
            odd_index = random.randint(1, 3)
            odd_value = seq[odd_index] + random.choice([3, 5])
            numbers = seq.copy()
            numbers[odd_index] = odd_value

    options = numbers.copy()
    random.shuffle(options)

    sequence_str = ", ".join(map(str, numbers))
    question = f"Given the sequence:\n{sequence_str}\n\nWhich number does not belong to the pattern?"

    return (
        question,
        json.dumps([str(option) for option in options]),
        str(odd_value),
    )


def generate_pattern(difficulty):
    level = get_difficulty_level(difficulty)

    if level == 1:
        # Beginner: simple step of 1, 2, or 3
        start = random.randint(1, 10)
        diff = random.choice([1, 2, 3])
        sequence = [start + diff * i for i in range(4)]
        correct = sequence[-1] + diff

    elif level == 2:
        # Easy: geometric by 2 or 3, or constant step of 4, 5, 6
        mode = random.choice(["geometric", "step"])
        if mode == "geometric":
            start = random.randint(1, 4)
            multiplier = random.choice([2, 3])
            sequence = [start * (multiplier ** i) for i in range(3)]
            correct = sequence[-1] * multiplier
        else:
            start = random.randint(5, 15)
            step = random.choice([4, 5, 6])
            sequence = [start + step * i for i in range(4)]
            correct = sequence[-1] + step

    elif level == 3:
        # Medium: standard arithmetic progression (difference 7-15) or alternating (+6, -2)
        mode = random.choice(["arithmetic", "alternating_linear"])
        if mode == "arithmetic":
            start = random.randint(8, 30)
            difference = random.randint(7, 15)
            sequence = [start + difference * i for i in range(4)]
            correct = sequence[-1] + difference
        else:
            start = random.randint(5, 12)
            sequence = [start]
            curr = start
            for i in range(3):
                curr = curr + 6 if i % 2 == 0 else curr - 2
                sequence.append(curr)
            correct = curr + 6 if len(sequence) % 2 == 1 else curr - 2

    elif level == 4:
        # Hard: increasing difference (quadratic step +2, +4, +6, +8...)
        start = random.randint(2, 10)
        base_step = random.randint(2, 5)
        sequence = [start]
        curr = start
        for i in range(1, 5):
            curr += base_step * i
            sequence.append(curr)
        correct = curr + base_step * 5

    else:
        # Expert: Fibonacci-like additive, alternating operations (*2, -2), or squares
        pattern_mode = random.choice(["fibonacci", "alternating", "squared_diff"])
        if pattern_mode == "fibonacci":
            a = random.randint(3, 8)
            b = random.randint(4, 9)
            sequence = [a, b, a + b, b + (a + b), (a + b) + (b + (a + b))]
            correct = sequence[-1] + sequence[-2]
        elif pattern_mode == "alternating":
            curr = random.randint(3, 8)
            sequence = [curr]
            for i in range(4):
                if i % 2 == 0:
                    curr = curr * 2
                else:
                    curr = curr - 2
                sequence.append(curr)
            correct = curr * 2 if len(sequence) % 2 == 1 else curr - 2
        else:
            # Squares: n^2 + offset
            offset = random.randint(2, 15)
            start_n = random.randint(3, 8)
            sequence = [(start_n + i) ** 2 + offset for i in range(4)]
            correct = (start_n + 4) ** 2 + offset

    question = (
        f"What is the next number in the pattern? "
        f"{', '.join(map(str, sequence))}, ?"
    )

    options = {correct}

    while len(options) < 4:
        wrong = correct + random.randint(-15, 15)
        if wrong != correct and wrong >= 0:
            options.add(wrong)

    options = list(options)
    random.shuffle(options)

    return (
        question,
        json.dumps([str(option) for option in options]),
        str(correct),
    )


def generate_word(difficulty):
    level = get_difficulty_level(difficulty)

    if level == 1:
        # Beginner: basic everyday antonyms and synonyms
        word_pairs = [
            ("Which word is a synonym of 'Happy'?", "Joyful", ["Joyful", "Sad", "Angry", "Tired"]),
            ("Which word is the opposite of 'Hot'?", "Cold", ["Cold", "Warm", "Boiling", "Soft"]),
            ("Which word is the opposite of 'Big'?", "Small", ["Small", "Large", "Huge", "Heavy"]),
            ("Which word is the opposite of 'Up'?", "Down", ["Down", "Above", "High", "Right"]),
            ("Which word is a synonym of 'Fast'?", "Quick", ["Quick", "Slow", "Heavy", "Late"]),
            ("Which word is a synonym of 'Simple'?", "Easy", ["Easy", "Hard", "Tough", "Dark"]),
            ("Which word is the opposite of 'Dark'?", "Light", ["Light", "Dim", "Black", "Cold"]),
            ("Which word is the opposite of 'Quiet'?", "Loud", ["Loud", "Silent", "Calm", "Soft"]),
        ]
    elif level == 2:
        # Easy: elementary vocabulary
        word_pairs = [
            ("Which word is a synonym of 'Courageous'?", "Brave", ["Brave", "Scared", "Timid", "Weak"]),
            ("Which word is the opposite of 'Ancient'?", "Modern", ["Modern", "Old", "Past", "Historic"]),
            ("Which word is a synonym of 'Tidy'?", "Neat", ["Neat", "Messy", "Dirty", "Rough"]),
            ("Which word is the opposite of 'Vast'?", "Tiny", ["Tiny", "Wide", "Broad", "Grand"]),
            ("Which word is a synonym of 'Calm'?", "Peaceful", ["Peaceful", "Stormy", "Wild", "Noisy"]),
            ("Which word is the opposite of 'Flexible'?", "Rigid", ["Rigid", "Bendable", "Soft", "Supple"]),
            ("Which word is a synonym of 'Swift'?", "Rapid", ["Rapid", "Sluggish", "Slow", "Heavy"]),
            ("Which word is the opposite of 'Generous'?", "Greedy", ["Greedy", "Kind", "Helpful", "Giving"]),
        ]
    elif level == 3:
        # Medium: intermediate vocabulary
        word_pairs = [
            ("Which word is a synonym of 'Abundant'?", "Plentiful", ["Plentiful", "Scarce", "Rare", "Meager"]),
            ("Which word is the opposite of 'Expand'?", "Contract", ["Contract", "Grow", "Increase", "Rise"]),
            ("Which word is a synonym of 'Furious'?", "Enraged", ["Enraged", "Calm", "Happy", "Tired"]),
            ("Which word is the opposite of 'Sturdy'?", "Fragile", ["Fragile", "Strong", "Solid", "Tough"]),
            ("Which word is a synonym of 'Reluctant'?", "Hesitant", ["Hesitant", "Eager", "Ready", "Willing"]),
            ("Which word is the opposite of 'Conceal'?", "Reveal", ["Reveal", "Hide", "Cover", "Mask"]),
            ("Which word is a synonym of 'Diligent'?", "Hardworking", ["Hardworking", "Lazy", "Careless", "Slow"]),
            ("Which word is the opposite of 'Cautious'?", "Reckless", ["Reckless", "Careful", "Alert", "Guarded"]),
        ]
    elif level == 4:
        # Hard: advanced vocabulary
        word_pairs = [
            ("Which word is a synonym of 'Ephemeral'?", "Fleeting", ["Fleeting", "Permanent", "Eternal", "Solid"]),
            ("Which word is the opposite of 'Cacophony'?", "Harmony", ["Harmony", "Noise", "Racket", "Discord"]),
            ("Which word is a synonym of 'Obfuscate'?", "Confuse", ["Confuse", "Clarify", "Explain", "Reveal"]),
            ("Which word is the opposite of 'Meticulous'?", "Careless", ["Careless", "Precise", "Exact", "Strict"]),
            ("Which word is a synonym of 'Pragmatic'?", "Practical", ["Practical", "Idealistic", "Abstract", "Vague"]),
            ("Which word is the opposite of 'Transient'?", "Permanent", ["Permanent", "Brief", "Passing", "Short"]),
            ("Which word is a synonym of 'Lucid'?", "Clear", ["Clear", "Murky", "Confusing", "Vague"]),
            ("Which word is the opposite of 'Benevolent'?", "Malevolent", ["Malevolent", "Kind", "Friendly", "Generous"]),
        ]
    else:
        # Expert: collegiate / GRE vocabulary
        word_pairs = [
            ("Which word is a synonym of 'Sycophant'?", "Flatterer", ["Flatterer", "Leader", "Critic", "Rebel"]),
            ("Which word is the opposite of 'Pusillanimous'?", "Brave", ["Brave", "Cowardly", "Timid", "Fearful"]),
            ("Which word is a synonym of 'Mellifluous'?", "Harmonious", ["Harmonious", "Harsh", "Grating", "Loud"]),
            ("Which word is the opposite of 'Lugubrious'?", "Cheerful", ["Cheerful", "Mournful", "Sad", "Gloomy"]),
            ("Which word is a synonym of 'Perfidious'?", "Treacherous", ["Treacherous", "Loyal", "Faithful", "True"]),
            ("Which word is the opposite of 'Taciturn'?", "Loquacious", ["Loquacious", "Silent", "Quiet", "Reserved"]),
            ("Which word is a synonym of 'Grandiloquent'?", "Pompous", ["Pompous", "Humble", "Modest", "Simple"]),
            ("Which word is the opposite of 'Sanguine'?", "Pessimistic", ["Pessimistic", "Hopeful", "Confident", "Buoyant"]),
        ]

    question, correct, options_list = random.choice(word_pairs)
    options = list(set(options_list))
    random.shuffle(options)

    return (
        question,
        json.dumps(options),
        correct,
    )


def generate_riddle(difficulty):
    level = get_difficulty_level(difficulty)

    if level == 1:
        # Beginner: simple, classic, very intuitive riddles
        riddles = [
            ("What has hands but cannot clap?", "Clock", ["Clock", "Tree", "Phone", "Book"]),
            ("What has to be broken before you can use it?", "Egg", ["Egg", "Glass", "Plate", "Lock"]),
            ("What has legs, but doesn't walk?", "Table", ["Table", "Horse", "Human", "Dog"]),
            ("What has a thumb and four fingers, but is not alive?", "Glove", ["Glove", "Sock", "Shoe", "Hat"]),
            ("What has a head and a tail, but no body?", "Coin", ["Coin", "Snake", "Lizard", "Worm"]),
        ]
    elif level == 2:
        # Easy: everyday conceptual riddles
        riddles = [
            ("I have keys but no locks. I have space but no room. You can enter, but cannot go outside. What am I?", "Keyboard", ["Keyboard", "House", "Car", "Hotel"]),
            ("What gets wetter the more it dries?", "Towel", ["Towel", "Sponge", "Cloud", "Paper"]),
            ("What has a neck but no head?", "Bottle", ["Bottle", "Shirt", "Guitar", "Vase"]),
            ("What goes up but never comes down?", "Age", ["Age", "Balloon", "Smoke", "Plane"]),
            ("What has one eye, but cannot see?", "Needle", ["Needle", "Potato", "Storm", "Tornado"]),
        ]
    elif level == 3:
        # Medium: clever metaphorical riddles
        riddles = [
            ("I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", "Echo", ["Echo", "Ghost", "Whistle", "Shadow"]),
            ("What has cities, but no houses; forests, but no trees; and water, but no fish?", "Map", ["Map", "Globe", "Dream", "Painting"]),
            ("The more of this there is, the less you see. What is it?", "Darkness", ["Darkness", "Fog", "Light", "Smoke"]),
            ("I am tall when I am young, and I am short when I am old. What am I?", "Candle", ["Candle", "Tree", "Pencil", "Human"]),
            ("What can you catch, but never throw?", "Cold", ["Cold", "Ball", "Frisbee", "Fish"]),
        ]
    elif level == 4:
        # Hard: deep conceptual and figurative riddles
        riddles = [
            ("I am taken from a mine, and shut up in a wooden case, from which I am never released, and yet I am used by almost everybody.", "Pencil lead", ["Pencil lead", "Coal", "Diamond", "Gold"]),
            ("I have branches, but no fruit, trunk or leaves. What am I?", "Bank", ["Bank", "River", "Library", "Road"]),
            ("What goes through cities and fields, but never moves?", "Road", ["Road", "Wind", "Water", "Light"]),
            ("If you have me, you want to share me. If you share me, you do not have me. What am I?", "Secret", ["Secret", "Money", "Gift", "Love"]),
            ("I am always hungry and will die if not fed, but whatever I touch will soon turn red. What am I?", "Fire", ["Fire", "Sun", "Rust", "Lava"]),
        ]
    else:
        # Expert: poetic, philosophical, and intricate riddles
        riddles = [
            ("First you eat me, then you get eaten. What am I?", "Fishhook", ["Fishhook", "Bait", "Apple", "Medicine"]),
            ("I can fly without wings. I can cry without eyes. Wherever I go, darkness follows me. What am I?", "Cloud", ["Cloud", "Bat", "Shadow", "Wind"]),
            ("What begins with T, ends with T, and has T in it?", "Teapot", ["Teapot", "Tent", "Tart", "Toast"]),
            ("This thing all things devours: birds, beasts, trees, flowers; gnaws iron, bites steel; grinds hard stones to meal. What is it?", "Time", ["Time", "Fire", "Age", "Death"]),
            ("I never was, am always to be; no one ever saw me, nor ever will; yet I am the confidence of all who live. What am I?", "Tomorrow", ["Tomorrow", "Hope", "Future", "Dream"]),
        ]

    question, correct, options = random.choice(riddles)
    random.shuffle(options)

    return (
        question,
        json.dumps(options),
        correct,
    )


def generate_quiz(difficulty):
    level = get_difficulty_level(difficulty)

    if level == 1:
        # Beginner: universal basic facts
        quizzes = [
            ("How many days are there in a week?", "7", ["5", "6", "7", "8"]),
            ("How many colors are in a standard rainbow?", "7", ["5", "6", "7", "8"]),
            ("At what temperature in Celsius does water freeze?", "0°C", ["0°C", "10°C", "32°C", "100°C"]),
            ("In which direction does the Sun rise?", "East", ["East", "West", "North", "South"]),
            ("How many minutes are in one hour?", "60", ["45", "50", "60", "100"]),
        ]
    elif level == 2:
        # Easy: elementary school trivia
        quizzes = [
            ("Which planet is known as the Red Planet?", "Mars", ["Mars", "Venus", "Jupiter", "Mercury"]),
            ("Which is the largest ocean on Earth?", "Pacific Ocean", ["Atlantic Ocean", "Indian Ocean", "Pacific Ocean", "Arctic Ocean"]),
            ("Which planet is closest to the Sun?", "Mercury", ["Mercury", "Venus", "Mars", "Earth"]),
            ("How many continents are there on Earth?", "7", ["5", "6", "7", "8"]),
            ("What is the primary gas that humans breathe in to survive?", "Oxygen", ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"]),
        ]
    elif level == 3:
        # Medium: general knowledge & trivia
        quizzes = [
            ("What is the chemical symbol for Gold?", "Au", ["Au", "Ag", "Fe", "Cu"]),
            ("Who wrote the play 'Romeo and Juliet'?", "William Shakespeare", ["William Shakespeare", "Charles Dickens", "Mark Twain", "Jane Austen"]),
            ("What is the capital city of Japan?", "Tokyo", ["Tokyo", "Kyoto", "Osaka", "Seoul"]),
            ("How many bones are there in the adult human body?", "206", ["206", "195", "212", "220"]),
            ("Which is the longest river in the world?", "Nile", ["Nile", "Amazon", "Yangtze", "Mississippi"]),
        ]
    elif level == 4:
        # Hard: deeper science, history & literature
        quizzes = [
            ("Which organelle is known as the powerhouse of the cell?", "Mitochondria", ["Mitochondria", "Nucleus", "Ribosome", "Golgi apparatus"]),
            ("In what year did the Titanic sink?", "1912", ["1912", "1905", "1918", "1923"]),
            ("What is the hardest natural mineral substance on Earth?", "Diamond", ["Diamond", "Graphene", "Quartz", "Topaz"]),
            ("What is the approximate speed of light in a vacuum?", "300,000 km/s", ["300,000 km/s", "150,000 km/s", "500,000 km/s", "1,000,000 km/s"]),
            ("Which gas makes up approximately 78% of Earth's atmosphere?", "Nitrogen", ["Nitrogen", "Oxygen", "Carbon Dioxide", "Argon"]),
        ]
    else:
        # Expert: advanced academic, scientific & historical questions
        quizzes = [
            ("Who formulated the general theory of relativity?", "Albert Einstein", ["Albert Einstein", "Isaac Newton", "Niels Bohr", "Max Planck"]),
            ("Which chemical element has the highest melting point?", "Tungsten", ["Tungsten", "Carbon", "Platinum", "Osmium"]),
            ("What was the name of the first artificial Earth satellite launched in 1957?", "Sputnik 1", ["Sputnik 1", "Explorer 1", "Vanguard 1", "Telstar"]),
            ("What temperature corresponds to absolute zero in Celsius?", "-273.15°C", ["-273.15°C", "-200.00°C", "-300.15°C", "-100.00°C"]),
            ("Which subatomic particle discovered at CERN explains how fundamental particles acquire mass?", "Higgs Boson", ["Higgs Boson", "Top Quark", "Tau Neutrino", "Muon"]),
        ]

    question, correct, options = random.choice(quizzes)
    random.shuffle(options)

    return (
        question,
        json.dumps(options),
        correct,
    )


def create_challenge_data(challenge_type, difficulty):
    if challenge_type in ["All Types", "all types", "Random", "random"]:
        challenge_type = random.choice(CHALLENGE_TYPES)

    if challenge_type == "Math Problems":
        return generate_math(difficulty)

    if challenge_type == "Logic Puzzles":
        return generate_logic(difficulty)

    if challenge_type == "Memory Challenges":
        return generate_memory(difficulty)

    if challenge_type == "Word Games":
        return generate_word(difficulty)

    if challenge_type == "Pattern Recognition":
        return generate_pattern(difficulty)

    if challenge_type == "Riddles":
        return generate_riddle(difficulty)

    if challenge_type == "Quick Quizzes":
        return generate_quiz(difficulty)

    return generate_math(difficulty)


def challenge_response(challenge):
    return {
        "id": challenge.id,
        "challenge_type": challenge.challenge_type,
        "difficulty": challenge.difficulty,
        "question": challenge.question,
        "options": (
            json.loads(challenge.options)
            if challenge.options
            else None
        ),
        "status": challenge.status,
        "wake_up_event_id": challenge.wake_up_event_id,
    }


def get_active_wake_up_event(user_id, alarm_id, db):
    return (
        db.query(WakeUpEvent)
        .filter(
            WakeUpEvent.user_id == user_id,
            WakeUpEvent.alarm_id == alarm_id,
            WakeUpEvent.status == "in_progress",
        )
        .order_by(WakeUpEvent.id.desc())
        .first()
    )


def create_wake_up_event(user_id, alarm_id, db, is_test: bool = False):
    existing = get_active_wake_up_event(
        user_id,
        alarm_id,
        db
    )

    alarm = db.query(Alarm).filter(Alarm.id == alarm_id).first()
    req_challenges = alarm.num_challenges if alarm and alarm.num_challenges else 1

    if existing:
        if is_test:
            existing.verification_status = "test_pending"
            existing.difficulty_adapted = False
            existing.completed_challenges = 0
            existing.total_attempts = 0
            existing.required_challenges = req_challenges
            db.commit()
            db.refresh(existing)
        return existing

    event = WakeUpEvent(
        user_id=user_id,
        alarm_id=alarm_id,
        status="in_progress",
        verification_status="test_pending" if is_test else "pending",
        completed_challenges=0,
        total_attempts=0,
        required_challenges=req_challenges,
        difficulty_adapted=False,
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return event


def update_wake_up_event(event, db):
    completed_count = (
        db.query(Challenge)
        .filter(
            Challenge.wake_up_event_id == event.id,
            Challenge.status == "completed",
        )
        .count()
    )

    attempt_count = (
        db.query(ChallengeAttempt)
        .join(
            Challenge,
            Challenge.id == ChallengeAttempt.challenge_id
        )
        .filter(
            Challenge.wake_up_event_id == event.id
        )
        .count()
    )

    event.completed_challenges = completed_count
    event.total_attempts = attempt_count

    if completed_count >= event.required_challenges:
        was_already_completed = (event.status == "completed")
        event.status = "completed"
        is_test_event = event.verification_status in ["test", "test_pending", "test_verified"]
        event.verification_status = "test_verified" if is_test_event else "verified"
        if not event.completed_at:
            event.completed_at = datetime.utcnow()
        
        # Adaptive difficulty hook
        if not was_already_completed and not getattr(event, "difficulty_adapted", False):
            try:
                adapt_alarm_difficulty(event.id, db)
                if not is_test_event:
                    calculate_daily_habit_score(event.user_id, event.id, db)
                else:
                    print(f"[TEST ALARM] Event {event.id} is a manual test. Preserving real user habit scores.")
            except Exception as e:
                print(f"Intelligence engine failed: {e}")

    db.commit()
    db.refresh(event)

    return event


@router.post("/wake-up/start")
def start_wake_up(
    alarm_id: int,
    is_test: bool = False,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("user_id")

    alarm = (
        db.query(Alarm)
        .filter(
            Alarm.id == alarm_id,
            Alarm.user_id == user_id,
        )
        .first()
    )

    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found",
        )

    if not alarm.is_active:
        raise HTTPException(
            status_code=400,
            detail="Alarm is inactive",
        )

    event = create_wake_up_event(
        user_id,
        alarm_id,
        db,
        is_test=is_test
    )

    # Dispatch Alarm-triggered event notification
    create_notification(
        db=db,
        user_id=user_id,
        title=f"Alarm Triggered: {alarm.title}",
        message=f"Your {alarm.time} alarm has triggered. Complete your cognitive challenge to verify wake-up and dismiss.",
        category="alarm",
        priority="high",
        link="/wake-up-challenge",
        related_entity_type="alarm",
        related_entity_id=alarm.id,
        prevent_duplicate=True
    )

    return {
        "message": "Wake-up verification started",
        "wake_up_event_id": event.id,
        "alarm_id": alarm_id,
        "required_challenges": event.required_challenges,
        "completed_challenges": event.completed_challenges,
        "verification_status": event.verification_status,
        "sound_tone": alarm.sound_tone,
    }


@router.get("/wake-up/{event_id}")
def get_wake_up_event(
    event_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("user_id")

    event = (
        db.query(WakeUpEvent)
        .filter(
            WakeUpEvent.id == event_id,
            WakeUpEvent.user_id == user_id,
        )
        .first()
    )

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Wake-up event not found",
        )

    return {
        "id": event.id,
        "alarm_id": event.alarm_id,
        "started_at": event.started_at,
        "completed_at": event.completed_at,
        "status": event.status,
        "required_challenges": event.required_challenges,
        "completed_challenges": event.completed_challenges,
        "total_attempts": event.total_attempts,
        "verification_status": event.verification_status,
    }


@router.post("/generate")
def generate_challenge(
    req: GenerateChallengeRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("user_id")

    alarm = None
    if req.alarm_id:
        alarm = (
            db.query(Alarm)
            .filter(
                Alarm.id == req.alarm_id,
                Alarm.user_id == user_id,
            )
            .first()
        )

    if not alarm and req.wake_up_event_id:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found",
        )

    event = None

    if req.wake_up_event_id:
        event = (
            db.query(WakeUpEvent)
            .filter(
                WakeUpEvent.id == req.wake_up_event_id,
                WakeUpEvent.user_id == user_id,
                WakeUpEvent.alarm_id == req.alarm_id,
                WakeUpEvent.status == "in_progress",
            )
            .first()
        )

        if not event:
            raise HTTPException(
                status_code=404,
                detail="Wake-up event not found",
            )

    elif req.alarm_id and alarm:
        event = create_wake_up_event(
            user_id,
            req.alarm_id,
            db,
            is_test=getattr(req, "is_test", False)
        )

    from services.analytics import get_user_adaptive_difficulty
    user_adaptive = get_user_adaptive_difficulty(user_id, db)

    if req.difficulty:
        difficulty = normalize_difficulty(req.difficulty)
    elif alarm and alarm.difficulty:
        difficulty = normalize_difficulty(alarm.difficulty)
    else:
        difficulty = normalize_difficulty(user_adaptive)

    challenge_type = normalize_challenge_type(
        req.challenge_type or (alarm.challenge_type if alarm else "Math Problems")
    )

    question, options, correct_answer = create_challenge_data(
        challenge_type,
        difficulty,
    )

    challenge = Challenge(
        user_id=user_id,
        alarm_id=req.alarm_id if alarm else None,
        wake_up_event_id=event.id if event else None,
        challenge_type=challenge_type,
        difficulty=difficulty,
        question=question,
        options=options,
        correct_answer=correct_answer,
        status="pending",
    )

    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    # Dispatch Cognitive challenge availability notification
    create_notification(
        db=db,
        user_id=user_id,
        title="Cognitive Challenge Ready",
        message=f"{challenge.difficulty} {challenge.challenge_type} is now active. Solve it to verify your alertness.",
        category="challenge",
        priority="normal",
        link="/wake-up-challenge",
        related_entity_type="challenge",
        related_entity_id=challenge.id,
        prevent_duplicate=True
    )

    return challenge_response(challenge)


@router.get("/history/all")
def get_history(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("user_id")

    challenges = (
        db.query(Challenge)
        .filter(
            Challenge.user_id == user_id,
            Challenge.status != "pending",
        )
        .order_by(Challenge.id.desc())
        .limit(50)
        .all()
    )

    history = []

    for challenge in challenges:
        attempts = (
            db.query(ChallengeAttempt)
            .filter(
                ChallengeAttempt.challenge_id == challenge.id
            )
            .order_by(
                ChallengeAttempt.attempt_number.asc()
            )
            .all()
        )

        correct_attempt = next(
            (
                attempt
                for attempt in attempts
                if attempt.is_correct
            ),
            None,
        )

        history.append(
            {
                "id": challenge.id,
                "created_at": challenge.created_at,
                "challenge_type": challenge.challenge_type,
                "difficulty": challenge.difficulty,
                "status": challenge.status,
                "score": (
                    correct_attempt.score
                    if correct_attempt
                    else 0
                ),
                "solve_time": (
                    correct_attempt.solve_time
                    if correct_attempt
                    else 0
                ),
                "attempts": len(attempts),
                "wake_up_event_id": challenge.wake_up_event_id,
            }
        )

    return history


@router.delete("/history/all")
def delete_history(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("user_id")

    # Delete attempts
    db.query(ChallengeAttempt).filter(
        ChallengeAttempt.challenge_id.in_(
            db.query(Challenge.id).filter(Challenge.user_id == user_id)
        )
    ).delete(synchronize_session=False)

    # Delete challenges
    db.query(Challenge).filter(Challenge.user_id == user_id).delete(synchronize_session=False)

    # Delete wake-up events
    db.query(WakeUpEvent).filter(WakeUpEvent.user_id == user_id).delete(synchronize_session=False)

    db.commit()

    return {"message": "All challenge history and statistics have been reset successfully."}


@router.get("/analytics/stats")
def get_analytics(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("user_id")

    challenges = (
        db.query(Challenge)
        .filter(
            Challenge.user_id == user_id
        )
        .all()
    )

    total_challenges = len(challenges)

    completed = sum(
        1
        for challenge in challenges
        if challenge.status == "completed"
    )

    failed = sum(
        1
        for challenge in challenges
        if challenge.status == "failed"
    )

    pending = sum(
        1
        for challenge in challenges
        if challenge.status == "pending"
    )

    evaluated = completed + failed

    success_rate = (
        completed / evaluated * 100
        if evaluated > 0
        else 0
    )

    attempts = (
        db.query(ChallengeAttempt)
        .filter(
            ChallengeAttempt.user_id == user_id
        )
        .all()
    )

    total_attempts = len(attempts)

    correct_attempts = [
        attempt
        for attempt in attempts
        if attempt.is_correct
    ]

    accuracy = (
        len(correct_attempts)
        / total_attempts
        * 100
        if total_attempts > 0
        else 0
    )

    average_score = (
        sum(attempt.score for attempt in attempts)
        / len(attempts)
        if attempts
        else 0
    )

    solve_times = [
        attempt.solve_time
        for attempt in attempts
        if attempt.solve_time is not None
        and attempt.solve_time >= 0
    ]

    average_solve_time = (
        sum(solve_times)
        / len(solve_times)
        if solve_times
        else 0
    )

    type_stats = {}

    for challenge in challenges:
        challenge_type = challenge.challenge_type

        if challenge_type not in type_stats:
            type_stats[challenge_type] = {
                "total": 0,
                "completed": 0,
                "failed": 0,
                "success_rate": 0,
            }

        type_stats[challenge_type]["total"] += 1

        if challenge.status == "completed":
            type_stats[challenge_type]["completed"] += 1

        elif challenge.status == "failed":
            type_stats[challenge_type]["failed"] += 1

    for challenge_type, stats in type_stats.items():
        evaluated_count = (
            stats["completed"]
            + stats["failed"]
        )

        stats["success_rate"] = (
            stats["completed"]
            / evaluated_count
            * 100
            if evaluated_count > 0
            else 0
        )

    wake_up_events = (
        db.query(WakeUpEvent)
        .filter(
            WakeUpEvent.user_id == user_id
        )
        .all()
    )

    total_wake_up_events = len(wake_up_events)

    verified_wake_ups = sum(
        1
        for event in wake_up_events
        if event.verification_status == "verified"
    )

    wake_up_success_rate = (
        verified_wake_ups
        / total_wake_up_events
        * 100
        if total_wake_up_events > 0
        else 0
    )

    from datetime import datetime, timedelta
    
    completed_challenges_sorted = sorted(
        [c for c in challenges if c.status == "completed" and c.created_at],
        key=lambda x: x.created_at,
        reverse=True
    )
    
    streak = 0
    if completed_challenges_sorted:
        current_date = datetime.utcnow().date()
        completed_dates = sorted(list(set([c.created_at.date() for c in completed_challenges_sorted])), reverse=True)
        
        if completed_dates and (completed_dates[0] == current_date or completed_dates[0] == current_date - timedelta(days=1)):
            streak = 1
            for i in range(1, len(completed_dates)):
                if completed_dates[i] == completed_dates[i-1] - timedelta(days=1):
                    streak += 1
                else:
                    break

    return {
        "total_challenges": total_challenges,
        "completed": completed,
        "failed": failed,
        "pending": pending,
        "evaluated": evaluated,
        "success_rate": round(success_rate, 2),
        "total_attempts": total_attempts,
        "accuracy": round(accuracy, 2),
        "average_score": round(average_score, 2),
        "average_solve_time": round(
            average_solve_time,
            2,
        ),
        "total_wake_up_events": total_wake_up_events,
        "verified_wake_ups": verified_wake_ups,
        "wake_up_success_rate": round(
            wake_up_success_rate,
            2,
        ),
        "streak": streak,
        "type_stats": type_stats,
        "current_difficulty": get_user_adaptive_difficulty(user_id, db),
    }


@router.get("/{challenge_id}")
def get_challenge(
    challenge_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("user_id")

    challenge = (
        db.query(Challenge)
        .filter(
            Challenge.id == challenge_id,
            Challenge.user_id == user_id,
        )
        .first()
    )

    if not challenge:
        raise HTTPException(
            status_code=404,
            detail="Challenge not found",
        )

    return challenge_response(challenge)


@router.post("/{challenge_id}/submit")
def submit_challenge(
    challenge_id: int,
    req: SubmitChallengeRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.get("user_id")

    challenge = (
        db.query(Challenge)
        .filter(
            Challenge.id == challenge_id,
            Challenge.user_id == user_id,
        )
        .first()
    )

    if not challenge:
        raise HTTPException(
            status_code=404,
            detail="Challenge not found",
        )

    if challenge.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Challenge already evaluated",
        )

    event = None

    if challenge.wake_up_event_id:
        event = (
            db.query(WakeUpEvent)
            .filter(
                WakeUpEvent.id == challenge.wake_up_event_id,
                WakeUpEvent.user_id == user_id,
                WakeUpEvent.status == "in_progress",
            )
            .first()
        )

        if not event:
            raise HTTPException(
                status_code=400,
                detail="Wake-up verification session is not active",
            )

    existing_attempts = (
        db.query(ChallengeAttempt)
        .filter(
            ChallengeAttempt.challenge_id == challenge.id
        )
        .count()
    )

    attempt_number = existing_attempts + 1

    answer = (
        req.answer or ""
    ).strip().lower()

    correct_answer = (
        challenge.correct_answer or ""
    ).strip().lower()

    is_correct = answer == correct_answer

    if is_correct:
        if attempt_number == 1:
            score = 100
        elif attempt_number == 2:
            score = 75
        else:
            score = 50

        challenge.status = "completed"

        message = "Challenge completed successfully."

    else:
        score = 0

        challenge.status = "failed"

        message = (
            "Incorrect answer. "
            "A new challenge is ready."
        )

    if not is_correct:
        create_notification(
            db=db,
            user_id=user_id,
            title="Challenge Attempt Incorrect",
            message="Your answer was incorrect. A retry challenge has been prepared.",
            category="challenge",
            priority="normal",
            link="/wake-up-challenge",
            related_entity_type="challenge",
            related_entity_id=challenge.id,
            prevent_duplicate=False
        )

    attempt = ChallengeAttempt(
        challenge_id=challenge.id,
        user_id=user_id,
        attempt_number=attempt_number,
        user_answer=req.answer,
        is_correct=is_correct,
        score=score,
        solve_time=req.solve_time,
    )

    db.add(attempt)
    db.commit()

    next_challenge = None

    # Note: We do not alter difficulty midway through an ongoing verification session.
    # Adaptive difficulty evaluation runs once the user completes the wake-up verification.

    adaptation_data = None

    if event:
        event.total_attempts += 1

        if is_correct:
            event.completed_challenges += 1

        if event.completed_challenges >= event.required_challenges:
            was_already_completed = (event.status == "completed")
            event.status = "completed"
            is_test_event = event.verification_status in ["test", "test_pending", "test_verified"]
            event.verification_status = "test_verified" if is_test_event else "verified"
            if not event.completed_at:
                event.completed_at = datetime.utcnow()

            # Trigger adaptive difficulty and daily habit score
            if (not was_already_completed and not getattr(event, "difficulty_adapted", False)) or is_test_event:
                try:
                    event.difficulty_adapted = False
                    adaptation_data = adapt_alarm_difficulty(event.id, db)
                    if not is_test_event:
                        calculate_daily_habit_score(event.user_id, event.id, db)
                    else:
                        print(f"[TEST ALARM] Event {event.id} adapted difficulty. Preserving real user habit scores.")
                    if event.alarm:
                        db.refresh(event.alarm)
                except Exception as e:
                    print(f"Adaptive difficulty hook failed: {e}")

                # Dispatch Successful wake-up verification & alarm dismissal notification
                create_notification(
                    db=db,
                    user_id=user_id,
                    title="Wake-Up Verified & Alarm Dismissed",
                    message="Wake-up verification completed successfully! All required challenges were passed and your alarm has been dismissed.",
                    category="alarm",
                    priority="high",
                    link="/wake-up-challenge",
                    related_entity_type="wake_up_event",
                    related_entity_id=event.id,
                    prevent_duplicate=True
                )

            message = (
                "Wake-up verification completed successfully."
            )

        else:
            # Session is still in progress; keep the challenge difficulty consistent
            session_diff = challenge.difficulty

            next_type = challenge.challenge_type
            if event and event.alarm and event.alarm.challenge_type in ["All Types", "all types", "Random", "random"]:
                next_type = random.choice(CHALLENGE_TYPES)

            question, options, correct_answer = create_challenge_data(
                next_type,
                session_diff,
            )

            next_challenge = Challenge(
                user_id=user_id,
                alarm_id=challenge.alarm_id,
                wake_up_event_id=event.id,
                challenge_type=next_type,
                difficulty=session_diff,
                question=question,
                options=options,
                correct_answer=correct_answer,
                status="pending",
            )

            db.add(next_challenge)

    else:
        # Standalone or Practice challenge completed
        if is_correct:
            try:
                target_alarm = None
                if challenge.alarm_id:
                    target_alarm = db.query(Alarm).filter(Alarm.id == challenge.alarm_id, Alarm.user_id == user_id).first()
                if not target_alarm:
                    target_alarm = db.query(Alarm).filter(Alarm.user_id == user_id).order_by(Alarm.id.asc()).first()
                if target_alarm:
                    from services.difficulty_engine import get_next_difficulty
                    from services.analytics import get_user_adaptive_difficulty
                    from Models.user import UserProfile
                    current_diff = target_alarm.difficulty or "Beginner"
                    adaptation_data = get_next_difficulty(
                        correctness=1.0,
                        solve_time=float(req.solve_time or 5.0),
                        attempts=attempt_number,
                        current_difficulty=current_diff
                    )
                    new_diff = adaptation_data.get("next_difficulty", current_diff)

                    user_tier = get_user_adaptive_difficulty(user_id, db)
                    next_idx = DIFFICULTIES.index(new_diff) if new_diff in DIFFICULTIES else 0
                    tier_idx = DIFFICULTIES.index(user_tier) if user_tier in DIFFICULTIES else 0
                    final_diff = DIFFICULTIES[max(next_idx, tier_idx)]

                    target_alarm.difficulty = final_diff
                    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
                    if profile:
                        profile.difficulty_preference = final_diff
                    db.commit()
                    db.refresh(target_alarm)
            except Exception as e:
                print(f"[PRACTICE ADAPTIVE] Failed to adapt practice difficulty: {e}")

    db.commit()

    if next_challenge:
        db.refresh(next_challenge)

    active_alarm_diff = None
    if event and event.alarm:
        active_alarm_diff = event.alarm.difficulty
    elif 'target_alarm' in locals() and target_alarm:
        active_alarm_diff = target_alarm.difficulty
    elif challenge.alarm_id:
        a_rec = db.query(Alarm).filter(Alarm.id == challenge.alarm_id).first()
        if a_rec:
            active_alarm_diff = a_rec.difficulty

    response = {
        "correct": is_correct,
        "score": score,
        "attempt": attempt_number,
        "message": message,
        "solve_time": req.solve_time,
        "status": challenge.status,
        "alarm_difficulty": active_alarm_diff,
        "adaptation": adaptation_data,
        "verified": (
            event.verification_status in ["verified", "test_verified"]
            if event
            else is_correct
        ),
        "wake_up_event_id": (
            event.id
            if event
            else None
        ),
        "completed_challenges": (
            event.completed_challenges
            if event
            else 0
        ),
        "required_challenges": (
            event.required_challenges
            if event
            else 0
        ),
    }

    if next_challenge:
        response["next_challenge"] = challenge_response(
            next_challenge
        )

    return response