"""Personalized recommendation engine (Milestone 3, FR-RE-001..004).

Rule-based recommendations generated from real analytics data:
  - Sleep improvement suggestions (FR-RE-001): 15-min bedtime/wake adjustments.
  - Wake-up optimization (FR-RE-002): optimal wake time + challenge anchor type.
  - Habit improvement guidance (FR-RE-003): behavioural thresholds crossed
    (e.g. "snooze count increased X% this week").
  - Challenge recommendations (FR-RE-004): unattempted types / difficulty
    progression based on accuracy history.
"""

import itertools
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from ..Models import Alarm, Challenge, ChallengeAttempt, User
from .analytics_service import (
    compute_sleep_duration_avg,
    compute_streak_length,
    compute_wake_up_consistency_trend,
)

RECOMMENDED_SLEEP_MIN = 7.0
RECOMMENDED_SLEEP_MAX = 9.0


def _snooze_counts(db: Session, user_id: int) -> int:
    """Total snoozes across all the user's alarms."""
    return sum(
        a.times_snoozed for a in db.query(Alarm).filter(Alarm.user_id == user_id).all()
    )


def _attempt_matrix(db: Session, user_id: int) -> dict:
    """Aggregate attempt stats: type accuracy, difficulty accuracy, unattempted types, avg time."""
    recent = (
        db.query(ChallengeAttempt)
        .filter(ChallengeAttempt.user_id == user_id)
        .all()
    )
    challenges = {
        c.id: c for c in db.query(Challenge).filter(Challenge.is_active == True).all()
    }

    type_stats: dict = {}
    diff_stats: dict = {}
    attempted_types = set()
    for a in recent:
        ch = challenges.get(a.challenge_id)
        key = ch.challenge_type if ch else "Unknown"
        dkey = ch.difficulty if ch else "Unknown"
        attempted_types.add(key)
        if a.total_questions and a.total_questions > 0:
            acc = a.correct_answers / a.total_questions
            t = type_stats.setdefault(key, {"attempts": 0, "correct": 0.0, "total": 0, "times": []})
            t["attempts"] += 1
            t["correct"] += a.correct_answers
            t["total"] += a.total_questions
            if a.time_taken_seconds:
                t["times"].append(a.time_taken_seconds)
            d = diff_stats.setdefault(dkey, {"attempts": 0, "correct": 0.0, "total": 0})
            d["attempts"] += 1
            d["correct"] += a.correct_answers
            d["total"] += a.total_questions

    all_types = {c.challenge_type for c in challenges.values()}
    return {
        "type_stats": type_stats,
        "attempted_types": attempted_types,
        "unattempted_types": sorted(all_types - attempted_types),
        "diff_stats": diff_stats,
    }


def generate_recommendations(db: Session, user_id: int) -> list:
    """Return a priority-ordered list of personalized recommendations (max 6)."""
    now = datetime.now(timezone.utc)
    user = db.get(User, user_id)
    settings = user.settings or {} if user else {}

    recs = []
    idx = itertools.count(1)

    # --- FR-RE-001: Sleep improvement (15-min adjustments) ---
    avg_sleep = compute_sleep_duration_avg(db, user_id)
    pref_minutes = settings.get("sleep_duration_minutes")
    if avg_sleep and avg_sleep < RECOMMENDED_SLEEP_MIN:
        recs.append({
            "id": next(idx),
            "category": "sleep",
            "priority": "high",
            "title": "You're running low on sleep",
            "message": (
                f"Your estimated sleep window is about {avg_sleep:.1f}h, below the "
                f"recommended {RECOMMENDED_SLEEP_MIN:.0f}-{RECOMMENDED_SLEEP_MAX:.0f}h."
            ),
            "suggested_action": (
                f"Move your latest wake-up alarm 15 minutes later (or set an earlier "
                f"bedtime by 15 minutes) and keep the schedule for a week."
            ),
            "metrics": {"sleep_duration_avg": round(avg_sleep, 1), "target_range": [RECOMMENDED_SLEEP_MIN, RECOMMENDED_SLEEP_MAX]},
        })
    elif avg_sleep and avg_sleep > RECOMMENDED_SLEEP_MAX:
        recs.append({
            "id": next(idx),
            "category": "sleep",
            "priority": "medium",
            "title": "Possible oversleeping pattern",
            "message": (
                f"Your estimated sleep window is about {avg_sleep:.1f}h, above the "
                f"recommended {RECOMMENDED_SLEEP_MIN:.0f}-{RECOMMENDED_SLEEP_MAX:.0f}h."
            ),
            "suggested_action": "Consider setting an earlier wake-up alarm in 15-minute steps to right-size your sleep.",
            "metrics": {"sleep_duration_avg": round(avg_sleep, 1), "target_range": [RECOMMENDED_SLEEP_MIN, RECOMMENDED_SLEEP_MAX]},
        })
    elif avg_sleep and pref_minutes and abs(avg_sleep - pref_minutes / 60.0) >= 1.0:
        recs.append({
            "id": next(idx),
            "category": "sleep",
            "priority": "low",
            "title": "Align sleep with your target",
            "message": (
                f"Your target sleep is {pref_minutes / 60.0:.1f}h but you're averaging "
                f"{avg_sleep:.1f}h."
            ),
            "suggested_action": "Shift your bedtime 15 minutes to close the gap toward your target.",
            "metrics": {"sleep_duration_avg": round(avg_sleep, 1), "sleep_preference_minutes": pref_minutes},
        })

    # --- FR-RE-002: Wake-up optimization ---
    snoozes = _snooze_counts(db, user_id)
    trend = compute_wake_up_consistency_trend(db, user_id, 14)
    matrix = _attempt_matrix(db, user_id)
    worst_type = None
    if matrix["type_stats"]:
        per_type_acc = {
            t: s["correct"] / s["total"] for t, s in matrix["type_stats"].items() if s["total"]
        }
        if per_type_acc:
            worst_type = min(per_type_acc, key=per_type_acc.get)
    if snoozes >= 3:
        anchor = worst_type or "Math"
        recs.append({
            "id": next(idx),
            "category": "wake_up",
            "priority": "high",
            "title": "Snoozing is fragmenting your morning",
            "message": f"You've snoozed {snoozes} time(s) across your alarms.",
            "suggested_action": (
                f"Keep your primer alarm but add a {anchor} challenge at your current "
                f"difficulty level — it gives your brain a concrete task to wake into."
            ),
            "metrics": {"total_snoozes": snoozes, "suggested_challenge_type": anchor},
        })
    elif trend == "declining":
        recs.append({
            "id": next(idx),
            "category": "wake_up",
            "priority": "medium",
            "title": "Wake-up consistency is slipping",
            "message": "Your wake-up consistency has been trending downward over the last two weeks.",
            "suggested_action": "Re-cue a fixed wake time and complete challenges within 2 minutes of the alarm to rebuild the habit.",
            "metrics": {"wake_up_consistency_trend": trend},
        })

    # --- FR-RE-003: Habit improvement guidance (behavioural thresholds) ---
    # Week-over-week snooze comparison.
    cutoff_prev = (now - timedelta(days=14)).replace(tzinfo=None)
    cutoff_cur = (now - timedelta(days=7)).replace(tzinfo=None)
    prev_attempts = db.query(ChallengeAttempt).filter(
        ChallengeAttempt.user_id == user_id,
        ChallengeAttempt.created_at >= cutoff_prev,
        ChallengeAttempt.created_at < cutoff_cur,
    ).all()
    cur_attempts = db.query(ChallengeAttempt).filter(
        ChallengeAttempt.user_id == user_id,
        ChallengeAttempt.created_at >= cutoff_cur,
    ).all()

    prev_rate = sum(1 for a in prev_attempts if a.completed) / len(prev_attempts) if prev_attempts else None
    cur_rate = sum(1 for a in cur_attempts if a.completed) / len(cur_attempts) if cur_attempts else None
    streak = compute_streak_length(db, user_id)

    if prev_rate is not None and cur_rate is not None and prev_rate > 0:
        pct_change = int(round((cur_rate - prev_rate) / prev_rate * 100.0))
        if pct_change >= 20:
            recs.append({
                "id": next(idx),
                "category": "habit",
                "priority": "high",
                "title": "Challenge completion improved",
                "message": f"Your challenge completion rate rose {pct_change}% versus last week.",
                "suggested_action": "Keep the momentum — try one extra challenge type this week.",
                "metrics": {"completion_change_pct": pct_change},
            })
    if streak >= 3:
        recs.append({
            "id": next(idx),
            "category": "habit",
            "priority": "low",
            "title": "Streak going strong",
            "message": f"You have {streak} consecutive completed challenge(s) in a row.",
            "suggested_action": "Protect your streak by completing today's challenge before dismissing the alarm.",
            "metrics": {"current_streak": streak},
        })

    # --- FR-RE-004: Personalized challenge recommendations ---
    if matrix["unattempted_types"]:
        recs.append({
            "id": next(idx),
            "category": "challenge",
            "priority": "medium",
            "title": "Try a new challenge type",
            "message": f"You haven't attempted: {', '.join(matrix['unattempted_types'])}.",
            "suggested_action": (
                f"Book your next alarm with a {matrix['unattempted_types'][0]} challenge "
                f"to broaden the cognitive workout."
            ),
            "metrics": {"unattempted_types": matrix["unattempted_types"]},
        })
    else:
        diff_stats = matrix["diff_stats"]
        struggling = [
            d for d, s in diff_stats.items()
            if s["total"] and (s["correct"] / s["total"]) < 0.6
        ]
        if struggling:
            recs.append({
                "id": next(idx),
                "category": "challenge",
                "priority": "medium",
                "title": "Reinforce a weak difficulty level",
                "message": f"Accuracy is below 60% at {', '.join(sorted(struggling))} difficulty.",
                "suggested_action": f"Dial the difficulty back to train at {struggling[0]} before stepping up.",
                "metrics": {"low_accuracy_difficulties": sorted(struggling)},
            })
        elif diff_stats:
            mastered = [
                d for d, s in diff_stats.items()
                if s["total"] and (s["correct"] / s["total"]) >= 0.8
            ]
            if mastered:
                recs.append({
                    "id": next(idx),
                    "category": "challenge",
                    "priority": "low",
                    "title": "Ready to level up",
                    "message": f"You're consistently scoring 80%+ at {', '.join(sorted(mastered))} difficulty.",
                    "suggested_action": "Increase difficulty one notch to keep the workouts challenging.",
                    "metrics": {"mastered_difficulties": sorted(mastered)},
                })

    # Cap at 6 and order by priority.
    priority_order = {"high": 0, "medium": 1, "low": 2}
    recs.sort(key=lambda r: (priority_order.get(r["priority"], 1), r["id"]))
    return recs[:6]