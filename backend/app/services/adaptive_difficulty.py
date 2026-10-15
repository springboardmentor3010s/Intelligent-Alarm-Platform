"""
Adaptive Difficulty Engine for Milestone 3.

Per-Alarm 2-Attempt Adaptive Difficulty Decision Engine:
Evaluates the user's latest TWO completed cognitive challenge attempts for a
specific alarm_id and automatically determines the difficulty of the NEXT cognitive challenge.

Difficulty Levels:
Beginner → Easy → Medium → Hard → Expert

Decision Rules:
1. 2/2 correct (Both correct)           → Increase difficulty by exactly ONE level (max: Expert)
2. 1/2 correct (One correct, one wrong) → Keep SAME difficulty
3. 0/2 correct (Both incorrect)         → Decrease difficulty by exactly ONE level (min: Beginner)
4. Fewer than 2 completed attempts      → No difficulty change

Isolation:
- Evaluates attempts strictly for the SAME alarm_id.
- Ignores expired, started, cancelled, or unrelated sessions.
- Idempotent and pair-based: guarantees a pair of attempts cannot repeatedly trigger adjustment.
"""

from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session


DIFFICULTY_LEVELS = [
    "beginner",
    "easy",
    "medium",
    "hard",
    "expert",
]


def adjust_difficulty(
    current_difficulty: str,
    correct: bool,
) -> str:
    """
    Adjust challenge difficulty based on a single challenge result.
    Preserved for backwards compatibility with legacy service callers.
    """
    current_difficulty = (current_difficulty or "medium").strip().lower()

    if current_difficulty not in DIFFICULTY_LEVELS:
        current_difficulty = "medium"

    current_index = DIFFICULTY_LEVELS.index(current_difficulty)

    if correct:
        if current_index < len(DIFFICULTY_LEVELS) - 1:
            current_index += 1
    else:
        if current_index > 0:
            current_index -= 1

    return DIFFICULTY_LEVELS[current_index]


def get_next_difficulty_level(current_difficulty: str, delta: int) -> str:
    """
    Shifts difficulty by delta (+1: increase, -1: decrease, 0: maintain),
    strictly respecting the Beginner (min) and Expert (max) boundaries.
    """
    current_difficulty = (current_difficulty or "medium").strip().lower()
    if current_difficulty not in DIFFICULTY_LEVELS:
        current_difficulty = "medium"

    idx = DIFFICULTY_LEVELS.index(current_difficulty)
    new_idx = max(0, min(len(DIFFICULTY_LEVELS) - 1, idx + delta))
    return DIFFICULTY_LEVELS[new_idx]


def evaluate_two_attempt_adaptive_difficulty(
    current_difficulty: str,
    results: List[bool],
) -> Dict[str, Any]:
    """
    Pure evaluation function for the 2-attempt adaptive difficulty rule.

    Results is a list of boolean correctness values for completed attempts
    in chronological order (e.g. [True, True], [True, False], etc.).
    """
    curr = (current_difficulty or "medium").strip().lower()
    if curr not in DIFFICULTY_LEVELS:
        curr = "medium"

    # Fewer than 2 completed attempts
    if len(results) < 2:
        results_str = ["correct" if r else "incorrect" for r in results]
        return {
            "previous_difficulty": curr,
            "results": results_str,
            "decision": "maintain",
            "action": "MAINTAIN",
            "next_difficulty": curr,
            "reason": f"Only {len(results)} completed attempt(s) recorded. Minimum 2 required for adaptive adjustment.",
            "adjusted": False,
        }

    latest_two = results[-2:]
    results_str = ["correct" if r else "incorrect" for r in latest_two]
    correct_count = sum(1 for r in latest_two if r is True)

    curr_idx = DIFFICULTY_LEVELS.index(curr)

    if correct_count == 2:
        # 1. BOTH attempts correct → Increase one level
        if curr_idx < len(DIFFICULTY_LEVELS) - 1:
            next_diff = DIFFICULTY_LEVELS[curr_idx + 1]
            adjusted = True
            decision = "increase"
            action = "INCREASE"
            reason = "2/2 correct → Difficulty increased"
        else:
            next_diff = curr
            adjusted = False
            decision = "maintain"
            action = "MAINTAIN"
            reason = "2/2 correct → Already at Expert difficulty (Maximum)"

    elif correct_count == 1:
        # 2. ONE correct and ONE incorrect → Keep SAME difficulty
        next_diff = curr
        adjusted = False
        decision = "maintain"
        action = "MAINTAIN"
        reason = "1/2 correct → Difficulty maintained"

    else:
        # 3. BOTH attempts incorrect → Decrease one level
        if curr_idx > 0:
            next_diff = DIFFICULTY_LEVELS[curr_idx - 1]
            adjusted = True
            decision = "decrease"
            action = "DECREASE"
            reason = "0/2 correct → Difficulty decreased"
        else:
            next_diff = curr
            adjusted = False
            decision = "maintain"
            action = "MAINTAIN"
            reason = "0/2 correct → Already at Beginner difficulty (Minimum)"

    return {
        "previous_difficulty": curr,
        "results": results_str,
        "decision": decision,
        "action": action,
        "next_difficulty": next_diff,
        "reason": reason,
        "adjusted": adjusted,
    }


def evaluate_and_apply_adaptive_difficulty(
    alarm_id: int,
    db: Session,
) -> Dict[str, Any]:
    """
    Evaluates completed sessions for a specific alarm_id, determines if a 2-attempt
    pair has completed, applies the new difficulty to Alarm in DB, logs the action,
    and returns the adaptive result payload.
    """
    from app.database.models import Alarm, AlarmSession

    alarm = db.query(Alarm).filter(Alarm.id == alarm_id).first()
    if not alarm:
        return {
            "alarm_id": alarm_id,
            "previous_difficulty": "medium",
            "results": [],
            "decision": "maintain",
            "action": "MAINTAIN",
            "next_difficulty": "medium",
            "reason": "Alarm not found",
            "adjusted": False,
        }

    # Query strictly COMPLETED sessions for this specific alarm_id with valid correctness
    completed_sessions = (
        db.query(AlarmSession)
        .filter(
            AlarmSession.alarm_id == alarm_id,
            AlarmSession.session_status == "completed",
            AlarmSession.is_correct.is_not(None),
        )
        .order_by(AlarmSession.completed_at.asc(), AlarmSession.id.asc())
        .all()
    )

    total_completed = len(completed_sessions)

    # 1. Fewer than 2 completed attempts
    if total_completed < 2:
        results_str = ["correct" if s.is_correct else "incorrect" for s in completed_sessions]
        return {
            "alarm_id": alarm_id,
            "previous_difficulty": (alarm.difficulty or "medium").strip().lower(),
            "results": results_str,
            "decision": "maintain",
            "action": "MAINTAIN",
            "next_difficulty": (alarm.difficulty or "medium").strip().lower(),
            "reason": f"Only {total_completed} completed attempt(s) recorded. Minimum 2 required for adaptive adjustment.",
            "adjusted": False,
        }

    # 2. Check pair cycle:
    # If total_completed is odd, this is attempt 1 of a new pair -> Do NOT change difficulty yet.
    if total_completed % 2 == 1:
        current_diff = (alarm.difficulty or "medium").strip().lower()
        latest_res = ["correct" if completed_sessions[-1].is_correct else "incorrect"]
        return {
            "alarm_id": alarm_id,
            "previous_difficulty": current_diff,
            "results": latest_res,
            "decision": "maintain",
            "action": "MAINTAIN",
            "next_difficulty": current_diff,
            "reason": "1/2 attempts completed in current cycle. Next attempt will determine difficulty adjustment.",
            "adjusted": False,
        }

    # 3. Total completed is even (2, 4, 6, ...) -> This completes a 2-attempt pair!
    # Evaluate the latest 2 attempts for this alarm
    pair_sessions = completed_sessions[-2:]
    pair_results = [s.is_correct for s in pair_sessions]

    # Determine tested difficulty from the challenge of the completed pair
    from app.database.models import CognitiveChallenge

    tested_diff = None
    if pair_sessions[-1].challenge_id:
        chal = (
            db.query(CognitiveChallenge)
            .filter(CognitiveChallenge.id == pair_sessions[-1].challenge_id)
            .first()
        )
        if chal and chal.difficulty and chal.difficulty.strip().lower() in DIFFICULTY_LEVELS:
            tested_diff = chal.difficulty.strip().lower()

    if not tested_diff and pair_sessions[-2].challenge_id:
        chal2 = (
            db.query(CognitiveChallenge)
            .filter(CognitiveChallenge.id == pair_sessions[-2].challenge_id)
            .first()
        )
        if chal2 and chal2.difficulty and chal2.difficulty.strip().lower() in DIFFICULTY_LEVELS:
            tested_diff = chal2.difficulty.strip().lower()

    if not tested_diff:
        tested_diff = (alarm.difficulty or "medium").strip().lower()

    eval_res = evaluate_two_attempt_adaptive_difficulty(tested_diff, pair_results)
    next_diff = eval_res["next_difficulty"]

    # Apply to the alarm in the database so the NEXT challenge generation uses it
    if (alarm.difficulty or "").strip().lower() != next_diff:
        alarm.difficulty = next_diff
        db.commit()
        db.refresh(alarm)

    # Required backend logging format
    print(
        f"\n[Adaptive Difficulty]\n"
        f"alarm_id={alarm_id}\n"
        f"previous={eval_res['previous_difficulty'].capitalize()}\n"
        f"results=[{', '.join(eval_res['results'])}]\n"
        f"action={eval_res['action']}\n"
        f"next_difficulty={next_diff.capitalize()}\n"
    )

    return {
        "alarm_id": alarm_id,
        "previous_difficulty": eval_res["previous_difficulty"],
        "results": eval_res["results"],
        "decision": eval_res["decision"],
        "action": eval_res["action"],
        "next_difficulty": next_diff,
        "reason": eval_res["reason"],
        "adjusted": eval_res["adjusted"],
    }


def get_alarm_adaptive_status(
    alarm_id: int,
    db: Session,
) -> Dict[str, Any]:
    """
    Read-only inspection of an alarm's current adaptive difficulty status,
    with database synchronization if an unapplied transition is detected.
    """
    from app.database.models import Alarm, AlarmSession, CognitiveChallenge

    alarm = db.query(Alarm).filter(Alarm.id == alarm_id).first()
    if not alarm:
        return {
            "alarm_id": alarm_id,
            "previous_difficulty": "medium",
            "results": [],
            "decision": "maintain",
            "action": "MAINTAIN",
            "next_difficulty": "medium",
            "reason": "Alarm not found",
            "adjusted": False,
        }

    current_diff = (alarm.difficulty or "medium").strip().lower()
    if current_diff not in DIFFICULTY_LEVELS:
        current_diff = "medium"

    completed_sessions = (
        db.query(AlarmSession)
        .filter(
            AlarmSession.alarm_id == alarm_id,
            AlarmSession.session_status == "completed",
            AlarmSession.is_correct.is_not(None),
        )
        .order_by(AlarmSession.completed_at.asc(), AlarmSession.id.asc())
        .all()
    )

    total_completed = len(completed_sessions)

    if total_completed == 0:
        return {
            "alarm_id": alarm_id,
            "previous_difficulty": current_diff,
            "results": [],
            "decision": "maintain",
            "action": "MAINTAIN",
            "next_difficulty": current_diff,
            "reason": "No completed attempts recorded for this alarm yet.",
            "adjusted": False,
        }

    if total_completed % 2 == 1:
        latest_res = ["correct" if completed_sessions[-1].is_correct else "incorrect"]
        return {
            "alarm_id": alarm_id,
            "previous_difficulty": current_diff,
            "results": latest_res,
            "decision": "maintain",
            "action": "MAINTAIN",
            "next_difficulty": current_diff,
            "reason": "1/2 attempts completed in current cycle. Next attempt will determine difficulty adjustment.",
            "adjusted": False,
        }

    # Even number >= 2: inspected state of the latest evaluated pair
    pair_sessions = completed_sessions[-2:]
    pair_results = [s.is_correct for s in pair_sessions]
    correct_count = sum(1 for r in pair_results if r is True)
    results_str = ["correct" if r else "incorrect" for r in pair_results]

    tested_diff = None
    if pair_sessions[-1].challenge_id:
        chal = (
            db.query(CognitiveChallenge)
            .filter(CognitiveChallenge.id == pair_sessions[-1].challenge_id)
            .first()
        )
        if chal and chal.difficulty and chal.difficulty.strip().lower() in DIFFICULTY_LEVELS:
            tested_diff = chal.difficulty.strip().lower()

    if not tested_diff and pair_sessions[-2].challenge_id:
        chal2 = (
            db.query(CognitiveChallenge)
            .filter(CognitiveChallenge.id == pair_sessions[-2].challenge_id)
            .first()
        )
        if chal2 and chal2.difficulty and chal2.difficulty.strip().lower() in DIFFICULTY_LEVELS:
            tested_diff = chal2.difficulty.strip().lower()

    if tested_diff:
        eval_res = evaluate_two_attempt_adaptive_difficulty(tested_diff, pair_results)
        next_diff = eval_res["next_difficulty"]

        # Ensure DB persistence for this alarm
        if (alarm.difficulty or "").strip().lower() != next_diff:
            alarm.difficulty = next_diff
            db.commit()
            db.refresh(alarm)

        return {
            "alarm_id": alarm_id,
            "previous_difficulty": eval_res["previous_difficulty"],
            "results": eval_res["results"],
            "decision": eval_res["decision"],
            "action": eval_res["action"],
            "next_difficulty": next_diff,
            "reason": eval_res["reason"],
            "adjusted": eval_res["adjusted"],
        }

    # Fallback if no challenge was linked (e.g. raw test sessions)
    curr_idx = DIFFICULTY_LEVELS.index(current_diff)
    if correct_count == 2:
        if curr_idx > 0 and current_diff != "beginner":
            prev_diff = DIFFICULTY_LEVELS[curr_idx - 1]
            next_diff = current_diff
            decision = "increase"
            action = "INCREASE"
            reason = "2/2 correct → Difficulty increased"
            adjusted = True
        else:
            prev_diff = current_diff
            next_diff = DIFFICULTY_LEVELS[min(len(DIFFICULTY_LEVELS) - 1, curr_idx + 1)]
            decision = "increase" if next_diff != prev_diff else "maintain"
            action = "INCREASE" if next_diff != prev_diff else "MAINTAIN"
            reason = "2/2 correct → Difficulty increased" if next_diff != prev_diff else "2/2 correct → Already at Expert difficulty (Maximum)"
            adjusted = next_diff != prev_diff
            if (alarm.difficulty or "").strip().lower() != next_diff:
                alarm.difficulty = next_diff
                db.commit()
                db.refresh(alarm)
    elif correct_count == 0:
        if curr_idx < len(DIFFICULTY_LEVELS) - 1 and current_diff != "expert":
            prev_diff = DIFFICULTY_LEVELS[curr_idx + 1]
            next_diff = current_diff
            decision = "decrease"
            action = "DECREASE"
            reason = "0/2 correct → Difficulty decreased"
            adjusted = True
        else:
            prev_diff = current_diff
            next_diff = DIFFICULTY_LEVELS[max(0, curr_idx - 1)]
            decision = "decrease" if next_diff != prev_diff else "maintain"
            action = "DECREASE" if next_diff != prev_diff else "MAINTAIN"
            reason = "0/2 correct → Difficulty decreased" if next_diff != prev_diff else "0/2 correct → Already at Beginner difficulty (Minimum)"
            adjusted = next_diff != prev_diff
            if (alarm.difficulty or "").strip().lower() != next_diff:
                alarm.difficulty = next_diff
                db.commit()
                db.refresh(alarm)
    else:
        prev_diff = current_diff
        next_diff = current_diff
        decision = "maintain"
        action = "MAINTAIN"
        reason = "1/2 correct → Difficulty maintained"
        adjusted = False

    return {
        "alarm_id": alarm_id,
        "previous_difficulty": prev_diff,
        "results": results_str,
        "decision": decision,
        "action": action,
        "next_difficulty": next_diff,
        "reason": reason,
        "adjusted": adjusted,
    }