"""Challenge service for adaptive difficulty and server-authoritative puzzle generation.

Design (Milestone 2 / Phase 4):
- Each challenge type generates a deterministic question set from one source of
  truth: the prompt AND the answer derive from the same generated data, so the
  client never sees the answer.
- `GET /challenges/next` creates a pending `ChallengeAttempt` holding the puzzle
  snapshot (`puzzle_payload`) and the server-side expected answers (`expected_answers`)
  plus server-only `answer_meta` (answer type + explanation).
- `POST /challenges/submit` performs the authoritative comparison exactly once:
  a pending attempt may be submitted a single time, must not be expired, and can
  only be redeemed once to dismiss an alarm. All of these are enforced server-side.

Security invariants (Phase 4):
- `payload_for()` never exposes `expected_answers`, `answer_meta`, or explanations
  that reveal the answer. Explanations are only returned for questions the user
  already answered correctly.
- Client-side sync can never mark a server-authoritative attempt as completed.
"""

import random
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..Models import Challenge, ChallengeAttempt


# ------------------------------------------------------------------
# Typed errors (mapped to HTTP status codes by the API layer)
# ------------------------------------------------------------------

class ChallengeError(Exception):
    """Base error for server-authoritative challenge failures."""

    status_code = 400

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class MalformedSubmission(ChallengeError):
    """The submitted answer payload is structurally invalid."""

    status_code = 400


class AttemptNotFound(ChallengeError):
    """The attempt does not exist or does not belong to the caller."""

    status_code = 404


class AttemptReplay(ChallengeError):
    """The attempt was already submitted (or already redeemed)."""

    status_code = 409


class AttemptExpired(ChallengeError):
    """The attempt's time budget elapsed before submission."""

    status_code = 410


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_aware(value: Optional[datetime]) -> Optional[datetime]:
    """SQLite returns naive datetimes; treat them as UTC."""
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class ChallengeService:
    """Service for adaptive challenge generation and answer verification."""

    CHALLENGE_TYPES = ["Math", "Logic", "Memory", "Word", "Pattern", "Riddle", "QuickQuiz"]
    DIFFICULTIES = ["Beginner", "Easy", "Medium", "Hard", "Expert"]

    # Static, client-facing instructions. No answers are embedded here.
    INSTRUCTIONS = {
        "Math": "Solve the arithmetic and type the number only.",
        "Logic": "Find the rule in the sequence and type the next value.",
        "Memory": "Memorize the sequence, then type the digits in the same order.",
        "Word": "Unscramble the letters and type the whole word.",
        "Pattern": "Study the repeating pattern and choose the next shape.",
        "Riddle": "Read the riddle and type a single word answer.",
        "QuickQuiz": "Choose the one correct option.",
    }

    # Default answer comparison mode per type.
    ANSWER_TYPES = {
        "Math": "numeric",
        "Logic": "numeric",
        "Memory": "sequence",
        "Word": "text",
        "Pattern": "choice",
        "Riddle": "text",
        "QuickQuiz": "choice",
    }

    # Question counts per difficulty; (lo, hi) means random in range (inclusive).
    QUESTION_COUNTS = {
        "Beginner": 1,
        "Easy": (1, 2),
        "Medium": 2,
        "Hard": 3,
        "Expert": (3, 5),
    }

    # Time budget (seconds) per challenge type for time-based verification (FR-WV-004).
    TIMEOUTS = {
        "Math": 60,
        "Logic": 90,
        "Memory": 45,
        "Word": 90,
        "Pattern": 60,
        "Riddle": 90,
        "QuickQuiz": 60,
    }
    DEFAULT_TIMEOUT = 90

    # A pending attempt may still be submitted this many seconds after the timer
    # reaches zero (covers network latency without letting a stale attempt live
    # forever). This is the anti-replay expiry window.
    EXPIRY_GRACE_SECONDS = 120

    # Memory sequence length by difficulty.
    MEMORY_LENGTHS = {"Beginner": 3, "Easy": 4, "Medium": 5, "Hard": 6, "Expert": 7}

    # Pattern cycle length by difficulty (2-4 shapes from the 4-shape alphabet).
    PATTERN_CYCLES = {"Beginner": 2, "Easy": 2, "Medium": 3, "Hard": 3, "Expert": 4}

    SHAPES = ["▲", "●", "■", "◆"]

    # Expanded, length-bucketed word bank (variety across all 5 difficulties).
    WORDS = [
        # 3-4 letters
        "sun", "map", "key", "cup", "leaf", "moon", "star", "wave", "fire", "rain",
        "book", "door", "tree", "bird", "fish", "time", "rest", "walk", "calm", "dawn",
        # 5 letters
        "alarm", "brain", "focus", "energy", "habit", "sleep", "dream", "light",
        "music", "clock", "quiet", "fresh", "alert", "medal", "value", "early",
        # 6-7 letters
        "memory", "puzzle", "streak", "morning", "routine", "balance", "fitness",
        "journey", "glimpse", "harvest", "vitality", "patience", "momentum",
        # 8+ letters
        "waking", "cognition", "attention", "schedule", "discipline", "resilience",
        "motivation", "creativity", "perception", "consistency", "breakthrough",
    ]

    # Curated riddles: each has exactly one unambiguous canonical answer.
    # (prompt, answer, explanation, difficulty)
    RIDDLES = [
        ("What gets wetter the more it dries?", "towel", "A towel absorbs water as it dries.", "Beginner"),
        ("What has a head and a tail but no body?", "coin", "A coin has two faces called heads and tails.", "Beginner"),
        ("What has hands but cannot clap?", "clock", "A clock face has hands that show the time.", "Beginner"),
        ("What has legs but cannot walk?", "table", "A table stands on legs but stays in place.", "Easy"),
        ("What has many teeth but cannot bite?", "comb", "A comb's teeth are for hair, not biting.", "Easy"),
        ("What can travel around the world while staying in a corner?", "stamp", "A postage stamp travels on letters.", "Easy"),
        ("The more you take, the more you leave behind. What are they?", "footsteps", "Each step leaves a footprint behind.", "Medium"),
        ("What has keys but cannot open locks?", "keyboard", "A keyboard has keys that type, not open.", "Medium"),
        ("What comes once in a minute, twice in a moment, but never in a thousand years?", "m", "The letter m appears once in 'minute' and twice in 'moment'.", "Medium"),
        ("What has a thumb and four fingers but is not alive?", "glove", "A glove has a thumb and four finger slots.", "Hard"),
        ("I speak without a mouth and hear without ears. What am I?", "echo", "An echo repeats sound with no mouth.", "Hard"),
        ("What can fill a room but takes up no space?", "light", "Light fills a room without occupying space.", "Hard"),
        ("What is full of holes but still holds water?", "sponge", "A sponge is porous yet soaks up water.", "Expert"),
        ("What breaks the moment you say its name?", "silence", "Naming silence breaks it.", "Expert"),
        ("What has a neck but no head?", "bottle", "A bottle has a neck without a head.", "Expert"),
    ]

    # ------------------------------------------------------------------
    # Deterministic question generators.
    # Each returns (questions, answers, explanations) with one entry per question.
    # `rng` is a `random.Random`-compatible source so tests can pin output.
    # ------------------------------------------------------------------

    @staticmethod
    def _math_prompt(a: int, op: str, b: int) -> Tuple[str, int]:
        if op == "+":
            return f"{a} + {b}", a + b
        if op == "-":
            hi, lo = (a, b) if a >= b else (b, a)
            return f"{hi} - {lo}", hi - lo
        return f"{a} x {b}", a * b

    @staticmethod
    def _gen_math(count: int, difficulty: str, rng) -> Tuple[List[dict], List[str], List[str]]:
        questions, answers, explanations = [], [], []
        # Easy/Beginner stay single binary operations (parseable by clients);
        # Hard/Expert use explicitly parenthesised two-step expressions so the
        # order of operations is never ambiguous.
        profiles = {
            "Beginner": ("addsub", 10, 9),
            "Easy": ("addsubmul", 20, 9),
            "Medium": ("addsubmul", 50, 12),
            "Hard": ("mixed", 15, 12),
            "Expert": ("mixed", 20, 15),
        }
        kind, max_a, max_b = profiles.get(difficulty, profiles["Medium"])
        for _ in range(count):
            if kind == "addsub":
                op = rng.choice(["+", "-"])
                a, b = rng.randint(1, max_a), rng.randint(1, max_b)
                prompt, value = ChallengeService._math_prompt(a, op, b)
            elif kind == "addsubmul":
                op = rng.choice(["+", "-", "x"])
                a, b = rng.randint(1, max_a), rng.randint(1, max_b)
                prompt, value = ChallengeService._math_prompt(a, op, b)
            else:
                a, b, c = rng.randint(2, max_a), rng.randint(2, max_b), rng.randint(1, 20)
                if rng.random() < 0.5:
                    prompt = f"({a} x {b}) + {c}"
                    value = (a * b) + c
                else:
                    prompt = f"({a} + {b}) x {c}"
                    value = (a + b) * c
            questions.append({"prompt": prompt, "type": "numeric", "options": None})
            answers.append(str(value))
            explanations.append(f"{prompt} = {value}")
        return questions, answers, explanations

    @staticmethod
    def _gen_logic(count: int, difficulty: str, rng) -> Tuple[List[dict], List[str], List[str]]:
        questions, answers, explanations = [], [], []
        for _ in range(count):
            if difficulty in ("Beginner", "Easy"):
                step = rng.choice([2, 3, 5]) if difficulty == "Beginner" else rng.choice([2, 3, 4, 5, 9])
                start = rng.randint(1, 9)
                seq = [start + step * i for i in range(4)]
                nxt = seq[-1] + step
                rule = f"add {step} each time"
            elif difficulty == "Medium":
                start = rng.randint(2, 6)
                ratio = rng.choice([2, 3])
                seq = [start * (ratio ** i) for i in range(4)]
                nxt = seq[-1] * ratio
                rule = f"multiply by {ratio} each time"
            elif difficulty == "Hard":
                start = rng.randint(1, 6)
                seq, step = [start], 2
                for _ in range(3):
                    seq.append(seq[-1] + step)
                    step += 1
                nxt = seq[-1] + step
                rule = "the gap grows by 1 each time"
            else:  # Expert
                start = rng.randint(1, 4)
                seq = [start]
                for _ in range(3):
                    seq.append(seq[-1] * 2 + 1)
                nxt = seq[-1] * 2 + 1
                rule = "double the previous value and add 1"
            prompt = f"Solve the pattern: {', '.join(map(str, seq))}, ?"
            questions.append({"prompt": prompt, "type": "numeric", "options": None})
            answers.append(str(nxt))
            explanations.append(f"The rule is: {rule}. {seq[-1]} -> {nxt}.")
        return questions, answers, explanations

    @staticmethod
    def _gen_memory(count: int, difficulty: str, rng) -> Tuple[List[dict], List[str], List[str]]:
        questions, answers, explanations = [], [], []
        length = ChallengeService.MEMORY_LENGTHS.get(difficulty, 5)
        for _ in range(count):
            seq = [rng.randint(0, 9) for _ in range(length)]
            joined = " ".join(map(str, seq))
            questions.append({
                "prompt": f"Memorize this sequence: {joined}",
                "type": "sequence",
                "options": None,
            })
            answers.append(joined)
            explanations.append(f"The sequence was {joined}.")
        return questions, answers, explanations

    @staticmethod
    def _gen_word(count: int, difficulty: str, rng) -> Tuple[List[dict], List[str], List[str]]:
        questions, answers, explanations = [], [], []
        buckets = {
            "Beginner": (3, 4),
            "Easy": (5, 5),
            "Medium": (6, 7),
            "Hard": (8, 20),
            "Expert": (8, 20),
        }
        lo, hi = buckets.get(difficulty, (5, 6))
        pool = [w for w in ChallengeService.WORDS if lo <= len(w) <= hi]
        if len(pool) < count:
            pool = list(ChallengeService.WORDS)
        chosen = rng.sample(pool, min(count, len(pool)))
        for word in chosen:
            scrambled = word
            for _ in range(30):
                candidate = "".join(rng.sample(word, len(word)))
                if candidate != word:
                    scrambled = candidate
                    break
            questions.append({"prompt": f"Unscramble the word: {scrambled}", "type": "text", "options": None})
            answers.append(word)
            explanations.append(f"The word is '{word}'.")
        return questions, answers, explanations

    @staticmethod
    def _gen_pattern(count: int, difficulty: str, rng) -> Tuple[List[dict], List[str], List[str]]:
        questions, answers, explanations = [], [], []
        cycle_len = ChallengeService.PATTERN_CYCLES.get(difficulty, 3)
        cycle_len = max(2, min(cycle_len, len(ChallengeService.SHAPES)))
        for _ in range(count):
            cycle = rng.sample(ChallengeService.SHAPES, cycle_len)
            shown = (cycle * 3)[: cycle_len * 2]
            next_shape = (cycle * 3)[cycle_len * 2]
            questions.append({
                "prompt": f"Pattern: {' '.join(shown)} ?",
                "type": "choice",
                "options": list(ChallengeService.SHAPES),
            })
            answers.append(next_shape)
            explanations.append(f"The repeating cycle is {' '.join(cycle)}, so the next shape is {next_shape}.")
        return questions, answers, explanations

    @staticmethod
    def _gen_riddle(count: int, difficulty: str, rng) -> Tuple[List[dict], List[str], List[str]]:
        pool = [r for r in ChallengeService.RIDDLES if r[3] == difficulty]
        rest = [r for r in ChallengeService.RIDDLES if r[3] != difficulty]
        ordered = pool + rest
        chosen = rng.sample(ordered, min(count, len(ordered)))
        questions, answers, explanations = [], [], []
        for prompt, answer, explanation, _difficulty in chosen:
            questions.append({"prompt": prompt, "type": "text", "options": None})
            answers.append(answer)
            explanations.append(explanation)
        return questions, answers, explanations

    @staticmethod
    def _gen_quickquiz(count: int, difficulty: str, rng) -> Tuple[List[dict], List[str], List[str]]:
        questions, answers, explanations = [], [], []
        for _ in range(count):
            flavor = rng.choice(["larger", "sum_check", "parity"])
            if flavor == "larger":
                a, b = rng.randint(1, 99), rng.randint(1, 99)
                if a == b:
                    b = a + 1
                hi, lo = (a, b) if a > b else (b, a)
                options = [str(lo), str(hi)]
                rng.shuffle(options)
                questions.append({
                    "prompt": f"Which number is larger: {a} or {b}?",
                    "type": "choice",
                    "options": options,
                })
                answers.append(str(hi))
                explanations.append(f"{hi} is larger than {lo}.")
            elif flavor == "sum_check":
                a, b = rng.randint(2, 40), rng.randint(2, 40)
                claimed = a + b + rng.choice([0, 1, -1, 2, -2])
                is_true = "yes" if claimed == a + b else "no"
                questions.append({
                    "prompt": f"Is {a} + {b} = {claimed}? (yes/no)",
                    "type": "choice",
                    "options": ["yes", "no"],
                })
                answers.append(is_true)
                explanations.append(f"{a} + {b} = {a + b}, so the claim was {'true' if is_true == 'yes' else 'false'}.")
            else:
                n = rng.randint(11, 99)
                even = "even" if n % 2 == 0 else "odd"
                questions.append({
                    "prompt": f"Is {n} even or odd?",
                    "type": "choice",
                    "options": ["even", "odd"],
                })
                answers.append(even)
                explanations.append(f"{n} is {even}.")
        return questions, answers, explanations

    GENERATORS = {
        "Math": _gen_math,
        "Logic": _gen_logic,
        "Memory": _gen_memory,
        "Word": _gen_word,
        "Pattern": _gen_pattern,
        "Riddle": _gen_riddle,
        "QuickQuiz": _gen_quickquiz,
    }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @classmethod
    def _question_count_for(cls, difficulty: str, override: Optional[int] = None) -> int:
        if override is not None:
            return max(1, min(int(override), 5))
        spec = cls.QUESTION_COUNTS.get(difficulty, cls.QUESTION_COUNTS["Medium"])
        if isinstance(spec, tuple):
            lo, hi = spec
            return random.randint(lo, hi)
        return spec

    @classmethod
    def _timeout_for(cls, challenge_type: str) -> int:
        return cls.TIMEOUTS.get(challenge_type, cls.DEFAULT_TIMEOUT)

    @classmethod
    def _expiry_for(cls, challenge_type: str) -> int:
        return cls._timeout_for(challenge_type) + cls.EXPIRY_GRACE_SECONDS

    @staticmethod
    def _stringify(value: Any) -> str:
        return "" if value is None else str(value)

    @staticmethod
    def _canonical_text(value: Any) -> str:
        """Unicode-safe, case-insensitive, whitespace-collapsed text form."""
        if value is None:
            return ""
        text = unicodedata.normalize("NFKC", str(value)).strip().casefold()
        text = text.replace("\u2212", "-")
        text = re.sub(r"\s+", " ", text)
        return text

    _NUMBER_RE = re.compile(r"^[+-]?\d{1,15}(?:\.\d+)?$")

    @classmethod
    def _to_number(cls, value: Any) -> Optional[float]:
        """Parse a numeric answer, tolerating commas, spaces, and trailing .0."""
        if value is None or isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return float(value)
        text = cls._canonical_text(value).replace(",", "").replace(" ", "")
        if not cls._NUMBER_RE.match(text):
            return None
        try:
            return float(text)
        except ValueError:
            return None

    @classmethod
    def _normalize_answer(cls, value: Any) -> str:
        """Canonical text form (kept for backwards compatibility)."""
        return cls._canonical_text(value)

    @classmethod
    def _normalize_sequence(cls, value: Any) -> str:
        """Digits-only form of a sequence answer (order preserved)."""
        if value is None:
            return ""
        return "".join(re.findall(r"\d", cls._canonical_text(value)))

    @classmethod
    def _normalize_text(cls, value: Any) -> str:
        """Text answer form with surrounding punctuation trimmed."""
        return cls._canonical_text(value).strip(".,!?;:'\"`()[]")

    @classmethod
    def answers_match(cls, expected: Any, user: Any, answer_type: str = "text") -> bool:
        """Type-aware, carefully bounded answer comparison.

        - numeric: both sides must parse as numbers and be equal
        - sequence: digits must match in order (separators ignored)
        - choice: case/whitespace-insensitive exact option match
        - text: normalized whole-word match (punctuation trimmed, not stripped)
        """
        if answer_type == "numeric":
            exp_num = cls._to_number(expected)
            usr_num = cls._to_number(user)
            return exp_num is not None and usr_num is not None and abs(exp_num - usr_num) < 1e-9

        if answer_type == "sequence":
            exp_seq = cls._normalize_sequence(expected)
            usr_seq = cls._normalize_sequence(user)
            return bool(exp_seq) and exp_seq == usr_seq

        if answer_type == "choice":
            return bool(cls._canonical_text(expected)) and cls._canonical_text(expected) == cls._canonical_text(user)

        exp_text = cls._normalize_text(expected)
        usr_text = cls._normalize_text(user)
        return bool(exp_text) and exp_text == usr_text

    @staticmethod
    def _neutral_feedback(answer_type: str) -> str:
        """Non-revealing feedback for an incorrect answer."""
        return {
            "numeric": "Incorrect - recheck the arithmetic.",
            "sequence": "The sequence did not match.",
            "choice": "Incorrect option selected.",
            "text": "Not quite - try a different answer.",
        }.get(answer_type, "Incorrect answer.")

    @classmethod
    def generate_question_set(
        cls,
        challenge_type: str,
        count: int,
        difficulty: str = "Medium",
        rng=None,
    ) -> Tuple[List[dict], List[str], List[dict]]:
        """Generate a deterministic question set with server-only answer metadata.

        Returns (questions, expected_answers, answer_meta). `questions` is safe to
        send to clients; `expected_answers`/`answer_meta` must stay server-side.
        """
        rng = rng or random
        generator = cls.GENERATORS.get(challenge_type, cls.GENERATORS["Math"])
        questions, answers, explanations = generator(max(1, count), difficulty, rng)
        questions, answers = questions[:count], answers[:count]
        explanations = (explanations + [""] * count)[:count]

        for index, question in enumerate(questions):
            question.setdefault("id", index + 1)
            question.setdefault("options", None)

        metas = [
            {
                "answer_type": question.get("type") or cls.ANSWER_TYPES.get(challenge_type, "text"),
                "explanation": explanations[index] if index < len(explanations) else "",
            }
            for index, question in enumerate(questions)
        ]
        return questions, answers, metas

    # Backwards-compatible alias used by earlier callers/tests.
    _generate_question_set = generate_question_set

    @classmethod
    def is_expired(cls, attempt: ChallengeAttempt, at: Optional[datetime] = None) -> bool:
        expires = _as_aware(attempt.expires_at)
        if expires is None:
            return False
        return expires < (at or _now())

    @classmethod
    def payload_for(cls, attempt: ChallengeAttempt) -> Dict[str, Any]:
        """Client-safe puzzle payload — never includes answers or explanations."""
        challenge = attempt.challenge
        challenge_type = challenge.challenge_type if challenge else "Math"
        expires = _as_aware(attempt.expires_at)
        return {
            "questions": attempt.puzzle_payload or [],
            "total_questions": attempt.total_questions or 0,
            "timeout_seconds": cls._timeout_for(challenge_type),
            "instructions": cls.INSTRUCTIONS.get(challenge_type, "Answer every question correctly."),
            "meta": {
                "challenge_type": challenge_type,
                "difficulty": challenge.difficulty if challenge else "Medium",
            },
            "expires_at": expires.isoformat() if expires else None,
            "expired": cls.is_expired(attempt),
        }

    @classmethod
    def results_for(cls, attempt: ChallengeAttempt) -> List[dict]:
        """Per-question verification results (safe: reveals answers only if correct)."""
        expected = attempt.expected_answers or []
        meta = attempt.answer_meta or []
        submitted = attempt.user_answers or []
        results: List[dict] = []
        for index in range(attempt.total_questions or len(expected)):
            answer_type = (
                meta[index].get("answer_type") if index < len(meta) and isinstance(meta[index], dict) else "text"
            )
            user_value = submitted[index] if index < len(submitted) else ""
            correct = cls.answers_match(
                expected[index] if index < len(expected) else "",
                user_value,
                answer_type,
            )
            if correct and index < len(meta) and isinstance(meta[index], dict) and meta[index].get("explanation"):
                feedback = meta[index]["explanation"]
            else:
                feedback = cls._neutral_feedback(answer_type)
            results.append({
                "index": index,
                "correct": correct,
                "answer_type": answer_type,
                "feedback": feedback,
            })
        return results

    # ------------------------------------------------------------------
    # Core flows
    # ------------------------------------------------------------------

    @classmethod
    def _adaptive_difficulty(
        cls,
        ended_attempts: List[ChallengeAttempt],
        snooze_count: int,
        db: Session | None = None,
        user_id: int | None = None,
    ) -> str:
        """Choose the next difficulty from the user's answered-attempt history.

        Policy:
        - No answered attempts yet -> onboarding band [Beginner, Easy, Medium].
        - Otherwise anchor on the difficulty of the most recent answered attempt
          and move at most one step (prediction is clamped into that band).
        - With a database handle, all six measured signals (recent accuracy,
          completion time, snooze frequency, failed attempts, recent
          difficulty, wake-up consistency) drive the recommendation via
          `recommend_difficulty`; otherwise the legacy aggregate path is used.
        """
        if not ended_attempts:
            return random.choice(["Beginner", "Easy", "Medium"])

        anchor = ended_attempts[0].challenge.difficulty
        base_idx = cls.DIFFICULTIES.index(anchor) if anchor in cls.DIFFICULTIES else 2
        band_low = max(0, base_idx - 1)
        band_high = min(len(cls.DIFFICULTIES) - 1, base_idx + 1)

        if db is not None and user_id is not None:
            from ..ai_engine.difficulty import recommend_difficulty

            predicted, _method, _explanation = recommend_difficulty(db, user_id, anchor)
            pred_idx = cls.DIFFICULTIES.index(predicted) if predicted in cls.DIFFICULTIES else base_idx
            return cls.DIFFICULTIES[min(max(pred_idx, band_low), band_high)]

        total_q = sum(a.total_questions for a in ended_attempts) or 1
        correct_t = sum(a.correct_answers for a in ended_attempts)
        success_rate = correct_t / total_q

        times = [
            a.time_taken_seconds
            for a in ended_attempts
            if a.time_taken_seconds and a.time_taken_seconds > 0
        ]
        avg_time = sum(times) / len(times) if times else 30.0

        streak = 0
        for attempt in ended_attempts:
            if attempt.completed:
                streak += 1
            else:
                break

        from .ml_inference import MLInferenceService

        predicted, _method = MLInferenceService.predict_difficulty(
            success_rate=success_rate,
            avg_time_seconds=avg_time,
            snooze_count=snooze_count,
            streak_length=streak,
            current_difficulty=anchor,
        )
        pred_idx = cls.DIFFICULTIES.index(predicted) if predicted in cls.DIFFICULTIES else base_idx
        return cls.DIFFICULTIES[min(max(pred_idx, band_low), band_high)]

    @classmethod
    async def get_adaptive_challenge(
        cls,
        db: Session,
        user_id: int,
        current_difficulty: Optional[str] = "Medium",
        challenge_type: Optional[str] = None,
        question_count: Optional[int] = None,
        rng=None,
    ) -> Optional[Tuple[Challenge, ChallengeAttempt]]:
        """Create a pending, expiring challenge attempt adapted to the user.

        Returns (challenge, pending_attempt). The attempt carries the client-safe
        `puzzle_payload` plus server-only `expected_answers`/`answer_meta` and an
        `expires_at` bound so it cannot be replayed indefinitely.
        """
        ended_attempts = (
            db.query(ChallengeAttempt)
            .filter(ChallengeAttempt.user_id == user_id, ChallengeAttempt.end_time.isnot(None))
            .order_by(ChallengeAttempt.end_time.desc())
            .limit(5)
            .all()
        )

        from ..Models import Alarm

        snooze_count = sum(
            a.times_snoozed for a in db.query(Alarm).filter(Alarm.user_id == user_id).all()
        )

        if current_difficulty in cls.DIFFICULTIES:
            new_difficulty = current_difficulty
        else:
            new_difficulty = cls._adaptive_difficulty(ended_attempts, snooze_count, db, user_id)

        if new_difficulty not in cls.DIFFICULTIES:
            new_difficulty = "Medium"

        query = db.query(Challenge).filter(Challenge.is_active)
        if challenge_type in cls.CHALLENGE_TYPES:
            query = query.filter(Challenge.challenge_type == challenge_type)
        challenge = query.filter(Challenge.difficulty == new_difficulty).order_by(func.random()).first()

        if challenge is None:
            challenge = cls._get_or_create_challenge(db, challenge_type or "Math", new_difficulty)

        count = cls._question_count_for(new_difficulty, question_count)
        questions, answers, metas = cls.generate_question_set(
            challenge.challenge_type, count, difficulty=new_difficulty, rng=rng
        )
        total = len(questions)
        if total == 0:
            # Extremely defensive: never create an attempt with no questions.
            questions, answers, metas = cls.generate_question_set(
                "Math", 1, difficulty=new_difficulty, rng=rng
            )
            total = len(questions)

        # Garbage-collect abandoned pending snapshots (unsubmitted "Generate" clicks).
        db.query(ChallengeAttempt).filter(
            ChallengeAttempt.user_id == user_id,
            ChallengeAttempt.completed.is_(False),
            ChallengeAttempt.end_time.is_(None),
        ).delete(synchronize_session=False)

        last_number = (
            db.query(func.max(ChallengeAttempt.attempt_number))
            .filter(ChallengeAttempt.user_id == user_id, ChallengeAttempt.challenge_id == challenge.id)
            .scalar()
        ) or 0

        now = _now()
        pending = ChallengeAttempt(
            user_id=user_id,
            challenge_id=challenge.id,
            attempt_number=int(last_number) + 1,
            completed=False,
            correct_answers=0,
            total_questions=total,
            start_time=now,
            expires_at=now + timedelta(seconds=cls._expiry_for(challenge.challenge_type)),
            puzzle_payload=questions,
            expected_answers=answers,
            answer_meta=metas,
        )
        challenge.generated_at = now

        db.add(pending)
        db.add(challenge)
        db.commit()
        db.refresh(pending)
        db.refresh(challenge)
        return challenge, pending

    @staticmethod
    def _get_or_create_challenge(db: Session, challenge_type: str, difficulty: str) -> Challenge:
        """Find or lazily create a Challenge row for a type/difficulty (Level 3.4.4)."""
        challenge = (
            db.query(Challenge)
            .filter(Challenge.challenge_type == challenge_type, Challenge.difficulty == difficulty)
            .first()
        )
        if challenge is None:
            challenge = Challenge(
                title=f"{challenge_type} challenge",
                description=f"Adaptive {challenge_type} challenge at {difficulty} difficulty",
                challenge_type=challenge_type,
                difficulty=difficulty,
                is_active=True,
            )
            db.add(challenge)
            db.flush()
        return challenge

    @classmethod
    def submit_attempt(
        cls,
        db: Session,
        user_id: int,
        challenge_id: int,
        attempt_id: int,
        user_answer: Optional[str] = None,
        user_answers: Optional[List[str]] = None,
        time_taken_seconds: int = 0,
    ) -> ChallengeAttempt:
        """Authoritative, single-use server-side verification of a pending attempt.

        Raises:
            AttemptNotFound  (404) - missing or owned by another user
            AttemptReplay    (409) - already submitted
            AttemptExpired   (410) - time budget elapsed
            MalformedSubmission (400) - structurally invalid answer payload
        """
        attempt = (
            db.query(ChallengeAttempt)
            .filter(
                ChallengeAttempt.id == attempt_id,
                ChallengeAttempt.user_id == user_id,
                ChallengeAttempt.challenge_id == challenge_id,
            )
            .first()
        )
        if attempt is None:
            raise AttemptNotFound("Challenge attempt not found for this user")

        if attempt.end_time is not None or attempt.completed:
            raise AttemptReplay("This challenge attempt has already been submitted")

        if cls.is_expired(attempt):
            raise AttemptExpired("This challenge attempt has expired; generate a new challenge")

        expected = attempt.expected_answers or []
        meta = attempt.answer_meta or []
        total = attempt.total_questions or len(expected)

        if user_answers is None and user_answer is None:
            raise MalformedSubmission("No answer was submitted")

        if user_answers is not None:
            if not isinstance(user_answers, list) or len(user_answers) == 0:
                raise MalformedSubmission("user_answers must be a non-empty list")
            submitted = [cls._stringify(value) for value in user_answers]
        else:
            submitted = [cls._stringify(user_answer)]

        if total <= 0:
            raise MalformedSubmission("This attempt has no questions to answer")
        if len(submitted) > total:
            raise MalformedSubmission("More answers were submitted than there are questions")
        # Fewer answers than questions is allowed but counts the missing ones as
        # incorrect (an incomplete attempt can never pass).
        submitted = submitted + [""] * (total - len(submitted))

        correct = 0
        for index in range(total):
            answer_type = (
                meta[index].get("answer_type")
                if index < len(meta) and isinstance(meta[index], dict)
                else cls.ANSWER_TYPES.get(attempt.challenge.challenge_type, "text")
            )
            if cls.answers_match(
                expected[index] if index < len(expected) else "",
                submitted[index],
                answer_type,
            ):
                correct += 1

        completed = total > 0 and correct == total

        attempt.user_answers = submitted
        attempt.correct_answers = correct
        attempt.completed = completed
        attempt.end_time = _now()
        attempt.time_taken_seconds = max(0, int(time_taken_seconds or 0))

        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return attempt
