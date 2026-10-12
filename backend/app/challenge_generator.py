import random

ALARM_ROLES = {
    "STANDARD": {
        "id": "STANDARD",
        "name": "Standard Wake",
        "icon": "⏰",
        "tagline": "Balanced morning alarm with standard challenges.",
        "color": "#6366f1",
        "theme": "indigo",
        "default_difficulty": "MEDIUM",
        "max_snoozes": 2,
        "quotes": [
            "Good morning! Time to wake up your mind.",
            "A new day begins. Let's solve a quick puzzle!",
            "Rise and shine — your brain is ready to fire up!",
            "Every morning is a fresh start. Begin with clarity."
        ]
    },
    "DRILL_SERGEANT": {
        "id": "DRILL_SERGEANT",
        "name": "Drill Sergeant",
        "icon": "🎖️",
        "tagline": "Aggressive, high-intensity wake-up call with strict speed challenges!",
        "color": "#ef4444",
        "theme": "red",
        "default_difficulty": "HARD",
        "max_snoozes": 0,
        "quotes": [
            "DROP AND WAKE UP SOLDIER! NO SNOOZING ON MY WATCH!",
            "FEET ON THE FLOOR NOW! SOLVE THIS RAPID FIRE QUESTION!",
            "EXCUSES DON'T CLEAR ALARMS, SPEED AND BRAINPOWER DO!",
            "ATTENTION! THIS IS NOT A DRILL — ACTUALLY IT IS. RESPOND IMMEDIATELY!"
        ]
    },
    "ZEN_GURU": {
        "id": "ZEN_GURU",
        "name": "Zen Guru",
        "icon": "🧘",
        "tagline": "Mindful, peaceful awakening with gentle math puzzles.",
        "color": "#10b981",
        "theme": "emerald",
        "default_difficulty": "EASY",
        "max_snoozes": 3,
        "quotes": [
            "Breathe in clarity, breathe out sleepiness.",
            "Welcome the dawn with quiet intention and a focused mind.",
            "Peace begins within. Solve gently to start your day.",
            "The mind is like water — calm it, and everything becomes clear."
        ]
    },
    "CORPORATE_EXEC": {
        "id": "CORPORATE_EXEC",
        "name": "Corporate Exec",
        "icon": "💼",
        "tagline": "Strategic calculations for ambitious professionals.",
        "color": "#3b82f6",
        "theme": "blue",
        "default_difficulty": "MEDIUM",
        "max_snoozes": 1,
        "quotes": [
            "Morning briefing: First agenda item is this calculation.",
            "Market opens soon. Optimize your cognitive bandwidth now.",
            "High performance requires immediate action.",
            "Leaders make decisions fast. Prove your analytical edge."
        ]
    },
    "MAD_SCIENTIST": {
        "id": "MAD_SCIENTIST",
        "name": "Mad Scientist",
        "icon": "🧪",
        "tagline": "Complex multi-step math puzzles to spark genius.",
        "color": "#8b5cf6",
        "theme": "purple",
        "default_difficulty": "HARD",
        "max_snoozes": 1,
        "quotes": [
            "EUREKA! The neural pathways are firing! Solve the formula!",
            "Warning: Overload imminent! Contain the reactor with correct logic!",
            "Fascinating specimen! Let's test your cognitive processing velocity.",
            "The experiment cannot proceed without your calculated answer!"
        ]
    },
    "FITNESS_COACH": {
        "id": "FITNESS_COACH",
        "name": "Fitness Coach",
        "icon": "🏋️",
        "tagline": "High-energy mental sprints to jumpstart your metabolism.",
        "color": "#f59e0b",
        "theme": "amber",
        "default_difficulty": "MEDIUM",
        "max_snoozes": 1,
        "quotes": [
            "LET'S GET THAT MENTAL HEART RATE UP! 100% ENERGY TODAY!",
            "NO PAIN NO GAIN! PUSH THROUGH THIS BRAIN SPRINT!",
            "CHAMPIONS WAKE UP EARLY AND FINISH STRONG!",
            "YOUR MIND IS A MUSCLE — WORK IT OUT RIGHT NOW!"
        ]
    }
}


# ──────────────────────────────────────────────────────────────
# MATH QUESTION GENERATORS BY DIFFICULTY
# All return: (question_str, answer_str)
# No options — user types the answer
# ──────────────────────────────────────────────────────────────

def _easy_question():
    """
    Easy: single-step arithmetic with small numbers.
    Operations: +, -, ×
    Range: 1–20
    """
    op = random.choice(["+", "-", "×", "×"])  # weight multiply for practice
    a = random.randint(1, 20)
    b = random.randint(1, 20)

    if op == "+":
        ans = a + b
        q = f"{a} + {b} = ?"
    elif op == "-":
        if a < b:
            a, b = b, a
        ans = a - b
        q = f"{a} − {b} = ?"
    else:  # ×
        a = random.randint(1, 12)
        b = random.randint(1, 12)
        ans = a * b
        q = f"{a} × {b} = ?"

    return q, str(ans)


def _medium_question():
    """
    Medium: two-step arithmetic or moderate single-step.
    Operations: +, -, ×, ÷, two-step combos
    Range: 10–100
    """
    kind = random.choice(["single", "single", "two_step", "division"])

    if kind == "single":
        op = random.choice(["+", "-", "×"])
        if op == "+":
            a = random.randint(20, 100)
            b = random.randint(20, 100)
            ans = a + b
            q = f"{a} + {b} = ?"
        elif op == "-":
            a = random.randint(50, 150)
            b = random.randint(10, 80)
            if a < b:
                a, b = b, a
            ans = a - b
            q = f"{a} − {b} = ?"
        else:
            a = random.randint(3, 15)
            b = random.randint(3, 15)
            ans = a * b
            q = f"{a} × {b} = ?"

    elif kind == "division":
        # Ensure clean division
        b = random.randint(2, 12)
        ans = random.randint(3, 15)
        a = b * ans
        q = f"{a} ÷ {b} = ?"

    else:  # two_step
        op = random.choice(["add_mul", "sub_add", "mul_add"])
        if op == "add_mul":
            a = random.randint(2, 10)
            b = random.randint(2, 10)
            c = random.randint(2, 8)
            ans = (a + b) * c
            q = f"({a} + {b}) × {c} = ?"
        elif op == "sub_add":
            a = random.randint(20, 60)
            b = random.randint(5, 20)
            c = random.randint(5, 20)
            ans = a - b + c
            q = f"{a} − {b} + {c} = ?"
        else:
            a = random.randint(2, 12)
            b = random.randint(2, 8)
            c = random.randint(5, 30)
            ans = a * b + c
            q = f"({a} × {b}) + {c} = ?"

    return q, str(ans)


def _hard_question():
    """
    Hard: multi-step expressions, large numbers, mixed operations.
    Range: 10–500
    """
    kind = random.choice(["three_step", "large_mul", "large_div", "power_of", "mixed"])

    if kind == "three_step":
        a = random.randint(5, 20)
        b = random.randint(3, 10)
        c = random.randint(2, 8)
        d = random.randint(5, 25)
        ans = (a + b) * c - d
        q = f"({a} + {b}) × {c} − {d} = ?"

    elif kind == "large_mul":
        a = random.randint(15, 50)
        b = random.randint(10, 30)
        ans = a * b
        q = f"{a} × {b} = ?"

    elif kind == "large_div":
        b = random.randint(5, 20)
        ans = random.randint(10, 30)
        a = b * ans
        q = f"{a} ÷ {b} = ?"

    elif kind == "power_of":
        base = random.choice([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
        exp = 2
        ans = base ** exp
        q = f"{base}² = ?"

    else:  # mixed
        a = random.randint(10, 40)
        b = random.randint(2, 10)
        c = random.randint(10, 50)
        d = random.randint(2, 8)
        ans = a * b - c + d
        q = f"({a} × {b}) − {c} + {d} = ?"

    return q, str(ans)


# ──────────────────────────────────────────────────────────────
# PARAMETRIC QUESTION GENERATOR (Difficulty Engine)
# Generates a question from continuous-score parameters instead
# of fixed EASY/MEDIUM/HARD buckets.
# ──────────────────────────────────────────────────────────────

def _parametric_question(params):
    """
    Generate a math question using engine-produced parameters.

    params dict keys:
        num_low, num_high   – operand range for +/−
        mul_low, mul_high   – operand range for ×/÷
        steps               – number of operations (1–4)
        allow_negative      – bool, allow negative intermediate/final results
        div_weight          – probability weight for ÷
        power_weight        – probability weight for exponents
    """
    steps = params.get("steps", 2)
    num_lo = params.get("num_low", 1)
    num_hi = params.get("num_high", 50)
    mul_lo = params.get("mul_low", 2)
    mul_hi = params.get("mul_high", 12)
    allow_neg = params.get("allow_negative", False)
    div_w = params.get("div_weight", 0.0)
    pow_w = params.get("power_weight", 0.0)

    # Build weighted operation pool
    ops = ["+", "−", "×"]
    weights = [1.0, 1.0, 1.0]
    if div_w > 0:
        ops.append("÷")
        weights.append(div_w * 3)  # scale relative to base weight of 1.0
    if pow_w > 0:
        ops.append("²")
        weights.append(pow_w * 3)

    # Single-step special cases for very low difficulty
    if steps == 1:
        op = random.choices(ops, weights=weights, k=1)[0]
        return _single_op(op, num_lo, num_hi, mul_lo, mul_hi, allow_neg)

    # Multi-step: build expression left-to-right
    # Start with first operand
    result = random.randint(num_lo, num_hi)
    expr_parts = [str(result)]

    for _ in range(steps):
        op = random.choices(ops, weights=weights, k=1)[0]

        if op == "+":
            b = random.randint(num_lo, num_hi)
            result = result + b
            expr_parts.append(f"+ {b}")

        elif op == "−":
            b = random.randint(num_lo, min(num_hi, result if not allow_neg else num_hi))
            if not allow_neg and b > result:
                # Swap to addition to avoid negative
                result = result + b
                expr_parts.append(f"+ {b}")
            else:
                result = result - b
                expr_parts.append(f"− {b}")

        elif op == "×":
            b = random.randint(mul_lo, mul_hi)
            # For multi-step, wrap prior expression in parens
            if len(expr_parts) > 1:
                expr_parts = [f"({' '.join(expr_parts)})"]
            result = result * b
            expr_parts.append(f"× {b}")

        elif op == "÷":
            # Pick a divisor that cleanly divides the current result
            if result == 0:
                # Can't divide zero meaningfully, switch to addition
                b = random.randint(num_lo, num_hi)
                result = result + b
                expr_parts.append(f"+ {b}")
            else:
                divisors = [d for d in range(2, min(abs(result) + 1, mul_hi + 1)) if result % d == 0]
                if divisors:
                    b = random.choice(divisors)
                    if len(expr_parts) > 1:
                        expr_parts = [f"({' '.join(expr_parts)})"]
                    result = result // b
                    expr_parts.append(f"÷ {b}")
                else:
                    # No clean divisors — fall back to addition
                    b = random.randint(num_lo, num_hi)
                    result = result + b
                    expr_parts.append(f"+ {b}")

        elif op == "²":
            # Square a small number (avoid astronomical results)
            base = random.randint(2, min(12, num_hi))
            sq = base ** 2
            # Replace entire expression with: (prev_expr) + base²
            if len(expr_parts) > 1:
                expr_parts = [f"({' '.join(expr_parts)})"]
            result = result + sq
            expr_parts.append(f"+ {base}²")

    q = " ".join(expr_parts) + " = ?"
    return q, str(result)


def _single_op(op, num_lo, num_hi, mul_lo, mul_hi, allow_neg):
    """Generate a single-operation question."""
    if op == "+":
        a = random.randint(num_lo, num_hi)
        b = random.randint(num_lo, num_hi)
        return f"{a} + {b} = ?", str(a + b)

    elif op == "−":
        a = random.randint(num_lo, num_hi)
        b = random.randint(num_lo, num_hi)
        if not allow_neg and a < b:
            a, b = b, a
        return f"{a} − {b} = ?", str(a - b)

    elif op == "×":
        a = random.randint(mul_lo, mul_hi)
        b = random.randint(mul_lo, mul_hi)
        return f"{a} × {b} = ?", str(a * b)

    elif op == "÷":
        b = random.randint(max(2, mul_lo), mul_hi)
        ans = random.randint(num_lo, num_hi)
        a = b * ans
        return f"{a} ÷ {b} = ?", str(ans)

    elif op == "²":
        base = random.choice([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
        return f"{base}² = ?", str(base ** 2)

    # Fallback
    a = random.randint(num_lo, num_hi)
    b = random.randint(num_lo, num_hi)
    return f"{a} + {b} = ?", str(a + b)


# ──────────────────────────────────────────────────────────────
# WORD SCRAMBLE PUZZLES
# ──────────────────────────────────────────────────────────────

_WORD_BANK = {
    "EASY": [
        "apple", "bread", "chair", "dance", "eagle", "flame", "grape", "heart",
        "juice", "knife", "lemon", "music", "night", "ocean", "plant", "queen",
        "river", "smile", "tiger", "union", "voice", "water", "youth", "blank",
        "cloud", "dream", "earth", "frost", "green", "house", "light", "money",
        "north", "peace", "quick", "round", "stone", "tower", "under", "world",
        "beach", "candy", "dairy", "elite", "focus", "giant", "happy", "ivory",
        "jolly", "kitty", "lucky", "maple", "noble", "olive", "piano", "radar",
        "solar", "train", "ultra", "vital",
    ],
    "MEDIUM": [
        "balance", "capture", "dynamic", "elegant", "fantasy", "gateway",
        "harmony", "impulse", "journey", "kitchen", "library", "mystery",
        "network", "organic", "pioneer", "quality", "respect", "science",
        "therapy", "upgrade", "venture", "whisper", "academy", "blanket",
        "climate", "diamond", "element", "fiction", "gallery", "habitat",
        "integer", "journal", "keynote", "lattice", "mineral", "neutral",
        "october", "polygon", "quantum", "refugee", "sunrise", "trillion",
        "uniform", "voltage", "warrior", "chapter", "default", "express",
        "formula", "gravity", "harvest", "insight", "kingdom", "leather",
        "machine", "nucleus", "outlook", "pattern", "recruit", "stadium",
    ],
    "HARD": [
        "absolute", "boundary", "calendar", "database", "envelope", "function",
        "generate", "hospital", "informat", "judgment", "kilowatt", "language",
        "magnetic", "national", "obstacle", "paradigm", "quadrant", "reaction",
        "spectrum", "triangle", "umbrella", "velocity", "wireless", "yourself",
        "analysis", "birthday", "compound", "diagonal", "equation", "frontier",
        "guardian", "heritage", "imperial", "judicial", "keyboard", "landmark",
        "molecule", "nitrogen", "optimize", "platform", "question", "register",
        "sandwich", "thousand", "universe", "variable", "workshop", "cylinder",
        "dialogue", "electron", "fragment", "governor", "handbook", "identity",
        "jeopardy", "kangaroo", "labrador", "manifest", "nineteen", "operator",
    ],
}


def _scramble_word(word):
    """Scramble a word ensuring it differs from the original."""
    chars = list(word.upper())
    for _ in range(50):
        random.shuffle(chars)
        scrambled = "".join(chars)
        if scrambled != word.upper():
            return scrambled
    return "".join(chars)


def _word_scramble_question(difficulty="MEDIUM"):
    """Generate a word scramble puzzle."""
    difficulty = difficulty.upper()
    if difficulty not in _WORD_BANK:
        difficulty = "MEDIUM"

    word = random.choice(_WORD_BANK[difficulty])
    scrambled = _scramble_word(word)

    # Hint: first and last letter
    hint = f"Starts with '{word[0].upper()}' and ends with '{word[-1].upper()}'"

    return {
        "type": "WORD_SCRAMBLE",
        "difficulty": difficulty,
        "question": f"Unscramble this word: {scrambled}",
        "correct_answer": word.upper(),
        "options": [],
        "time_limit": TIME_LIMITS.get(difficulty, 25),
        "hint": hint,
        "scrambled_word": scrambled,
        "original_word": word.upper(),
    }


# ──────────────────────────────────────────────────────────────
# SEQUENCE / PATTERN PUZZLES
# ──────────────────────────────────────────────────────────────

def _sequence_question(difficulty="MEDIUM"):
    """Generate a number sequence pattern puzzle."""
    difficulty = difficulty.upper()
    if difficulty not in ("EASY", "MEDIUM", "HARD"):
        difficulty = "MEDIUM"

    if difficulty == "EASY":
        kind = random.choice(["add", "add", "multiply_simple"])
        if kind == "add":
            start = random.randint(1, 20)
            step = random.randint(1, 10)
            seq = [start + step * i for i in range(5)]
            answer = seq[-1]
            display = seq[:-1]
            pattern_hint = f"Adding {step} each time"
        else:
            base = random.randint(2, 5)
            seq = [base * i for i in range(1, 6)]
            answer = seq[-1]
            display = seq[:-1]
            pattern_hint = f"Multiples of {base}"

    elif difficulty == "MEDIUM":
        kind = random.choice(["add", "multiply", "square", "fibonacci_like", "alternating"])
        if kind == "add":
            start = random.randint(5, 50)
            step = random.randint(3, 15)
            seq = [start + step * i for i in range(6)]
            answer = seq[-1]
            display = seq[:-1]
            pattern_hint = f"Common difference"
        elif kind == "multiply":
            start = random.randint(2, 5)
            factor = random.randint(2, 3)
            seq = [start * (factor ** i) for i in range(6)]
            answer = seq[-1]
            display = seq[:-1]
            pattern_hint = "Geometric sequence"
        elif kind == "square":
            start = random.randint(1, 6)
            seq = [(start + i) ** 2 for i in range(6)]
            answer = seq[-1]
            display = seq[:-1]
            pattern_hint = "Perfect squares"
        elif kind == "fibonacci_like":
            a, b = random.randint(1, 5), random.randint(1, 5)
            seq = [a, b]
            for _ in range(4):
                seq.append(seq[-1] + seq[-2])
            answer = seq[-1]
            display = seq[:-1]
            pattern_hint = "Sum of previous two"
        else:
            a = random.randint(1, 10)
            step1 = random.randint(2, 5)
            step2 = random.randint(6, 10)
            seq = []
            val = a
            for i in range(6):
                seq.append(val)
                val += step1 if i % 2 == 0 else step2
            answer = seq[-1]
            display = seq[:-1]
            pattern_hint = "Alternating steps"

    else:  # HARD
        kind = random.choice(["cubic", "prime_add", "triangular", "double_op", "power"])
        if kind == "cubic":
            start = random.randint(1, 4)
            seq = [(start + i) ** 3 for i in range(6)]
            answer = seq[-1]
            display = seq[:-1]
            pattern_hint = "Perfect cubes"
        elif kind == "prime_add":
            primes = [2, 3, 5, 7, 11, 13]
            start = random.randint(10, 30)
            seq = [start]
            for p in primes[:5]:
                seq.append(seq[-1] + p)
            answer = seq[-1]
            display = seq[:-1]
            pattern_hint = "Adding primes"
        elif kind == "triangular":
            seq = [n * (n + 1) // 2 for n in range(1, 8)]
            answer = seq[-1]
            display = seq[:-1]
            pattern_hint = "Triangular numbers"
        elif kind == "double_op":
            start = random.randint(2, 8)
            seq = [start]
            for i in range(5):
                if i % 2 == 0:
                    seq.append(seq[-1] * 2)
                else:
                    seq.append(seq[-1] + 3)
            answer = seq[-1]
            display = seq[:-1]
            pattern_hint = "Alternating ×2 and +3"
        else:
            base = random.randint(2, 3)
            seq = [base ** i for i in range(1, 7)]
            answer = seq[-1]
            display = seq[:-1]
            pattern_hint = f"Powers of {base}"

    display_str = ", ".join(str(x) for x in display)

    return {
        "type": "SEQUENCE",
        "difficulty": difficulty,
        "question": f"What comes next? {display_str}, ?",
        "correct_answer": str(answer),
        "options": [],
        "time_limit": TIME_LIMITS.get(difficulty, 25),
        "sequence": display,
        "pattern_hint": pattern_hint,
    }


# ──────────────────────────────────────────────────────────────
# MEMORY RECALL PUZZLES
# ──────────────────────────────────────────────────────────────

def _memory_question(difficulty="MEDIUM"):
    """Generate a memory recall puzzle — show a sequence, ask to type it back."""
    difficulty = difficulty.upper()
    if difficulty not in ("EASY", "MEDIUM", "HARD"):
        difficulty = "MEDIUM"

    length_map = {"EASY": 4, "MEDIUM": 6, "HARD": 8}
    display_time_map = {"EASY": 5, "MEDIUM": 4, "HARD": 3}

    length = length_map[difficulty]
    display_time = display_time_map[difficulty]

    kind = random.choice(["digits", "digits", "letters"])
    if kind == "digits":
        seq = [str(random.randint(0, 9)) for _ in range(length)]
    else:
        consonants = "BCDFGHJKLMNPQRSTVWXYZ"
        seq = [random.choice(consonants) for _ in range(length)]

    sequence_str = " ".join(seq)
    answer = "".join(seq)

    return {
        "type": "MEMORY",
        "difficulty": difficulty,
        "question": "Memorize this sequence, then type it from memory!",
        "correct_answer": answer,
        "options": [],
        "time_limit": TIME_LIMITS.get(difficulty, 25) + display_time,
        "memory_sequence": sequence_str,
        "memory_items": seq,
        "display_time": display_time,
    }


# ──────────────────────────────────────────────────────────────
# TRIVIA PUZZLES (MCQ)
# ──────────────────────────────────────────────────────────────

_TRIVIA_BANK = {
    "EASY": [
        {"q": "What planet is closest to the Sun?", "a": "Mercury", "opts": ["Venus", "Mercury", "Mars", "Earth"], "cat": "Science"},
        {"q": "How many continents are there?", "a": "7", "opts": ["5", "6", "7", "8"], "cat": "Geography"},
        {"q": "What is the largest ocean on Earth?", "a": "Pacific", "opts": ["Atlantic", "Indian", "Pacific", "Arctic"], "cat": "Geography"},
        {"q": "What gas do plants absorb from the atmosphere?", "a": "Carbon Dioxide", "opts": ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"], "cat": "Science"},
        {"q": "How many days are in a leap year?", "a": "366", "opts": ["364", "365", "366", "367"], "cat": "General"},
        {"q": "What is the boiling point of water in °C?", "a": "100", "opts": ["90", "100", "110", "212"], "cat": "Science"},
        {"q": "Which animal is known as the King of the Jungle?", "a": "Lion", "opts": ["Tiger", "Lion", "Elephant", "Bear"], "cat": "Nature"},
        {"q": "What color do you get mixing red and blue?", "a": "Purple", "opts": ["Green", "Orange", "Purple", "Brown"], "cat": "General"},
        {"q": "How many sides does a hexagon have?", "a": "6", "opts": ["5", "6", "7", "8"], "cat": "Math"},
        {"q": "What is the chemical symbol for water?", "a": "H2O", "opts": ["CO2", "H2O", "O2", "NaCl"], "cat": "Science"},
        {"q": "Which planet is known as the Red Planet?", "a": "Mars", "opts": ["Venus", "Jupiter", "Mars", "Saturn"], "cat": "Science"},
        {"q": "What is the capital of France?", "a": "Paris", "opts": ["London", "Paris", "Berlin", "Madrid"], "cat": "Geography"},
        {"q": "How many hours are in a day?", "a": "24", "opts": ["12", "20", "24", "48"], "cat": "General"},
        {"q": "What is the largest mammal?", "a": "Blue Whale", "opts": ["Elephant", "Blue Whale", "Giraffe", "Hippo"], "cat": "Nature"},
        {"q": "Which season comes after summer?", "a": "Autumn", "opts": ["Winter", "Spring", "Autumn", "Monsoon"], "cat": "General"},
        {"q": "What shape has three sides?", "a": "Triangle", "opts": ["Square", "Triangle", "Circle", "Pentagon"], "cat": "Math"},
        {"q": "Which fruit is known for keeping doctors away?", "a": "Apple", "opts": ["Banana", "Orange", "Apple", "Grape"], "cat": "General"},
        {"q": "What is the smallest prime number?", "a": "2", "opts": ["0", "1", "2", "3"], "cat": "Math"},
        {"q": "What does the 'S' in NASA stand for?", "a": "Space", "opts": ["Science", "Space", "System", "Solar"], "cat": "General"},
        {"q": "How many legs does a spider have?", "a": "8", "opts": ["6", "8", "10", "12"], "cat": "Nature"},
    ],
    "MEDIUM": [
        {"q": "What year did the Titanic sink?", "a": "1912", "opts": ["1905", "1912", "1920", "1898"], "cat": "History"},
        {"q": "Which element has the atomic number 79?", "a": "Gold", "opts": ["Silver", "Gold", "Platinum", "Copper"], "cat": "Science"},
        {"q": "What is the powerhouse of the cell?", "a": "Mitochondria", "opts": ["Nucleus", "Ribosome", "Mitochondria", "Golgi Body"], "cat": "Biology"},
        {"q": "Which country has the longest coastline?", "a": "Canada", "opts": ["Australia", "Russia", "Canada", "Indonesia"], "cat": "Geography"},
        {"q": "What is the speed of light in km/s (approx)?", "a": "300,000", "opts": ["150,000", "300,000", "500,000", "1,000,000"], "cat": "Science"},
        {"q": "Who painted the Mona Lisa?", "a": "Leonardo da Vinci", "opts": ["Michelangelo", "Leonardo da Vinci", "Raphael", "Picasso"], "cat": "Art"},
        {"q": "What is the largest desert in the world?", "a": "Antarctic", "opts": ["Sahara", "Arabian", "Gobi", "Antarctic"], "cat": "Geography"},
        {"q": "How many bones does an adult human body have?", "a": "206", "opts": ["186", "206", "226", "256"], "cat": "Biology"},
        {"q": "What is the currency of Japan?", "a": "Yen", "opts": ["Yuan", "Won", "Yen", "Ringgit"], "cat": "General"},
        {"q": "What planet has the most moons?", "a": "Saturn", "opts": ["Jupiter", "Saturn", "Neptune", "Uranus"], "cat": "Science"},
        {"q": "What is the hardest natural substance on Earth?", "a": "Diamond", "opts": ["Quartz", "Diamond", "Topaz", "Ruby"], "cat": "Science"},
        {"q": "In which year did World War II end?", "a": "1945", "opts": ["1942", "1944", "1945", "1948"], "cat": "History"},
        {"q": "What is the main language spoken in Brazil?", "a": "Portuguese", "opts": ["Spanish", "Portuguese", "French", "English"], "cat": "Geography"},
        {"q": "What is the square root of 144?", "a": "12", "opts": ["10", "11", "12", "14"], "cat": "Math"},
        {"q": "Which organ filters blood in the human body?", "a": "Kidney", "opts": ["Liver", "Kidney", "Heart", "Lung"], "cat": "Biology"},
        {"q": "What is the chemical symbol for Iron?", "a": "Fe", "opts": ["Ir", "Fe", "In", "Fr"], "cat": "Science"},
        {"q": "How many strings does a standard guitar have?", "a": "6", "opts": ["4", "5", "6", "8"], "cat": "Music"},
        {"q": "What is the tallest mountain in the world?", "a": "Mount Everest", "opts": ["K2", "Mount Everest", "Kangchenjunga", "Lhotse"], "cat": "Geography"},
        {"q": "Which blood type is a universal donor?", "a": "O negative", "opts": ["A positive", "B negative", "O negative", "AB positive"], "cat": "Biology"},
        {"q": "What does CPU stand for?", "a": "Central Processing Unit", "opts": ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Core Processing Unit"], "cat": "Tech"},
    ],
    "HARD": [
        {"q": "What is the half-life of Carbon-14 (approx years)?", "a": "5,730", "opts": ["3,200", "5,730", "8,400", "12,000"], "cat": "Science"},
        {"q": "Which physicist proposed the uncertainty principle?", "a": "Heisenberg", "opts": ["Bohr", "Heisenberg", "Planck", "Schrodinger"], "cat": "Science"},
        {"q": "What is the Fibonacci number at position 10?", "a": "55", "opts": ["34", "55", "89", "144"], "cat": "Math"},
        {"q": "In which year was the first email sent?", "a": "1971", "opts": ["1965", "1971", "1978", "1983"], "cat": "Tech"},
        {"q": "What is the deepest point in the ocean?", "a": "Mariana Trench", "opts": ["Puerto Rico Trench", "Java Trench", "Mariana Trench", "Tonga Trench"], "cat": "Geography"},
        {"q": "Which programming language was created first?", "a": "Fortran", "opts": ["C", "Fortran", "BASIC", "COBOL"], "cat": "Tech"},
        {"q": "What is the value of Euler's number (e) to 2 decimal places?", "a": "2.72", "opts": ["2.72", "3.14", "1.62", "2.58"], "cat": "Math"},
        {"q": "Which artist cut off part of his own ear?", "a": "Van Gogh", "opts": ["Monet", "Picasso", "Van Gogh", "Rembrandt"], "cat": "Art"},
        {"q": "What is the lightest element in the periodic table?", "a": "Hydrogen", "opts": ["Helium", "Hydrogen", "Lithium", "Carbon"], "cat": "Science"},
        {"q": "What does 'HTTP' stand for?", "a": "HyperText Transfer Protocol", "opts": ["HyperText Transfer Protocol", "High Tech Transfer Protocol", "HyperText Transmission Process", "Hyper Transfer Text Protocol"], "cat": "Tech"},
        {"q": "How many symphonies did Beethoven compose?", "a": "9", "opts": ["5", "7", "9", "12"], "cat": "Music"},
        {"q": "What is the largest organ in the human body?", "a": "Skin", "opts": ["Liver", "Skin", "Brain", "Intestine"], "cat": "Biology"},
        {"q": "What is the value of pi to 4 decimal places?", "a": "3.1416", "opts": ["3.1416", "3.1459", "3.1462", "3.1392"], "cat": "Math"},
        {"q": "Which country invented paper?", "a": "China", "opts": ["Egypt", "India", "China", "Greece"], "cat": "History"},
        {"q": "What is the chemical formula for table salt?", "a": "NaCl", "opts": ["KCl", "NaCl", "CaCl2", "NaOH"], "cat": "Science"},
        {"q": "What year was the first iPhone released?", "a": "2007", "opts": ["2005", "2006", "2007", "2008"], "cat": "Tech"},
        {"q": "How many teeth does an adult human have?", "a": "32", "opts": ["28", "30", "32", "36"], "cat": "Biology"},
        {"q": "What is the most abundant gas in Earth's atmosphere?", "a": "Nitrogen", "opts": ["Oxygen", "Nitrogen", "Carbon Dioxide", "Argon"], "cat": "Science"},
        {"q": "Which planet rotates on its side?", "a": "Uranus", "opts": ["Neptune", "Uranus", "Saturn", "Pluto"], "cat": "Science"},
        {"q": "What is the binary representation of the number 42?", "a": "101010", "opts": ["101010", "110010", "100110", "101100"], "cat": "Tech"},
    ],
}


def _trivia_question(difficulty="MEDIUM"):
    """Generate a trivia MCQ puzzle."""
    difficulty = difficulty.upper()
    if difficulty not in _TRIVIA_BANK:
        difficulty = "MEDIUM"

    item = random.choice(_TRIVIA_BANK[difficulty])
    # Shuffle options so correct answer isn't always in same position
    opts = list(item["opts"])
    random.shuffle(opts)

    return {
        "type": "TRIVIA",
        "difficulty": difficulty,
        "question": item["q"],
        "correct_answer": item["a"],
        "options": opts,
        "time_limit": TIME_LIMITS.get(difficulty, 25),
        "category": item["cat"],
    }


# ──────────────────────────────────────────────────────────────
# COLOR MATCH (STROOP TEST) PUZZLES
# ──────────────────────────────────────────────────────────────

_COLORS = [
    {"name": "Red",    "hex": "#ef4444"},
    {"name": "Blue",   "hex": "#3b82f6"},
    {"name": "Green",  "hex": "#22c55e"},
    {"name": "Yellow", "hex": "#eab308"},
    {"name": "Purple", "hex": "#a855f7"},
    {"name": "Orange", "hex": "#f97316"},
    {"name": "Pink",   "hex": "#ec4899"},
    {"name": "Cyan",   "hex": "#06b6d4"},
]


def _color_match_question(difficulty="MEDIUM"):
    """Generate a Stroop-effect color match puzzle."""
    difficulty = difficulty.upper()
    if difficulty not in ("EASY", "MEDIUM", "HARD"):
        difficulty = "MEDIUM"

    # Pick the display color (the ACTUAL color shown) — this is the answer
    actual_color = random.choice(_COLORS)

    if difficulty == "EASY":
        # Word matches color sometimes, pick 3 options
        word_color = random.choice(_COLORS)
        others = [c for c in _COLORS if c["name"] != actual_color["name"]]
        random.shuffle(others)
        opts = [actual_color["name"]] + [c["name"] for c in others[:2]]
        random.shuffle(opts)
    elif difficulty == "MEDIUM":
        # Word NEVER matches color (classic Stroop), 4 options
        candidates = [c for c in _COLORS if c["name"] != actual_color["name"]]
        word_color = random.choice(candidates)
        others = [c for c in _COLORS if c["name"] != actual_color["name"]]
        random.shuffle(others)
        opts = [actual_color["name"]] + [c["name"] for c in others[:3]]
        random.shuffle(opts)
    else:
        # Word NEVER matches, 6 options (harder to pick from)
        candidates = [c for c in _COLORS if c["name"] != actual_color["name"]]
        word_color = random.choice(candidates)
        others = [c for c in _COLORS if c["name"] != actual_color["name"]]
        random.shuffle(others)
        opts = [actual_color["name"]] + [c["name"] for c in others[:5]]
        random.shuffle(opts)

    return {
        "type": "COLOR_MATCH",
        "difficulty": difficulty,
        "question": f"What COLOR is this text displayed in? (Ignore the word itself)",
        "correct_answer": actual_color["name"],
        "options": opts,
        "time_limit": TIME_LIMITS.get(difficulty, 25),
        "display_word": word_color["name"],
        "display_color": actual_color["hex"],
        "display_color_name": actual_color["name"],
    }


# ──────────────────────────────────────────────────────────────
# CHALLENGE TYPES METADATA (for frontend)
# ───────────────────────────────────────────────────────────

CHALLENGE_TYPES = {
    "MATH": {
        "id": "MATH",
        "name": "Math",
        "icon": "🧮",
        "description": "Arithmetic and algebra puzzles",
        "answer_format": "typed",
    },
    "WORD_SCRAMBLE": {
        "id": "WORD_SCRAMBLE",
        "name": "Word Scramble",
        "icon": "🔤",
        "description": "Unscramble jumbled letters into a word",
        "answer_format": "typed",
    },
    "SEQUENCE": {
        "id": "SEQUENCE",
        "name": "Sequence",
        "icon": "🔢",
        "description": "Find the next number in the pattern",
        "answer_format": "typed",
    },
    "MEMORY": {
        "id": "MEMORY",
        "name": "Memory",
        "icon": "🧠",
        "description": "Memorize and recall a flashed sequence",
        "answer_format": "typed",
    },
    "TRIVIA": {
        "id": "TRIVIA",
        "name": "Trivia",
        "icon": "💡",
        "description": "General knowledge multiple choice",
        "answer_format": "mcq",
    },
    "COLOR_MATCH": {
        "id": "COLOR_MATCH",
        "name": "Color Match",
        "icon": "🎨",
        "description": "Name the color, not the word (Stroop test)",
        "answer_format": "mcq",
    },
    "RANDOM": {
        "id": "RANDOM",
        "name": "Random",
        "icon": "🎲",
        "description": "A different puzzle type each time",
        "answer_format": "mixed",
    },
}

_ACTUAL_TYPES = ["MATH", "WORD_SCRAMBLE", "SEQUENCE", "MEMORY", "TRIVIA", "COLOR_MATCH"]


# ──────────────────────────────────────────────────────────────
# TIME LIMITS BY DIFFICULTY
# ──────────────────────────────────────────────────────────────
TIME_LIMITS = {
    "EASY": 30,
    "MEDIUM": 25,
    "HARD": 20,
}


# ──────────────────────────────────────────────────────────────
# INTERNAL DISPATCH
# ──────────────────────────────────────────────────────────────

def _generate_by_kind(kind, difficulty):
    """
    Dispatch to the correct generator by puzzle kind.
    Returns a challenge dict.
    """
    kind = kind.upper()
    if kind == "RANDOM":
        kind = random.choice(_ACTUAL_TYPES)
    if kind not in _ACTUAL_TYPES:
        kind = "MATH"

    difficulty = difficulty.upper()
    if difficulty not in ("EASY", "MEDIUM", "HARD"):
        difficulty = "MEDIUM"

    if kind == "MATH":
        if difficulty == "EASY":
            q, ans = _easy_question()
        elif difficulty == "HARD":
            q, ans = _hard_question()
        else:
            q, ans = _medium_question()
        return {
            "type": "MATH",
            "difficulty": difficulty,
            "question": q,
            "options": [],
            "correct_answer": ans,
            "time_limit": TIME_LIMITS[difficulty],
        }
    elif kind == "WORD_SCRAMBLE":
        return _word_scramble_question(difficulty)
    elif kind == "SEQUENCE":
        return _sequence_question(difficulty)
    elif kind == "MEMORY":
        return _memory_question(difficulty)
    elif kind == "TRIVIA":
        return _trivia_question(difficulty)
    elif kind == "COLOR_MATCH":
        return _color_match_question(difficulty)

    # Fallback
    q, ans = _medium_question()
    return {
        "type": "MATH", "difficulty": "MEDIUM",
        "question": q, "options": [], "correct_answer": ans,
        "time_limit": TIME_LIMITS["MEDIUM"],
    }


# ──────────────────────────────────────────────────────────────
# MAIN GENERATE ENTRY POINTS
# ──────────────────────────────────────────────────────────────

def generate_challenge(kind="MATH", difficulty="MEDIUM", difficulty_score=None):
    """
    Generic challenge generator.

    If difficulty_score (float 0.0-1.0) is provided AND kind is MATH,
    uses the parametric generator for smooth difficulty scaling.
    Otherwise dispatches to the appropriate puzzle generator.
    """
    kind = (kind or "MATH").upper()
    difficulty = (difficulty or "MEDIUM").upper()

    # Parametric math path (difficulty engine) — only for MATH
    if difficulty_score is not None and kind in ("MATH", "RANDOM"):
        # If RANDOM, still possible to get non-math, but parametric only for math
        if kind == "RANDOM":
            actual_kind = random.choice(_ACTUAL_TYPES)
            if actual_kind != "MATH":
                return _generate_by_kind(actual_kind, difficulty)
        from .difficulty_engine import generate_params, score_to_label
        params = generate_params(difficulty_score)
        q, ans = _parametric_question(params)
        label = score_to_label(difficulty_score)
        return {
            "type": "MATH",
            "difficulty": label,
            "difficulty_score": round(difficulty_score, 4),
            "question": q,
            "options": [],
            "correct_answer": ans,
            "time_limit": params["time_limit"],
        }

    return _generate_by_kind(kind, difficulty)


def generate_role_challenge(alarm_role="STANDARD", difficulty="MEDIUM", difficulty_score=None, kind="MATH"):
    """
    Role-themed challenge. Supports all puzzle types.

    If difficulty_score is provided AND kind is MATH, uses parametric generation.
    Otherwise dispatches by kind with role metadata overlay.
    """
    role = (alarm_role or "STANDARD").upper()
    if role not in ALARM_ROLES:
        role = "STANDARD"

    meta = ALARM_ROLES[role]
    quote = random.choice(meta["quotes"])

    kind = (kind or "MATH").upper()
    difficulty = (difficulty or "MEDIUM").upper()

    # Parametric math path (difficulty engine)
    if difficulty_score is not None and kind in ("MATH", "RANDOM"):
        if kind == "RANDOM":
            actual_kind = random.choice(_ACTUAL_TYPES)
            if actual_kind != "MATH":
                c = _generate_by_kind(actual_kind, difficulty)
                c.update({
                    "alarm_role": role,
                    "role_name": meta["name"],
                    "role_icon": meta["icon"],
                    "quote": quote,
                })
                return c
        from .difficulty_engine import generate_params, score_to_label
        params = generate_params(difficulty_score)
        q, ans = _parametric_question(params)
        label = score_to_label(difficulty_score)
        return {
            "type": "MATH",
            "difficulty": label,
            "difficulty_score": round(difficulty_score, 4),
            "question": q,
            "options": [],
            "correct_answer": ans,
            "time_limit": params["time_limit"],
            "alarm_role": role,
            "role_name": meta["name"],
            "role_icon": meta["icon"],
            "quote": quote,
        }

    # Classic tier — apply role difficulty overrides
    if difficulty not in ("EASY", "MEDIUM", "HARD"):
        difficulty = "MEDIUM"

    role_difficulty_map = {
        "DRILL_SERGEANT": "HARD",
        "ZEN_GURU":       "EASY",
        "CORPORATE_EXEC": "MEDIUM",
        "MAD_SCIENTIST":  "HARD",
        "FITNESS_COACH":  "MEDIUM",
        "STANDARD":       difficulty,
    }
    effective_difficulty = role_difficulty_map.get(role, difficulty)
    if difficulty != "MEDIUM":
        effective_difficulty = difficulty

    c = _generate_by_kind(kind, effective_difficulty)
    c.update({
        "alarm_role": role,
        "role_name": meta["name"],
        "role_icon": meta["icon"],
        "quote": quote,
    })
    return c

