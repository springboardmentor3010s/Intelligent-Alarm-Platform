"""Wake-up verification engine.

Five verification methods from the project spec:
  puzzle         - solve one puzzle (retry until correct)
  multi_step     - solve 3 puzzles of 3 different types
  consecutive    - 3 correct answers in a row (a wrong answer resets the streak)
  timed          - solve one puzzle within a tightened time limit (timeouts count as wrong)
  accuracy_check - answer 5 questions, at least 4 must be right (otherwise the round restarts)

The server is authoritative: a session is only 'dismissed' once these rules are satisfied.
"""
from dataclasses import dataclass

from app.models import WakeSession


@dataclass(frozen=True)
class MethodConfig:
    required_correct: int
    max_questions: int | None
    time_factor: float = 1.0
    distinct_types: bool = False
    streak_required: bool = False


METHODS: dict[str, MethodConfig] = {
    "puzzle": MethodConfig(1, None),
    "multi_step": MethodConfig(3, None, distinct_types=True),
    "consecutive": MethodConfig(3, None, streak_required=True),
    "timed": MethodConfig(1, None, time_factor=0.5),
    "accuracy_check": MethodConfig(4, 5),
}

DESCRIPTIONS = {
    "puzzle": "Solve one puzzle to dismiss.",
    "multi_step": "Solve 3 different puzzles in a row.",
    "consecutive": "Get 3 correct answers in a row.",
    "timed": "Solve one puzzle against a tighter clock.",
    "accuracy_check": "Answer 5 questions with at least 4 correct.",
}


def config_for(method: str) -> MethodConfig:
    return METHODS.get(method, METHODS["puzzle"])


def init_session(session: WakeSession, method: str) -> None:
    cfg = config_for(method)
    session.verification_method = method if method in METHODS else "puzzle"
    session.required_correct = cfg.required_correct
    session.max_questions = cfg.max_questions


def apply_answer(session: WakeSession, is_correct: bool) -> str:
    """Mutates the session counters. Returns 'dismissed' | 'continue' | 'round_failed'."""
    cfg = config_for(session.verification_method)
    session.attempts += 1
    session.questions_asked += 1
    if is_correct:
        session.correct_count += 1
        session.consecutive += 1
    else:
        session.wrong_count += 1
        session.consecutive = 0

    if cfg.streak_required:
        done = session.consecutive >= cfg.required_correct
    elif cfg.max_questions:
        done = session.correct_count >= cfg.required_correct
        if not done and session.questions_asked >= cfg.max_questions:
            # Failed the accuracy round: start a fresh round (the alarm keeps ringing).
            session.correct_count = 0
            session.questions_asked = 0
            session.consecutive = 0
            return "round_failed"
    else:
        done = session.correct_count >= cfg.required_correct
    return "dismissed" if done else "continue"


def progress(session: WakeSession) -> dict:
    cfg = config_for(session.verification_method)
    have = session.consecutive if cfg.streak_required else session.correct_count
    return {
        "method": session.verification_method,
        "description": DESCRIPTIONS.get(session.verification_method, ""),
        "have": have,
        "need": session.required_correct,
        "questions_asked": session.questions_asked,
        "max_questions": session.max_questions,
    }
