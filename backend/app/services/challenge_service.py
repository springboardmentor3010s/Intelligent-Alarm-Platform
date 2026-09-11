"""Challenge service for adaptive difficulty and server-authoritative puzzle generation.

Design (Milestone 2):
- Each challenge type generates a deterministic question set from one source of
  truth: the prompt AND the answer derive from the same generated data, so the
  client never sees the answer.
- `GET /challenges/next` creates a pending `ChallengeAttempt` holding the puzzle
  snapshot (`puzzle_payload`) and the server-side expected answers.
- `POST /challenges/submit` performs the authoritative comparison and marks the
  attempt complete. The alarm dismiss endpoint then only accepts a completed,
  all-correct, user-owned attempt.
"""

import random
import re
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..Models import Challenge, ChallengeAttempt


class ChallengeService:
    """Service for adaptive challenge generation and answer verification."""

    CHALLENGE_TYPES = ["Math", "Logic", "Memory", "Word", "Pattern", "Riddle", "QuickQuiz"]
    DIFFICULTIES = ["Beginner", "Easy", "Medium", "Hard", "Expert"]

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

    WORDS = ["morning", "alarm", "puzzle", "streak", "focus", "energy", "brain", "memory", "routine", "waking"]
    SHAPES = ["▲", "●", "■", "◆"]
    RIDDLES = [
        ("What has keys but can't open locks?", "piano"),
        ("What has a head and a tail but no body?", "coin"),
        ("What gets wetter the more it dries?", "towel"),
        ("The more you take, the more you leave behind. What am I?", "footsteps"),
        ("What comes once in a minute, twice in a moment, but never in a thousand years?", "m"),
        ("What can travel around the world while staying in a corner?", "stamp"),
    ]

    # ------------------------------------------------------------------
    # Deterministic question generators: each returns (questions, answers).
    # ------------------------------------------------------------------

    @staticmethod
    def _gen_math(count: int) -> Tuple[List[dict], List[str]]:
        questions, answers = [], []
        ops = [
            ("+", lambda a, b: a + b),
            ("-", lambda a, b: a - b),
            ("x", lambda a, b: a * b),
        ]
        for _ in range(count):
            op_sym, compute = random.choice(ops)
            if op_sym == "-":
                a, b = random.randint(2, 50), random.randint(1, 9)
                if b > a:
                    a, b = b, a
            else:
                a, b = random.randint(1, 50), random.randint(1, 12)
            questions.append({"prompt": f"{a} {op_sym} {b}", "type": "numeric", "options": None})
            answers.append(str(compute(a, b)))
        return questions, answers

    @staticmethod
    def _gen_logic(count: int) -> Tuple[List[dict], List[str]]:
        questions, answers = [], []
        for _ in range(count):
            step = random.choice([2, 3, 5])
            start = random.randint(1, 9)
            seq = [start + step * i for i in range(4)]
            questions.append({
                "prompt": f"Solve the pattern: {', '.join(map(str, seq))}, ?",
                "type": "numeric",
                "options": None,
            })
            answers.append(str(seq[-1] + step))
        return questions, answers

    @staticmethod
    def _gen_memory(count: int) -> Tuple[List[dict], List[str]]:
        questions, answers = [], []
        for _ in range(count):
            seq = [random.randint(0, 9) for _ in range(5)]
            questions.append({
                "prompt": f"Memorize this sequence: {' '.join(map(str, seq))}",
                "type": "sequence",
                "options": None,
            })
            answers.append(" ".join(map(str, seq)))
        return questions, answers

    @staticmethod
    def _gen_word(count: int) -> Tuple[List[dict], List[str]]:
        questions, answers = [], []
        for word in random.sample(ChallengeService.WORDS, min(count, len(ChallengeService.WORDS))):
            # Guarantee the scrambled form is different from the original word.
            # For very short words (1-char) this loop will exit after a fixed
            # number of attempts and fall back to showing a hint instead.
            for _ in range(20):
                scrambled = "".join(random.sample(word, len(word)))
                if scrambled != word or len(word) == 1:
                    break
            questions.append({"prompt": f"Unscramble the word: {scrambled}", "type": "text", "options": None})
            answers.append(word)
        return questions, answers

    @staticmethod
    def _gen_pattern(count: int) -> Tuple[List[dict], List[str]]:
        questions, answers = [], []
        for _ in range(count):
            cycle_len = random.choice([2, 3])
            cycle = random.sample(ChallengeService.SHAPES, cycle_len)
            # Show 2 full repetitions of the cycle, then ask for the next element.
            # `shown` has `cycle_len * 2` elements; the next element is at index
            # `cycle_len * 2` in the infinite repetition, i.e. cycle[0] of the next
            # repetition — which equals cycle[(cycle_len * 2) % cycle_len] == cycle[0].
            # Previously this was written as cycle[2 * cycle_len % cycle_len] which is
            # always 0 by modular arithmetic (2n mod n == 0), giving the WRONG answer
            # for non-trivial cycles. The correct next element is the (cycle_len*2)-th
            # element of the infinite repetition: (cycle * 3)[cycle_len * 2].
            shown = (cycle * 3)[: cycle_len * 2]
            next_shape = (cycle * 3)[cycle_len * 2]  # BUG FIX: was cycle[2*cycle_len%cycle_len]
            questions.append({
                "prompt": f"Pattern: {' '.join(shown)} ?",
                "type": "visual",
                "options": list(ChallengeService.SHAPES),
            })
            answers.append(next_shape)
        return questions, answers

    @staticmethod
    def _gen_riddle(count: int) -> Tuple[List[dict], List[str]]:
        chosen = random.sample(ChallengeService.RIDDLES, min(count, len(ChallengeService.RIDDLES)))
        questions = [{"prompt": text, "type": "text", "options": None} for text, _ in chosen]
        answers = [answer for _, answer in chosen]
        return questions, answers

    @staticmethod
    def _gen_quickquiz(count: int) -> Tuple[List[dict], List[str]]:
        questions, answers = [], []
        for _ in range(count):
            a, b = random.randint(1, 50), random.randint(1, 50)
            questions.append({"prompt": f"Quick Quiz: {a} + {b}", "type": "numeric", "options": None})
            answers.append(str(a + b))
        return questions, answers

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

    @staticmethod
    def _normalize_answer(value: Any) -> str:
        if value is None:
            return ""
        s = str(value).strip().lower()
        if "." in s and s.replace(".", "", 1).isdigit() and s.endswith(".0"):
            s = s[:-2]
        return s

    @staticmethod
    def _normalize_sequence(value: Any) -> str:
        return re.sub(r"\D", "", str(value or ""))

    @classmethod
    def _answers_match(cls, expected: Any, user: Any) -> bool:
        """Type-aware comparison: exact, numeric, or digit-sequence."""
        if cls._normalize_answer(expected) == cls._normalize_answer(user):
            return True
        exp_digits = cls._normalize_sequence(expected)
        usr_digits = cls._normalize_sequence(user)
        return len(exp_digits) > 0 and exp_digits == usr_digits

    @classmethod
    def _generate_question_set(cls, challenge_type: str, count: int) -> Tuple[List[dict], List[str]]:
        generator = cls.GENERATORS.get(challenge_type, cls.GENERATORS["Math"])
        questions, answers = generator(count)
        return questions[:count], answers[:count]

    @classmethod
    def payload_for(cls, attempt: ChallengeAttempt) -> Dict[str, Any]:
        """Client-safe puzzle payload — never includes answers."""
        return {
            "questions": attempt.puzzle_payload or [],
            "total_questions": attempt.total_questions or 0,
            "timeout_seconds": ChallengeService._timeout_for(attempt.challenge.challenge_type),
        }

    # ------------------------------------------------------------------
    # Core flows
    # ------------------------------------------------------------------

    @classmethod
    async def get_adaptive_challenge(
        cls,
        db: Session,
        user_id: int,
        current_difficulty: str = "Medium",
        challenge_type: Optional[str] = None,
        question_count: Optional[int] = None,
    ) -> Optional[Tuple[Challenge, ChallengeAttempt]]:
        """Create a pending challenge attempt adapted to the user's performance.

        Returns (challenge, pending_attempt) with `puzzle_payload` and
        `expected_answers` snapshots persisted server-side.
        """
        # --- Adaptive difficulty from user history (rule-based fallback) ---
        recent_attempts = (
            db.query(ChallengeAttempt)
            .filter(ChallengeAttempt.user_id == user_id, ChallengeAttempt.completed.is_(True))
            .order_by(ChallengeAttempt.created_at.desc())
            .limit(5)
            .all()
        )

        if recent_attempts:
            total_q = sum(a.total_questions for a in recent_attempts) or 1
            correct_t = sum(a.correct_answers for a in recent_attempts)
            success_rate = correct_t / total_q if total_q else 0.5
            times = [a.time_taken_seconds for a in recent_attempts if a.time_taken_seconds and a.time_taken_seconds > 0]
            avg_time = sum(times) / len(times) if times else 30.0
        else:
            success_rate, avg_time = 0.5, 30.0

        from ..Models import Alarm

        snooze_count = sum(
            a.times_snoozed for a in db.query(Alarm).filter(Alarm.user_id == user_id).all()
        )
        streak = 0
        for attempt in recent_attempts:
            if attempt.completed:
                streak += 1
            else:
                break

        from .ml_inference import MLInferenceService

        new_difficulty, _method = MLInferenceService.predict_difficulty(
            success_rate=success_rate,
            avg_time_seconds=avg_time,
            snooze_count=snooze_count,
            streak_length=streak,
            current_difficulty=current_difficulty,
        )

        # --- Select or create the challenge row ---
        if new_difficulty not in cls.DIFFICULTIES:
            new_difficulty = "Medium"

        query = db.query(Challenge).filter(Challenge.is_active)
        if challenge_type in cls.CHALLENGE_TYPES:
            query = query.filter(Challenge.challenge_type == challenge_type)
        challenge = query.filter(Challenge.difficulty == new_difficulty).order_by(func.random()).first()

        if challenge is None:
            challenge = cls._get_or_create_challenge(db, challenge_type or "Math", new_difficulty)

        # --- Build the question set and persist a pending attempt ---
        count = cls._question_count_for(new_difficulty, question_count)
        questions, answers = cls._generate_question_set(challenge.challenge_type, count)

        last_number = (
            db.query(func.max(ChallengeAttempt.attempt_number))
            .filter(ChallengeAttempt.user_id == user_id, ChallengeAttempt.challenge_id == challenge.id)
            .scalar()
        ) or 0

        pending = ChallengeAttempt(
            user_id=user_id,
            challenge_id=challenge.id,
            attempt_number=int(last_number) + 1,
            completed=False,
            correct_answers=0,
            total_questions=count,
            start_time=datetime.now(timezone.utc),
            puzzle_payload=questions,
            expected_answers=answers,
        )
        challenge.generated_at = datetime.now(timezone.utc)

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
        """Authoritative server-side answer verification for a pending attempt."""
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
            raise LookupError("Challenge attempt not found for this user")
        if attempt.completed:
            raise LookupError("Challenge attempt already completed")

        expected = attempt.expected_answers or []
        if user_answers is not None:
            submitted = [str(u) if u is not None else "" for u in user_answers]
        else:
            submitted = [str(user_answer) if user_answer is not None else ""]

        correct = sum(
            1 for exp, usr in zip(expected, submitted) if cls._answers_match(exp, usr)
        )
        completed = len(expected) > 0 and correct == len(expected)

        attempt.user_answers = submitted
        attempt.correct_answers = correct
        attempt.completed = completed
        attempt.end_time = datetime.now(timezone.utc)
        attempt.time_taken_seconds = max(0, time_taken_seconds)

        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return attempt
