"""Pattern, riddle and quiz challenges, plus beginner and expert banks.

Free-text riddles list every accepted answer in metadata["accepted_answers"].
"""
import random

LEVELS = ["beginner", "easy", "medium", "hard", "expert"]


def _check_level(difficulty: str) -> str:
    difficulty = difficulty.lower()
    if difficulty not in LEVELS:
        raise ValueError(
            "Invalid difficulty. Use beginner, easy, medium, hard, or expert."
        )
    return difficulty


def _build(
    challenge_type: str,
    difficulty: str,
    question: str,
    answer: str,
    options: list[str] | None = None,
    accepted: list[str] | None = None,
) -> dict:
    result = {
        "challenge_type": challenge_type,
        "difficulty": difficulty,
        "question": question,
        "correct_answer": str(answer),
        "options": options,
    }
    if accepted:
        result["metadata"] = {"accepted_answers": accepted}
    return result


# ---------------------------------------------------------------------
# Pattern recognition
# ---------------------------------------------------------------------

def _sequence_question(terms: list[int]) -> str:
    shown = ", ".join(str(t) for t in terms)
    return f"What comes next in the pattern: {shown}, ?"


def _pattern_beginner() -> tuple[list[int], int]:
    step = random.choice([1, 2, 5, 10])
    start = random.randint(1, 10)
    terms = [start + step * i for i in range(5)]
    return terms, start + step * 5


def _pattern_easy() -> tuple[list[int], int]:
    step = random.randint(3, 9)
    start = random.randint(2, 30)
    terms = [start + step * i for i in range(5)]
    return terms, start + step * 5


def _pattern_medium() -> tuple[list[int], int]:
    if random.random() < 0.5:
        ratio = random.choice([2, 3])
        start = random.randint(1, 4)
        terms = [start * ratio ** i for i in range(5)]
        return terms, start * ratio ** 5
    base = random.randint(1, 4)
    terms = [(base + i) ** 2 for i in range(5)]
    return terms, (base + 5) ** 2


def _pattern_hard() -> tuple[list[int], int]:
    if random.random() < 0.5:
        # Fibonacci-style: each term is the sum of the two before it.
        a, b = random.randint(1, 5), random.randint(1, 5)
        terms = [a, b]
        for _ in range(4):
            terms.append(terms[-1] + terms[-2])
        return terms, terms[-1] + terms[-2]
    # Two interleaved sequences.
    first_step = random.randint(2, 5)
    second_step = random.randint(3, 7)
    a, b = random.randint(1, 10), random.randint(20, 40)
    terms = [
        a, b,
        a + first_step, b - second_step,
        a + 2 * first_step, b - 2 * second_step,
        a + 3 * first_step,
    ]
    return terms, b - 3 * second_step


def _pattern_expert() -> tuple[list[int], int]:
    # The gaps grow by a fixed amount each time (second-order pattern).
    start = random.randint(1, 10)
    gap = random.randint(1, 4)
    growth = random.randint(1, 3)
    terms = [start]
    for i in range(6):
        terms.append(terms[-1] + gap + growth * i)
    next_value = terms[-1] + gap + growth * 6
    return terms, next_value


_PATTERNS = {
    "beginner": _pattern_beginner,
    "easy": _pattern_easy,
    "medium": _pattern_medium,
    "hard": _pattern_hard,
    "expert": _pattern_expert,
}


def generate_pattern_challenge(difficulty: str) -> dict:
    difficulty = _check_level(difficulty)
    terms, answer = _PATTERNS[difficulty]()
    return _build(
        "pattern", difficulty, _sequence_question(terms), str(answer)
    )


# ---------------------------------------------------------------------
# Riddles
# ---------------------------------------------------------------------

_RIDDLES = {
    "beginner": [
        ("What has hands but cannot clap?", "clock", ["a clock"]),
        ("What gets wetter the more it dries?", "towel", ["a towel"]),
        ("What has keys but cannot open any lock?", "piano", ["a piano", "keyboard"]),
        ("What goes up when the rain comes down?", "umbrella", ["an umbrella"]),
    ],
    "easy": [
        ("What has a neck but no head?", "bottle", ["a bottle"]),
        ("What can you catch but never throw?", "cold", ["a cold"]),
        ("What has to be broken before you can use it?", "egg", ["an egg"]),
        ("The more of me you take, the more you leave behind. What am I?", "footsteps", ["steps", "footstep", "step"]),
    ],
    "medium": [
        ("What has many teeth but cannot bite?", "comb", ["a comb"]),
        ("What comes once in a minute, twice in a moment, and never in a thousand years?", "m", ["the letter m", "letter m"]),
        ("I speak without a mouth and hear without ears. What am I?", "echo", ["an echo"]),
        ("What can travel around the world while staying in one corner?", "stamp", ["a stamp"]),
    ],
    "hard": [
        ("What is full of holes but still holds water?", "sponge", ["a sponge"]),
        ("What belongs to you, but other people use it more than you do?", "name", ["your name", "a name"]),
        ("What gets bigger the more you take away from it?", "hole", ["a hole"]),
        ("What runs but never walks, and has a mouth but never talks?", "river", ["a river"]),
    ],
    "expert": [
        ("What five-letter word becomes shorter when you add two letters to it?", "short", []),
        ("I am not alive, but I grow. I have no lungs, but I need air. What am I?", "fire", ["a fire"]),
        ("What begins with T, ends with T, and has T in it?", "teapot", ["a teapot"]),
        ("Forward I am heavy, but backward I am not. What am I?", "ton", ["a ton"]),
    ],
}


def generate_riddle_challenge(difficulty: str) -> dict:
    difficulty = _check_level(difficulty)
    question, answer, accepted = random.choice(_RIDDLES[difficulty])
    return _build(
        "riddle",
        difficulty,
        question + " (one or two words)",
        answer,
        None,
        [answer, *accepted],
    )


# ---------------------------------------------------------------------
# Quick quizzes
# ---------------------------------------------------------------------

_QUIZZES = {
    "beginner": [
        ("Which planet is known as the Red Planet?", "Mars", ["Venus", "Jupiter", "Saturn"]),
        ("How many days are in a week?", "7", ["5", "6", "8"]),
        ("Which color do you get by mixing blue and yellow?", "Green", ["Purple", "Orange", "Brown"]),
        ("Which animal says 'moo'?", "Cow", ["Dog", "Cat", "Duck"]),
    ],
    "easy": [
        ("What is the capital of France?", "Paris", ["Rome", "Madrid", "Berlin"]),
        ("How many continents are there on Earth?", "7", ["5", "6", "8"]),
        ("Which gas do plants take in from the air?", "Carbon dioxide", ["Oxygen", "Nitrogen", "Helium"]),
        ("What is the largest ocean on Earth?", "Pacific Ocean", ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean"]),
    ],
    "medium": [
        ("Which element has the chemical symbol Fe?", "Iron", ["Fluorine", "Lead", "Tin"]),
        ("In which year did India gain independence?", "1947", ["1942", "1950", "1935"]),
        ("Who wrote the play Romeo and Juliet?", "William Shakespeare", ["Charles Dickens", "Mark Twain", "Jane Austen"]),
        ("How many bones are in an adult human body?", "206", ["106", "256", "306"]),
    ],
    "hard": [
        ("What is the smallest prime number?", "2", ["1", "3", "0"]),
        ("Which scientist proposed the theory of general relativity?", "Albert Einstein", ["Isaac Newton", "Niels Bohr", "Galileo Galilei"]),
        ("What is the chemical symbol for gold?", "Au", ["Ag", "Gd", "Go"]),
        ("Which layer of the atmosphere contains the ozone layer?", "Stratosphere", ["Troposphere", "Mesosphere", "Thermosphere"]),
    ],
    "expert": [
        ("What is the SI unit of electrical resistance?", "Ohm", ["Volt", "Watt", "Farad"]),
        ("Which part of the brain mainly controls balance and coordination?", "Cerebellum", ["Cerebrum", "Hippocampus", "Thalamus"]),
        ("About how fast does light travel in a vacuum?", "300,000 km/s", ["30,000 km/s", "3,000 km/s", "3,000,000 km/s"]),
        ("Who announced the first practical polio vaccine in 1955?", "Jonas Salk", ["Louis Pasteur", "Edward Jenner", "Alexander Fleming"]),
    ],
}


def generate_quiz_challenge(difficulty: str) -> dict:
    difficulty = _check_level(difficulty)
    question, answer, wrong = random.choice(_QUIZZES[difficulty])
    options = [answer, *wrong]
    random.shuffle(options)
    return _build("quiz", difficulty, question, answer, options)


# ---------------------------------------------------------------------
# Beginner and expert banks for logic and word challenges
# ---------------------------------------------------------------------

_LOGIC = {
    "beginner": [
        ("What day comes after Wednesday?", "thursday"),
        ("How many legs do two dogs have in total?", "8"),
        ("You have 3 apples and eat 1. How many are left?", "2"),
        ("Which number is bigger: 9 or 6?", "9"),
    ],
    "expert": [
        ("A farmer has 17 sheep. All but 9 run away. How many are left?", "9"),
        ("5 machines make 5 widgets in 5 minutes. How many minutes do 100 machines need to make 100 widgets?", "5"),
        ("What is the next prime number after 23?", "29"),
        ("A bat and a ball cost 110 cents in total. The bat costs 100 cents more than the ball. How many cents does the ball cost?", "5"),
    ],
}


def generate_extra_logic(difficulty: str) -> dict:
    difficulty = _check_level(difficulty)
    question, answer = random.choice(_LOGIC[difficulty])
    return _build("logic", difficulty, question, answer)


_WORDS = {
    "beginner": [
        ("Which word is the opposite of 'up'?", "down", ["down", "left", "over", "high"]),
        ("Which word names a color?", "blue", ["blue", "chair", "run", "soft"]),
        ("Which word is an animal?", "horse", ["table", "horse", "cloud", "spoon"]),
        ("Which word means the same as 'big'?", "large", ["tiny", "large", "thin", "short"]),
    ],
    "expert": [
        ("Which word is the opposite of 'ephemeral'?", "permanent", ["fleeting", "permanent", "brief", "temporary"]),
        ("Which word means 'to make less severe'?", "mitigate", ["exacerbate", "mitigate", "aggravate", "intensify"]),
        ("Which word is closest in meaning to 'ubiquitous'?", "omnipresent", ["rare", "omnipresent", "hidden", "ancient"]),
        ("Which word means 'unwilling to change your opinion'?", "obstinate", ["flexible", "obstinate", "generous", "hesitant"]),
    ],
}


def generate_extra_word(difficulty: str) -> dict:
    difficulty = _check_level(difficulty)
    question, answer, options = random.choice(_WORDS[difficulty])
    shuffled = list(options)
    random.shuffle(shuffled)
    return _build("word", difficulty, question, answer, shuffled)
