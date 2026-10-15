"""
RecommendationEngine — Milestone 3
Rule-based recommendation system. NOT machine learning.

Generates actionable, personalized recommendations based on:
  - Habit score component scores
  - Challenge performance (accuracy, response time, difficulty)
  - Behavioral patterns (snooze, sleep adherence, wakeup consistency)

Each recommendation has:
  - category: which area it addresses
  - priority: HIGH | MEDIUM | LOW
  - title: short headline
  - message: actionable advice
  - metric: the score that triggered this recommendation
"""
from typing import List
from sqlalchemy.orm import Session
from app.services.habit_scoring import calculate_habit_score
from app.services.behavioral_analytics import calculate_challenge_completion
from app.services.adaptive_difficulty import compute_next_difficulty, DIFFICULTY_LEVELS


# Thresholds — configurable
THRESHOLDS = {
    "low_score":        40,   # below this → HIGH priority recommendation
    "medium_score":     70,   # below this → MEDIUM priority
    "high_score":       85,   # above this → positive reinforcement
    "low_accuracy":     50,   # challenge accuracy % below this
    "high_accuracy":    80,   # challenge accuracy % above this
    "high_avg_attempts": 2.5, # avg attempts per challenge above this
    "slow_response":    45,   # avg response seconds above this
}


def _priority(score: float) -> str:
    if score < THRESHOLDS["low_score"]:
        return "HIGH"
    if score < THRESHOLDS["medium_score"]:
        return "MEDIUM"
    return "LOW"


def generate_recommendations(db: Session, user_id: int, days: int = 7) -> dict:
    """
    Generate a list of recommendations for the user.

    Returns:
        {
          "recommendations": [...],
          "habit_score": float,
          "days": int,
          "total": int,
        }
    """
    habit_data = calculate_habit_score(db, user_id, days)
    challenge_data = calculate_challenge_completion(db, user_id, days)
    components = habit_data["components"]

    recs: List[dict] = []

    # ── Wake-Up Consistency ───────────────────────────────────────────────────
    wc_score = components["wakeup_consistency"]["score"]
    wc_detail = components["wakeup_consistency"]["detail"]

    if wc_detail.get("insufficient_data"):
        recs.append({
            "category": "wake_up",
            "priority": "MEDIUM",
            "title": "Start Your Wake-Up Streak",
            "message": "No wake-up sessions recorded yet. Enable an alarm and complete your first cognitive challenge to start tracking your consistency.",
            "metric": None,
        })
    elif wc_score < THRESHOLDS["low_score"]:
        recs.append({
            "category": "wake_up",
            "priority": "HIGH",
            "title": "Wake-Up Consistency Needs Improvement",
            "message": f"Only {wc_detail.get('verified_sessions', 0)} of {wc_detail.get('total_sessions', 0)} wake-up sessions were verified in the last {days} days. Try setting a consistent alarm time and completing the challenge every morning.",
            "metric": wc_score,
        })
    elif wc_score < THRESHOLDS["medium_score"]:
        recs.append({
            "category": "wake_up",
            "priority": "MEDIUM",
            "title": "Improve Wake-Up Consistency",
            "message": f"Your wake-up consistency is {wc_score}%. Aim to verify your wake-up challenge every day to build a stronger habit.",
            "metric": wc_score,
        })
    elif wc_score >= THRESHOLDS["high_score"]:
        recs.append({
            "category": "wake_up",
            "priority": "LOW",
            "title": "Excellent Wake-Up Consistency! 🎉",
            "message": f"You verified {wc_detail.get('verified_sessions', 0)} out of {wc_detail.get('total_sessions', 0)} sessions. Keep it up!",
            "metric": wc_score,
        })

    # ── Challenge Completion ──────────────────────────────────────────────────
    cc_score = components["challenge_completion"]["score"]
    cc_detail = components["challenge_completion"]["detail"]

    if cc_detail.get("insufficient_data"):
        recs.append({
            "category": "challenge",
            "priority": "MEDIUM",
            "title": "Complete Your First Challenge",
            "message": "No challenges completed yet. Trigger an alarm and solve the cognitive challenge to start tracking your performance.",
            "metric": None,
        })
    elif cc_score < THRESHOLDS["low_accuracy"]:
        recs.append({
            "category": "challenge",
            "priority": "HIGH",
            "title": "Challenge Accuracy Is Low",
            "message": f"Your challenge accuracy is {cc_score}%. Consider reducing the difficulty level in your alarm settings to build confidence before increasing it.",
            "metric": cc_score,
        })
    elif cc_detail.get("avg_attempts", 0) > THRESHOLDS["high_avg_attempts"]:
        recs.append({
            "category": "challenge",
            "priority": "MEDIUM",
            "title": "Too Many Attempts Per Challenge",
            "message": f"You're averaging {cc_detail.get('avg_attempts', 0)} attempts per challenge. Try lowering the difficulty or practicing similar problems during the day.",
            "metric": cc_detail.get("avg_attempts"),
        })
    elif cc_detail.get("avg_response_seconds", 0) > THRESHOLDS["slow_response"]:
        recs.append({
            "category": "challenge",
            "priority": "MEDIUM",
            "title": "Response Time Is Slow",
            "message": f"Your average response time is {cc_detail.get('avg_response_seconds', 0)}s. Mental arithmetic practice during the day can help speed up your morning responses.",
            "metric": cc_detail.get("avg_response_seconds"),
        })
    elif cc_score >= THRESHOLDS["high_accuracy"]:
        recs.append({
            "category": "challenge",
            "priority": "LOW",
            "title": "Strong Challenge Performance! 🧠",
            "message": f"You're solving {cc_score}% of challenges correctly. The adaptive system will increase your difficulty to keep you challenged.",
            "metric": cc_score,
        })

    # ── Snooze Reduction ──────────────────────────────────────────────────────
    sr_score = components["snooze_reduction"]["score"]
    sr_detail = components["snooze_reduction"]["detail"]

    if not sr_detail.get("insufficient_data") and sr_score < THRESHOLDS["medium_score"]:
        avg_fails = sr_detail.get("avg_failed_attempts", 0)
        recs.append({
            "category": "snooze",
            "priority": _priority(sr_score),
            "title": "Reduce Failed Verification Attempts",
            "message": f"You're averaging {avg_fails} failed attempts per session. Place your phone away from your bed so you must get up to solve the challenge.",
            "metric": sr_score,
        })
    elif not sr_detail.get("insufficient_data") and sr_score >= THRESHOLDS["high_score"]:
        recs.append({
            "category": "snooze",
            "priority": "LOW",
            "title": "Great Anti-Snooze Discipline! ✅",
            "message": "You're completing most challenges on the first attempt. Excellent morning discipline.",
            "metric": sr_score,
        })

    # ── Sleep Adherence ───────────────────────────────────────────────────────
    sa_score = components["sleep_adherence"]["score"]
    sa_detail = components["sleep_adherence"]["detail"]

    if sa_detail.get("insufficient_data"):
        recs.append({
            "category": "sleep",
            "priority": "LOW",
            "title": "Set Your Preferred Wake-Up Time",
            "message": "Go to Profile and set your preferred wake-up time. This enables sleep schedule adherence tracking.",
            "metric": None,
        })
    elif sa_score < THRESHOLDS["low_score"]:
        dev = sa_detail.get("avg_deviation_minutes", 0)
        recs.append({
            "category": "sleep",
            "priority": "HIGH",
            "title": "Sleep Schedule Is Inconsistent",
            "message": f"Your actual wake-up time deviates {dev} minutes on average from your target. Try going to bed at a consistent time to make waking up easier.",
            "metric": sa_score,
        })
    elif sa_score < THRESHOLDS["medium_score"]:
        recs.append({
            "category": "sleep",
            "priority": "MEDIUM",
            "title": "Improve Sleep Schedule Adherence",
            "message": f"Your sleep adherence score is {sa_score}%. Aim to wake up within 15 minutes of your target time each day.",
            "metric": sa_score,
        })

    # ── Overall Habit Score ───────────────────────────────────────────────────
    habit_score = habit_data["habit_score"]
    if habit_score >= 80 and len([r for r in recs if r["priority"] == "HIGH"]) == 0:
        recs.append({
            "category": "overall",
            "priority": "LOW",
            "title": "Outstanding Habit Score! 🏆",
            "message": f"Your overall habit score is {habit_score}/100. You're demonstrating excellent cognitive wake-up discipline. Keep it up!",
            "metric": habit_score,
        })

    # Sort: HIGH first, then MEDIUM, then LOW
    priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    recs.sort(key=lambda r: priority_order.get(r["priority"], 3))

    return {
        "recommendations": recs,
        "habit_score": habit_score,
        "days": days,
        "total": len(recs),
    }
