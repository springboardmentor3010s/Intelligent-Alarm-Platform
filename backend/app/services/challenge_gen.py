"""Cognitive challenge generation for all 7 challenge types x 5 difficulty levels.

Math, pattern, memory and word challenges are generated procedurally (so users never see
a memorised question twice); logic, riddles and quizzes are drawn from a curated bank.
Correct answers are stored server-side only.
"""
import random
import re

from app.models import LEVELS

TIME_LIMITS = {"beginner": 60, "easy": 50, "medium": 45, "hard": 40, "expert": 35}


def lvl(difficulty: str) -> int:
    return LEVELS.index(difficulty) if difficulty in LEVELS else 1


def normalize(s: str) -> str:
    return re.sub(r"[^a-z0-9.\-]", "", (s or "").lower())


def _strip_article(s: str) -> str:
    return re.sub(r"^\s*(the|a|an)\s+", "", (s or "").strip(), flags=re.I)


def answers_match(user_answer: str, correct: str) -> bool:
    u = normalize(_strip_article(user_answer))
    return bool(u) and any(u == normalize(_strip_article(alt)) for alt in correct.split("|"))


# ----------------------------- procedural generators -----------------------------

def _math(i: int, r: random.Random):
    if i == 0:
        a, b = r.randint(3, 20), r.randint(3, 20)
        return f"What is {a} + {b}?", str(a + b)
    if i == 1:
        if r.random() < 0.5:
            a, b = r.randint(3, 9), r.randint(3, 12)
            return f"What is {a} × {b}?", str(a * b)
        a, b = r.randint(40, 99), r.randint(11, 39)
        return f"What is {a} − {b}?", str(a - b)
    if i == 2:
        a, b, c = r.randint(6, 15), r.randint(3, 9), r.randint(10, 60)
        return f"What is {a} × {b} + {c}?", str(a * b + c)
    if i == 3:
        a, b, c, d = r.randint(5, 20), r.randint(5, 20), r.randint(3, 9), r.randint(5, 40)
        return f"What is ({a} + {b}) × {c} − {d}?", str((a + b) * c - d)
    d, q = r.randint(3, 9), r.randint(6, 20)
    a, b, e = r.randint(11, 25), r.randint(6, 15), r.randint(5, 50)
    return f"What is ({a} × {b}) − ({d * q} ÷ {d}) + {e}?", str(a * b - q + e)


def _pattern(i: int, r: random.Random):
    if i == 0:
        s, k = r.randint(1, 10), r.randint(2, 5)
        seq = [s + k * n for n in range(5)]
    elif i == 1:
        s, k = r.randint(10, 50), r.randint(6, 12)
        seq = [s + k * n for n in range(5)] if r.random() < 0.5 else [s + 40 - k * n for n in range(5)]
    elif i == 2:
        s, k = r.randint(1, 4), r.choice([2, 3])
        seq = [s * k ** n for n in range(5)]
    elif i == 3:
        start, step = r.randint(1, 6), r.randint(1, 3)
        seq, cur = [], start
        for n in range(6):  # differences grow by `step`
            seq.append(cur)
            cur += step * (n + 1)
    else:
        if r.random() < 0.5:
            a, b = r.randint(1, 4), r.randint(1, 4)
            seq = [a, b]
            for _ in range(5):
                seq.append(seq[-1] + seq[-2])
        else:
            c = r.randint(1, 5)
            seq = [n * n + c for n in range(1, 8)]
    shown, answer = seq[:-1], seq[-1]
    return "What comes next: " + ", ".join(map(str, shown)) + ", ?", str(answer)


def _memory(i: int, r: random.Random):
    length = [3, 4, 5, 6, 7][i]
    digits = [r.randint(1, 9) for _ in range(length)]
    display = " ".join(map(str, digits))
    reveal = max(3, length + 1)
    if i == 0:
        n = r.randint(1, length)
        return f"What was digit number {n} in the sequence?", str(digits[n - 1]), display, reveal
    if i == 1:
        return "What was the FIRST digit?", str(digits[0]), display, reveal
    if i == 2:
        return "What was the SUM of all the digits?", str(sum(digits)), display, reveal
    if i == 3:
        return "Type the sequence in REVERSE order (digits only).", "".join(map(str, digits[::-1])), display, reveal
    return "Type the sequence in REVERSE order (digits only).", "".join(map(str, digits[::-1])), display, reveal


_WORDS = [
    ["sunny", "clock", "bread", "water", "light", "green", "happy", "music", "dream", "smile"],
    ["morning", "sunrise", "pillow", "coffee", "window", "bright", "energy", "wakeful"],
    ["schedule", "mountain", "elephant", "calendar", "keyboard", "notebook", "umbrella"],
    ["adventure", "knowledge", "challenge", "chocolate", "discipline", "brilliant", "wonderful"],
    ["productivity", "concentration", "determination", "imagination", "achievement"],
]


def _word(i: int, r: random.Random):
    word = r.choice(_WORDS[i])
    letters = list(word)
    for _ in range(10):
        r.shuffle(letters)
        if "".join(letters) != word:
            break
    return f"Unscramble this word: {''.join(letters).upper()}", word


# ----------------------------- curated banks -----------------------------
# (level, prompt, accepted answers separated by |)
_LOGIC = [
    (0, "If today is Monday, what day will it be in 3 days?", "thursday"),
    (0, "Which is heavier: 1 kg of iron or 1 kg of feathers? (answer: same, iron or feathers)", "same"),
    (1, "A farmer has 17 sheep. All but 9 run away. How many are left?", "9|nine"),
    (1, "Mary's father has five daughters: Nana, Nene, Nini, Nono and ...? (one word)", "mary"),
    (2, "5 machines make 5 widgets in 5 minutes. How many minutes do 100 machines need to make 100 widgets?", "5|five"),
    (2, "What is the next letter in the series: O, T, T, F, F, S, S, ?", "e"),
    (2, "How many months have 28 days?", "12|twelve|all"),
    (3, "A bat and a ball cost 110 cents together. The bat costs 100 cents more than the ball. How many cents is the ball?", "5|five"),
    (3, "You overtake the person in 2nd place in a race. What position are you in now?", "2|second|2nd"),
    (3, "If you have only one match and enter a dark room with a candle, a lamp and a stove, what do you light first?", "match|thematch|the match"),
    (4, "A doctor gives you 3 pills, one to take every half hour. How many minutes until all pills are taken?", "60|sixty"),
    (4, "Two fathers and two sons go fishing and each catches one fish, 3 fish in total. How many people went fishing?", "3|three"),
    (4, "How many times can you subtract 5 from 25?", "1|once|one"),
]

_RIDDLES = [
    (0, "What has hands but can't clap?", "clock|a clock"),
    (0, "What has to be broken before you can use it?", "egg|an egg"),
    (0, "What gets wetter the more it dries?", "towel|a towel"),
    (1, "I speak without a mouth and hear without ears. What am I?", "echo|an echo"),
    (1, "What has keys but can't open locks?", "piano|keyboard|a piano|a keyboard"),
    (1, "What has a neck but no head?", "bottle|a bottle"),
    (2, "What can travel around the world while staying in a corner?", "stamp|a stamp"),
    (2, "The more you take, the more you leave behind. What am I?", "footsteps|steps"),
    (2, "What has one eye but cannot see?", "needle|a needle"),
    (3, "I have cities but no houses, mountains but no trees, and water but no fish. What am I?", "map|a map"),
    (3, "What is full of holes but still holds water?", "sponge|a sponge"),
    (4, "What comes once in a minute, twice in a moment, but never in a thousand years? (one letter)", "m|the letter m"),
    (4, "What can you catch but not throw?", "cold|a cold"),
]

_QUIZ = [
    (0, "Which planet is known as the Red Planet?", "Mars", ["Earth", "Venus", "Jupiter"]),
    (0, "What is the capital of India?", "New Delhi", ["Mumbai", "Kolkata", "Chennai"]),
    (0, "H₂O is the chemical formula for?", "Water", ["Salt", "Oxygen", "Hydrogen"]),
    (1, "Which gas do plants absorb from the air?", "Carbon dioxide", ["Oxygen", "Nitrogen", "Helium"]),
    (1, "Which organ pumps blood around the body?", "Heart", ["Liver", "Lungs", "Kidney"]),
    (1, "Which is the largest ocean?", "Pacific", ["Atlantic", "Indian", "Arctic"]),
    (2, "Which hormone is often called the 'sleep hormone'?", "Melatonin", ["Insulin", "Adrenaline", "Cortisol"]),
    (2, "What is the hardest natural substance?", "Diamond", ["Quartz", "Granite", "Steel"]),
    (2, "Who wrote 'Romeo and Juliet'?", "William Shakespeare", ["Charles Dickens", "Mark Twain", "Jane Austen"]),
    (3, "What is the binary number 101 in decimal?", "5", ["3", "6", "9"]),
    (3, "What is the chemical symbol for gold?", "Au", ["Ag", "Gd", "Go"]),
    (3, "Roughly how many hours of sleep do most adults need per night?", "7–9 hours", ["3–4 hours", "5 hours", "11–12 hours"]),
    (4, "Which data structure follows First-In-First-Out (FIFO) order?", "Queue", ["Stack", "Tree", "Graph"]),
    (4, "Which atmospheric layer contains the ozone layer?", "Stratosphere", ["Troposphere", "Mesosphere", "Exosphere"]),
    (4, "In which year did Apollo 11 land humans on the Moon?", "1969", ["1959", "1972", "1981"]),
]


def _pick(bank, i: int, r: random.Random):
    exact = [b for b in bank if b[0] == i]
    if exact:
        return r.choice(exact)
    best = min(abs(b[0] - i) for b in bank)
    return r.choice([b for b in bank if abs(b[0] - i) == best])


def generate(challenge_type: str, difficulty: str, rng: random.Random | None = None) -> dict:
    """Returns dict: prompt, answer, options, display, reveal_seconds, time_limit."""
    r = rng or random.Random()
    i = lvl(difficulty)
    options = display = None
    reveal = 0
    if challenge_type == "math":
        prompt, answer = _math(i, r)
    elif challenge_type == "pattern":
        prompt, answer = _pattern(i, r)
    elif challenge_type == "memory":
        prompt, answer, display, reveal = _memory(i, r)
    elif challenge_type == "word":
        prompt, answer = _word(i, r)
    elif challenge_type == "logic":
        _, prompt, answer = _pick(_LOGIC, i, r)
    elif challenge_type == "riddle":
        _, prompt, answer = _pick(_RIDDLES, i, r)
    elif challenge_type == "quiz":
        _, prompt, answer, wrong = _pick(_QUIZ, i, r)
        options = wrong + [answer]
        r.shuffle(options)
    else:
        raise ValueError(f"Unknown challenge type: {challenge_type}")
    return {
        "prompt": prompt, "answer": answer, "options": options, "display": display,
        "reveal_seconds": reveal, "time_limit": TIME_LIMITS[difficulty] + reveal,
    }
