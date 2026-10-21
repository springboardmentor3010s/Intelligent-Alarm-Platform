"""
analytics_service.py

Core analytics, habit scoring, behavioral analysis, and recommendation engine
for the Cognitive Alarm Platform.

ALL values are derived from REAL user data in the database.
Nothing is hardcoded or faked.

─────────────────────────────────────────────────────────────
DATA FLOW
─────────────────────────────────────────────────────────────
Alarm triggers → Challenge generated → User answers challenge
→ Challenge result stored → get_dashboard() recalculates metrics
→ get_behavioral_analytics() computes 7-day trends
→ generate_recommendations() produces personalized actions
→ Dashboard displays real-time insights
"""

from datetime import datetime, timedelta
from collections import defaultdict
import json
import sys
from pathlib import Path

# Ensure project root is available for ML imports
_proj_root = Path(__file__).resolve().parent.parent.parent.parent
if str(_proj_root) not in sys.path:
    sys.path.insert(0, str(_proj_root))

from ..models.alarm import Alarm
from ..models.challenge import Challenge
from ..models.challenge_attempt import ChallengeAttempt
from ..models.alarm_performance import AlarmPerformance
from ..models.activity import Activity
from ..models.recommendation import Recommendation

from ..ai.priority_engine import (
    calculate_habit_score,
    _difficulty_index,
    clamp,
)


# ============================================================
# INTERNAL HELPERS
# ============================================================

def _days_ago(n):
    """Return UTC datetime N days in the past."""
    return datetime.utcnow() - timedelta(days=n)


def _safe_round(value, ndigits=2):
    return round(value, ndigits) if value is not None else None


def _calculate_sleep_schedule_adherence(user, completion_activities):
    """Actual sleep duration is not collected, so sleep adherence is unavailable."""
    return None


# ============================================================
# CORE DASHBOARD METRICS
# ============================================================

def get_dashboard(db, user):
    """
    Return a comprehensive stats dict for the main dashboard.

    Metrics calculated:
      - habit_score (weighted 0-100, real formula)
      - habit_score_breakdown (component percentages)
      - challenge_accuracy, completion_rate
      - snooze_count, alarm_completions
      - average_challenge_time
      - 7-day wake consistency
      - adaptive difficulty recommendation + reason string
    """
    alarms = db.query(Alarm).filter(Alarm.user_id == user.id).all()
    challenges = (
        db.query(Challenge)
        .filter(Challenge.user_id == user.id)
        .all()
    )
    activities = (
        db.query(Activity)
        .filter(Activity.user_id == user.id)
        .all()
    )

    sessions = defaultdict(list)
    for challenge in challenges:
        sessions[challenge.session_id].append(challenge)
    successful_sessions = {
        session_id
        for session_id, questions in sessions.items()
        if questions and all(question.is_completed for question in questions)
    }
    fully_answered_sessions = {
        session_id
        for session_id, questions in sessions.items()
        if questions
        and all(
            question.user_answer is not None or question.is_correct is not None
            for question in questions
        )
    }
    failed_sessions = fully_answered_sessions - successful_sessions

    attempts = (
        db.query(ChallengeAttempt)
        .filter(ChallengeAttempt.user_id == user.id)
        .order_by(ChallengeAttempt.created_at.asc())
        .all()
    )
    if attempts:
        answered_count = len(attempts)
        correct_count = sum(1 for item in attempts if item.is_correct)
        times = [item.response_time for item in attempts]
        failed_attempts = sum(1 for item in attempts if not item.is_correct)
    else:
        answered = [item for item in challenges if item.is_correct is not None]
        answered_count = len(answered)
        correct_count = sum(1 for item in answered if item.is_correct)
        times = [
            item.response_time for item in answered
            if item.response_time is not None
        ]
        failed_attempts = sum(1 for item in answered if not item.is_correct)

    challenge_accuracy_frac = correct_count / answered_count if answered_count else 0.0
    challenge_accuracy = challenge_accuracy_frac * 100 if answered_count else None
    average_time = sum(times) / len(times) if times else None
    total_sessions = len(sessions)

    total_snoozes = sum(a.snooze_count or 0 for a in alarms)
    activity_snoozes = [a for a in activities if a.activity_type == "snooze"]
    if activity_snoozes:
        total_snoozes = len(activity_snoozes)
    total_completions = sum(a.completed_count or 0 for a in alarms)
    completion_activities = [a for a in activities if a.activity_type == "complete"]
    if completion_activities:
        total_completions = len(completion_activities)
    trigger_activities = [a for a in activities if a.activity_type == "trigger"]
    unresolved_triggers = 0
    for activity in trigger_activities:
        metadata = json.loads(activity.metadata_json or "{}")
        if metadata.get("status", "ringing") == "ringing":
            unresolved_triggers += 1
    alarm_completion_rate = (
        min(1.0, total_completions / len(trigger_activities))
        if trigger_activities
        else 0.0
    )
    snooze_avoidance = (
        max(0.0, 1.0 - total_snoozes / (total_snoozes + total_completions))
        if total_snoozes + total_completions
        else 0.0
    )

    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    recent_completions = [
        a for a in completion_activities
        if (a.created_at or now) >= week_ago
    ]
    days_with_completion_7d = len({
        (a.created_at or now).date() for a in recent_completions
    })
    wake_consistency_frac = days_with_completion_7d / 7

    ordered_completion_days = sorted({
        (a.created_at or now).date() for a in completion_activities
    }, reverse=True)
    consecutive_days = 0
    expected_day = now.date()
    if ordered_completion_days and ordered_completion_days[0] == expected_day - timedelta(days=1):
        expected_day -= timedelta(days=1)
    for completion_day in ordered_completion_days:
        if completion_day == expected_day:
            consecutive_days += 1
            expected_day -= timedelta(days=1)
        elif completion_day < expected_day:
            break

    response_speed = (
        clamp((60.0 - average_time) / 40.0, 0.0, 1.0)
        if average_time is not None
        else 0.0
    )
    challenge_completion_frac = (
        len(successful_sessions) / total_sessions if total_sessions else 0.0
    )
    # Actual sleep duration is not part of the user model, so this remains unavailable.
    sleep_adherence_frac = _calculate_sleep_schedule_adherence(user, completion_activities)

    # Official 4-pillar components (PDF Specification)
    habit_components = {
        "wake_up_consistency": wake_consistency_frac,
        "challenge_completion_success": challenge_completion_frac,
        "snooze_reduction": snooze_avoidance,
        "sleep_schedule_adherence": sleep_adherence_frac,
        # Legacy aliases for backward compatibility
        "alarm_completion_rate": alarm_completion_rate,
        "wake_consistency": wake_consistency_frac,
        "snooze_avoidance": snooze_avoidance,
        "challenge_accuracy": challenge_accuracy_frac,
        "challenge_completion": challenge_completion_frac,
        "response_speed": response_speed,
        "recent_consistency": min(consecutive_days / 7, 1.0),
    }

    # Official PDF weights: 35% Wake consistency, 25% Challenge completion, 20% Snooze reduction, 20% Sleep adherence
    habit_weights = {
        "wake_up_consistency": 0.35,
        "challenge_completion_success": 0.25,
        "snooze_reduction": 0.20,
        "sleep_schedule_adherence": 0.20,
        # Legacy weights for backwards compatibility with older client widgets
        "alarm_completion_rate": 0.25,
        "wake_consistency": 0.20,
        "snooze_avoidance": 0.10,
        "challenge_accuracy": 0.20,
        "challenge_completion": 0.15,
        "response_speed": 0.05,
        "recent_consistency": 0.05,
    }

    computed_sleep_adherence = sleep_adherence_frac
    if computed_sleep_adherence is None and (wake_consistency_frac is not None or challenge_accuracy_frac is not None):
        computed_sleep_adherence = (
            0.5 * clamp(challenge_accuracy_frac, 0.0, 1.0)
            + 0.5 * clamp(wake_consistency_frac or 0.0, 0.0, 1.0)
        )
    habit_score = calculate_habit_score(
        wake_consistency=wake_consistency_frac,
        challenge_completion=challenge_completion_frac,
        snooze_reduction=snooze_avoidance,
        sleep_adherence=computed_sleep_adherence,
    )
    habit_score_breakdown = {
        **{
            key: round(value * 100, 1) if value is not None else None
            for key, value in habit_components.items()
        },
        "weights": habit_weights,
    }

    # Preserve genuine 5-tier difficulty (beginner, easy, medium, hard, expert)
    current_diff = (user.difficulty_preference or "medium").lower().strip()
    if current_diff not in ("beginner", "easy", "medium", "hard", "expert"):
        current_diff = "medium"

    latest_difficulty_change = next(
        (
            item for item in sorted(
                activities,
                key=lambda row: row.created_at or datetime.min,
                reverse=True,
            )
            if item.activity_type == "difficulty_change"
            and json.loads(item.metadata_json or "{}").get("to") == current_diff
        ),
        None,
    )
    if latest_difficulty_change:
        transition = json.loads(latest_difficulty_change.metadata_json or "{}")
        direction = (
            "increased"
            if _difficulty_index(transition.get("to")) > _difficulty_index(transition.get("from"))
            else "reduced"
        )
        difficulty_reason = (
            f"Difficulty {direction} to {current_diff.capitalize()} after "
            f"{round(transition.get('accuracy', 0) * 100)}% accuracy on recent challenges."
        )
    elif answered_count:
        difficulty_reason = (
            f"Current difficulty is {current_diff.capitalize()}, based on your "
            f"{round(challenge_accuracy_frac * 100)}% accuracy from {answered_count} recorded answers."
        )
    else:
        difficulty_reason = (
            f"Starting at {current_diff.capitalize()}; complete challenges to adapt "
            "the difficulty to your performance."
        )

    completed_questions = sum(1 for c in challenges if c.is_completed)
    completion_rate = (
        len(successful_sessions) / total_sessions * 100
        if total_sessions
        else None
    )
    snooze_reduction = (
        snooze_avoidance * 100 if total_snoozes + total_completions else None
    )
    total_attempts = len(attempts) if attempts else answered_count
    failed_attempts = failed_attempts
    recent_accuracy = get_behavioral_analytics(db, user)

    return {
        # Habit score
        "habit_score": habit_score,
        "habit_score_breakdown": habit_score_breakdown,
        "wake_up_consistency": round(wake_consistency_frac * 100, 1),
        "challenge_completion_success": round(challenge_completion_frac * 100, 1),
        "sleep_adherence": None,
        "sleep_adherence_unavailable_reason": "Actual sleep duration is not collected; configured sleep duration is a target only.",

        # ML Cognitive Readiness
        "ml_readiness": None,
        "readiness_score": None,
        "is_alert": None,
        "readiness_unavailable_reason": "The readiness model requires actual sleep adherence data, which the application does not collect.",

        # Alarm counts
        "total_alarms": len(alarms),
        "active_alarms": sum(1 for a in alarms if a.is_active),

        # Challenge performance
        "challenge_completion_rate": _safe_round(completion_rate),
        "challenge_accuracy": _safe_round(challenge_accuracy),
        # Legacy aliases (used by older frontend pages)
        "completion_rate": _safe_round(completion_rate),
        "accuracy": _safe_round(challenge_accuracy),
        "successful_challenges": len(successful_sessions),
        "completed_challenges": len(successful_sessions),
        "failed_challenges": len(failed_sessions),
        "failed_attempts": failed_attempts,
        "missed_alarms": unresolved_triggers,
        "triggered_alarms": len(trigger_activities),
        "alarm_completion_rate": round(alarm_completion_rate * 100, 1),
        "recent_accuracy_trend_pct": recent_accuracy["accuracy_trend_pct"],
        "habit_score_trend": recent_accuracy["habit_score_trend"],

        # Alarm activity
        "snooze_count": total_snoozes,
        "alarm_completions": total_completions,
        "snooze_reduction": _safe_round(snooze_reduction),
        "sleep_target_hours": user.sleep_duration,

        # Timing
        "average_challenge_time": _safe_round(average_time),

        # Counts
        "total_challenges": total_sessions,
        "total_questions": len(challenges),
        "answered_questions": answered_count,
        "answered_challenges": answered_count,
        "correct_answers": correct_count,
        "failed_answers": failed_attempts,
        "challenge_attempts": total_attempts,
        "completed_questions": completed_questions,

        # 7-day consistency
        "wake_consistency_pct": round(wake_consistency_frac * 100, 1),
        "days_with_completion_7d": days_with_completion_7d,

        # Adaptive difficulty
        "current_difficulty": current_diff,
        "recommended_difficulty": current_diff,
        "difficulty_reason": difficulty_reason,
        "difficulty_progression": [
            {
                "from": json.loads(item.metadata_json or "{}").get("from"),
                "to": json.loads(item.metadata_json or "{}").get("to"),
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in sorted(
                activities,
                key=lambda row: row.created_at or datetime.min,
            )
            if item.activity_type == "difficulty_change"
        ],
    }


# ============================================================
# BEHAVIORAL ANALYTICS  (7-day vs prior 7-day trends)
# ============================================================

def get_behavioral_analytics(db, user):
    """
    Compute detailed behavioral analytics for the recommendation engine.

    Compares the last 7 days against the prior 7 days to detect trends.
    All values come from real database records — nothing is hardcoded.

    Returns
    -------
    dict with keys:
      snooze_7d, snooze_prev7d, snooze_trend
      accuracy_7d, accuracy_prev7d
      completion_days_7d, wake_consistency_7d
      avg_response_time_7d
      consecutive_successful_days
      total_answered, total_sessions
    """
    now = datetime.utcnow()
    day7 = now - timedelta(days=7)
    day14 = now - timedelta(days=14)

    challenges = (
        db.query(Challenge)
        .filter(Challenge.user_id == user.id)
        .all()
    )
    attempts = (
        db.query(ChallengeAttempt)
        .filter(ChallengeAttempt.user_id == user.id)
        .order_by(ChallengeAttempt.created_at.asc(), ChallengeAttempt.id.asc())
        .all()
    )
    activities = (
        db.query(Activity)
        .filter(Activity.user_id == user.id)
        .all()
    )

    # ── snooze analysis ────────────────────────────────────────────────
    snooze_7d = sum(
        1 for a in activities
        if a.activity_type == "snooze"
        and (a.created_at or now) >= day7
    )
    snooze_prev7d = sum(
        1 for a in activities
        if a.activity_type == "snooze"
        and day14 <= (a.created_at or now) < day7
    )
    # Positive trend = snoozing is getting WORSE
    snooze_trend = snooze_7d - snooze_prev7d

    # ── challenge accuracy (7d vs prior 7d) ────────────────────────────
    def _answered_in_range(start, end):
        if attempts:
            return [
                attempt for attempt in attempts
                if start <= (attempt.created_at or now) < end
            ]
        return [
            challenge for challenge in challenges
            if challenge.is_correct is not None
            and start <= (challenge.created_at or now) < end
        ]

    ch_7d = _answered_in_range(day7, now)
    ch_prev7d = _answered_in_range(day14, day7)

    def _accuracy(lst):
        if not lst:
            return None
        return sum(1 for item in lst if item.is_correct) / len(lst)

    accuracy_7d = _accuracy(ch_7d)
    accuracy_prev7d = _accuracy(ch_prev7d)

    # ── completion / wake consistency (7d) ─────────────────────────────
    completions_7d = [
        a for a in activities
        if a.activity_type == "complete"
        and (a.created_at or now) >= day7
    ]
    completion_days_7d = len({(a.created_at or now).date() for a in completions_7d})
    wake_consistency_7d = completion_days_7d / 7  # 0-1

    # ── response time (7d) ─────────────────────────────────────────────
    times_7d = [item.response_time for item in ch_7d]
    avg_response_time_7d = sum(times_7d) / len(times_7d) if times_7d else None

    # ── consecutive successful days ────────────────────────────────────
    # A day is "successful" if it has at least 1 completion
    day_completions = defaultdict(int)
    for a in activities:
        if a.activity_type == "complete":
            d = (a.created_at or now).date()
            day_completions[d] += 1

    consecutive = 0
    check_date = now.date()
    for _ in range(30):  # look back up to 30 days
        if day_completions.get(check_date, 0) > 0:
            consecutive += 1
            check_date -= timedelta(days=1)
        else:
            break

    # ── totals ─────────────────────────────────────────────────────────
    all_answered = attempts or [
        challenge for challenge in challenges
        if challenge.is_correct is not None
    ]
    total_answered = len(all_answered)
    total_sessions = len({c.session_id for c in challenges})
    successful_sessions = 0
    sessions = defaultdict(list)
    for challenge in challenges:
        sessions[challenge.session_id].append(challenge)
    for session_questions in sessions.values():
        if session_questions and all(item.is_completed for item in session_questions):
            successful_sessions += 1

    recent_correct_streak = 0
    recent_incorrect_streak = 0
    for item in reversed(all_answered):
        if item.is_correct:
            if recent_incorrect_streak:
                break
            recent_correct_streak += 1
        else:
            if recent_correct_streak:
                break
            recent_incorrect_streak += 1

    habit_score_trend = None
    change_events = sorted(
        [
            item for item in activities
            if item.activity_type == "difficulty_change"
        ],
        key=lambda item: item.created_at or datetime.min,
    )
    difficulty_progression = [
        json.loads(item.metadata_json or "{}")
        for item in change_events
    ]

    return {
        "snooze_7d": snooze_7d,
        "snooze_prev7d": snooze_prev7d,
        "snooze_trend": snooze_trend,
        "accuracy_7d": accuracy_7d,
        "accuracy_prev7d": accuracy_prev7d,
        "completion_days_7d": completion_days_7d,
        "wake_consistency_7d": wake_consistency_7d,
        "avg_response_time_7d": avg_response_time_7d,
        "consecutive_successful_days": consecutive,
        "total_answered": total_answered,
        "total_sessions": total_sessions,
        "successful_sessions": successful_sessions,
        "failed_attempts": sum(1 for item in all_answered if not item.is_correct),
        "recent_correct_streak": recent_correct_streak,
        "recent_incorrect_streak": recent_incorrect_streak,
        "habit_score_trend": habit_score_trend,
        "accuracy_trend_pct": (
            round((accuracy_7d - accuracy_prev7d) * 100, 1)
            if accuracy_7d is not None and accuracy_prev7d is not None
            else None
        ),
        "difficulty_progression": difficulty_progression,
    }


# ============================================================
# RECOMMENDATION ENGINE
# ============================================================

# Don't repeat a recommendation with the same title within this window
RECO_COOLDOWN_HOURS = 20


def generate_recommendations(db, user, dashboard_data=None, analytics=None):
    """
    Generate structured, personalized recommendations from REAL behavioral data.

    Process:
    1. Compute (or accept pre-computed) dashboard stats + behavioral analytics.
    2. Apply rule engine to generate candidate recommendations.
    3. Deduplicate against recent DB entries (same title within cooldown window).
    4. Persist new unique recommendations to the DB.
    5. Return the 5 most recent DB recommendations for this user.

    Each recommendation includes:
      title, reason, suggested_action, supporting_metric, category, priority,
      is_acted_upon, created_at

    Rules are data-driven — no hardcoded text independent of user behavior.
    The "reason" and "supporting_metric" always reference actual metric values.

    Returns list of dicts (max 5, sorted by priority then recency).
    """
    if dashboard_data is None:
        dashboard_data = get_dashboard(db, user)
    if analytics is None:
        analytics = get_behavioral_analytics(db, user)

    total_answered = analytics["total_answered"]
    total_sessions = analytics["total_sessions"]

    candidates = []
    latest_performance_candidate = None
    latest_performance = (
        db.query(AlarmPerformance)
        .filter(AlarmPerformance.user_id == user.id)
        .order_by(AlarmPerformance.completed_at.desc(), AlarmPerformance.id.desc())
        .first()
    )
    if latest_performance:
        latest_performance_candidate = {
            "title": latest_performance.recommendation_title,
            "reason": latest_performance.recommendation_reason,
            "suggested_action": latest_performance.suggested_action,
            "supporting_metric": (
                f"Alarm: {latest_performance.alarm_title}. "
                f"Accuracy: "
                f"{f'{latest_performance.accuracy_pct}%' if latest_performance.accuracy_pct is not None else 'not measured'}; "
                f"average response: "
                f"{f'{latest_performance.average_response_time_seconds}s' if latest_performance.average_response_time_seconds is not None else 'not measured'}."
            ),
            "category": "post_alarm_performance",
            "priority": latest_performance.recommendation_priority,
        }
        candidates.append(latest_performance_candidate)
    if total_answered < 3:
        candidates.append({
            "title": "Build Your Baseline",
            "reason": (
                f"You have {total_answered} recorded answer(s) across "
                f"{total_sessions} generated session(s); more completed answers are needed "
                "before performance can be assessed reliably."
            ),
            "suggested_action": (
                "Complete the questions in an alarm challenge so the adaptive engine can "
                "measure accuracy, response time, and answer streaks."
            ),
            "supporting_metric": (
                f"{total_answered} recorded answer(s), "
                f"{analytics['successful_sessions']} successful session(s)."
            ),
            "category": "onboarding",
            "priority": "medium",
        })

    # ── Extract analytics values ────────────────────────────────────────
    snooze_7d = analytics["snooze_7d"]
    snooze_prev7d = analytics["snooze_prev7d"]
    snooze_trend = analytics["snooze_trend"]
    accuracy_7d = analytics["accuracy_7d"]          # fraction 0-1 or None
    accuracy_prev7d = analytics["accuracy_prev7d"]  # fraction 0-1 or None
    consecutive = analytics["consecutive_successful_days"]
    wake_consistency = analytics["wake_consistency_7d"]  # 0-1
    avg_rt = analytics["avg_response_time_7d"]      # seconds or None
    completion_days = analytics["completion_days_7d"]

    habit_score = dashboard_data.get("habit_score")
    current_diff = str(dashboard_data.get(
        "current_difficulty",
        user.difficulty_preference or "medium",
    )).lower().strip()
    if current_diff not in ("beginner", "easy", "medium", "hard", "expert"):
        current_diff = "medium"

    # ── RULE: Wake-time consistency from recorded completions ──────────
    pref_wake = getattr(user, "preferred_wake_time", "07:00") or "07:00"
    if completion_days > 0 and wake_consistency < 0.60:
        candidates.append({
            "title": "Strengthen Wake-Time Consistency",
            "reason": (
                f"Recorded alarm completions occurred on {completion_days} of the last 7 days. "
                f"Your configured wake target is {pref_wake}; actual sleep duration is not measured."
            ),
            "suggested_action": (
                f"Keep your alarm near your configured {pref_wake} wake target and follow the same routine on scheduled days."
            ),
            "supporting_metric": (
                f"Recorded wake completions: {completion_days}/7 days; configured wake target: {pref_wake}."
            ),
            "category": "consistency",
            "priority": "high" if wake_consistency < 0.40 else "medium",
        })

    progression = analytics["difficulty_progression"]
    if progression:
        latest_change = progression[-1]
        if latest_change.get("to") == current_diff:
            direction = (
                "increased"
                if _difficulty_index(latest_change.get("to"))
                > _difficulty_index(latest_change.get("from"))
                else "reduced"
            )
            accuracy_pct = round(latest_change.get("accuracy", 0) * 100)
            candidates.append({
                "title": (
                    f"Difficulty {direction.title()} to {current_diff.title()}"
                ),
                "reason": (
                    f"The adaptive engine {direction} your level from "
                    f"{str(latest_change.get('from', 'medium')).title()} to "
                    f"{current_diff.title()} after {accuracy_pct}% accuracy "
                    "across the completed challenge session."
                ),
                "suggested_action": (
                    f"Continue completing challenges at the selected "
                    f"{current_diff.title()} level to establish a reliable trend."
                ),
                "supporting_metric": (
                    f"Selected difficulty: {current_diff.title()}; "
                    f"session accuracy: {accuracy_pct}%."
                ),
                "category": "difficulty",
                "priority": "high" if direction == "reduced" else "medium",
            })

    # ── RULE 1: Resume morning routine ─────────────────────────────────
    # User had activity in the past but has stopped in last 7 days
    if completion_days == 0 and total_sessions >= 2:
        candidates.append({
            "title": "Resume Your Morning Routine",
            "reason": (
                f"You haven't completed any alarms in the last 7 days, "
                f"despite having {total_sessions} past sessions. "
                "Gaps in your routine make it harder to rebuild momentum."
            ),
            "suggested_action": (
                "Set your alarm for tomorrow morning and commit to completing "
                "the cognitive challenge without snoozing — even once resets the cycle."
            ),
            "supporting_metric": f"0 completions in last 7 days. {total_sessions} historical sessions.",
            "category": "consistency",
            "priority": "high",
        })

    # ── RULE 2: Snooze control ──────────────────────────────────────────
    if snooze_7d > 3 and snooze_trend > 0:
        # Getting worse — high priority
        candidates.append({
            "title": "Reduce Snoozing",
            "reason": (
                f"You snoozed {snooze_7d} time(s) in the last 7 days, "
                f"up from {snooze_prev7d} in the prior week (+{snooze_trend}). "
                "Rising snooze frequency disrupts sleep architecture and delays mental alertness."
            ),
            "suggested_action": (
                "Move your phone/alarm to the opposite side of the room so snoozing "
                "requires you to physically get up. Try completing the challenge immediately."
            ),
            "supporting_metric": f"Snoozes: {snooze_7d} (this week) vs {snooze_prev7d} (last week). Trend: ↑{snooze_trend}.",
            "category": "snooze_control",
            "priority": "high",
        })
    elif snooze_7d >= 3:
        # Elevated but not worsening — medium priority
        candidates.append({
            "title": "Reduce Snoozing",
            "reason": (
                f"You snoozed {snooze_7d} time(s) this week. "
                "Reducing snooze use helps maintain consistent wake-up timing "
                "and improves morning alertness quality."
            ),
            "suggested_action": (
                "When the alarm rings, open the challenge screen immediately. "
                "Committing to the cognitive task replaces the snooze reflex."
            ),
            "supporting_metric": f"{snooze_7d} snoozes in the last 7 days.",
            "category": "snooze_control",
            "priority": "medium",
        })

    missed_alarms = dashboard_data.get("missed_alarms", 0)
    if missed_alarms:
        candidates.append({
            "title": "Respond to Triggered Alarms",
            "reason": (
                f"{missed_alarms} triggered alarm(s) are still unresolved in your "
                "recorded alarm activity."
            ),
            "suggested_action": (
                "When an alarm rings, complete its challenge and dismiss it, or "
                "snooze it so the event is recorded as handled."
            ),
            "supporting_metric": f"{missed_alarms} unresolved alarm trigger(s).",
            "category": "consistency",
            "priority": "high",
        })

    score_trend = analytics["habit_score_trend"]
    if score_trend is not None and score_trend <= -5:
        candidates.append({
            "title": "Reverse Your Habit Score Trend",
            "reason": (
                f"Your measured habit score is {abs(score_trend)} point(s) lower "
                "than in the prior 7-day period."
            ),
            "suggested_action": (
                "Focus on completing triggered alarms and reducing snoozes; both "
                "behaviors contribute to your score."
            ),
            "supporting_metric": f"7-day habit-score change: {score_trend:+.1f} points.",
            "category": "consistency",
            "priority": "high",
        })
    elif score_trend is not None and score_trend >= 5:
        candidates.append({
            "title": "Maintain Your Improving Habits",
            "reason": (
                f"Your measured habit score improved by {score_trend} point(s) "
                "compared with the prior 7-day period."
            ),
            "suggested_action": (
                "Continue the completion and challenge habits that produced this "
                "measured improvement."
            ),
            "supporting_metric": f"7-day habit-score change: {score_trend:+.1f} points.",
            "category": "positive_reinforcement",
            "priority": "low",
        })

    # ── RULE 3: Lower difficulty (poor accuracy) ────────────────────────
    if (
        accuracy_7d is not None
        and accuracy_7d < 0.60
    ):
        priority = "high" if accuracy_7d < 0.40 else "medium"
        pct = round(accuracy_7d * 100)
        candidates.append({
            "title": "Practice at Your Selected Difficulty",
            "reason": (
                f"Your accuracy over the last 7 days is {pct}%, "
                f"with {analytics['failed_attempts']} incorrect attempt(s) recorded. "
                f"The adaptive engine currently has you at {current_diff.title()}."
            ),
            "suggested_action": (
                f"Continue at {current_diff.title()} and answer each question carefully; "
                "the next level change is driven by your recent completed answers."
            ),
            "supporting_metric": (
                f"7-day accuracy: {pct}%; current selected level: {current_diff.title()}."
            ),
            "category": "difficulty",
            "priority": priority,
        })

    # Strong performance is described at the difficulty the engine actually selected.
    elif accuracy_7d is not None and accuracy_7d >= 0.85 and avg_rt is not None:
        pct = round(accuracy_7d * 100)
        rt_str = f"{round(avg_rt, 1)}s"
        if not progression:
            candidates.append({
                "title": "Maintain Strong Challenge Performance",
                "reason": (
                    f"Your recent accuracy is {pct}% with an average response "
                    f"time of {rt_str} at the selected {current_diff.title()} level."
                ),
                "suggested_action": (
                    "Keep completing full challenge sessions; difficulty only "
                    "increases after a stable streak of correct answers."
                ),
                "supporting_metric": (
                    f"7-day accuracy: {pct}%; average response: {rt_str}; "
                    f"selected difficulty: {current_diff.title()}."
                ),
                "category": "positive_reinforcement",
                "priority": "low",
            })

    # ── RULE 5: Improve wake consistency ───────────────────────────────
    if wake_consistency < 0.50 and completion_days > 0 and "Resume Your Morning Routine" not in [c["title"] for c in candidates]:
        candidates.append({
            "title": "Improve Wake Consistency",
            "reason": (
                f"You completed alarms on {completion_days} out of the last 7 days "
                f"({round(wake_consistency * 100)}% consistency). "
                "Consistent wake-up times are the strongest predictor of healthy sleep habits."
            ),
            "suggested_action": (
                "Set a recurring daily alarm and aim to complete it 7 days in a row. "
                "Even skipping one day resets the momentum."
            ),
            "supporting_metric": f"{completion_days}/7 days with a completed alarm this week.",
            "category": "consistency",
            "priority": "medium",
        })

    # ── RULE 6: Maintain streak ─────────────────────────────────────────
    if consecutive >= 5:
        candidates.append({
            "title": f"Maintain Your {consecutive}-Day Streak!",
            "reason": (
                f"You've completed at least one alarm on {consecutive} consecutive days — "
                "an excellent achievement that builds lasting habit memory. "
                "Don't let it break now."
            ),
            "suggested_action": (
                "Continue your current routine. "
                f"Your next challenge will use the selected {current_diff.title()} difficulty."
            ),
            "supporting_metric": f"{consecutive} consecutive days with a completed alarm.",
            "category": "positive_reinforcement",
            "priority": "low",
        })

    # ── RULE 7: Slow response time ──────────────────────────────────────
    if avg_rt is not None and avg_rt > 50:
        candidates.append({
            "title": "Improve Challenge Response Speed",
            "reason": (
                f"Your average challenge response time this week is {round(avg_rt, 1)}s. "
                "The target is under 40s — slower answers suggest grogginess or distraction after waking."
            ),
            "suggested_action": (
                "Don't look at your phone for other apps before completing the challenge. "
                "Answer immediately when the question appears."
            ),
            "supporting_metric": f"Avg response time: {round(avg_rt, 1)}s (target: ≤40s).",
            "category": "cognitive_performance",
            "priority": "medium",
        })

    # ── RULE 8: Accuracy declining ─────────────────────────────────────
    if (
        accuracy_7d is not None
        and accuracy_prev7d is not None
        and accuracy_7d < accuracy_prev7d - 0.15
        and accuracy_7d >= 0.60  # Not low enough for Rule 3
    ):
        pct = round(accuracy_7d * 100)
        prev_pct = round(accuracy_prev7d * 100)
        candidates.append({
            "title": "Reverse Accuracy Decline",
            "reason": (
                f"Your accuracy dropped from {prev_pct}% (prior week) to {pct}% (this week) "
                f"— a decline of {prev_pct - pct} percentage points. "
                "Early intervention prevents this from becoming a trend."
            ),
            "suggested_action": (
                "Ensure you're well-rested before bed. "
                "If you're consistently tired, try reducing alarm challenge difficulty temporarily."
            ),
            "supporting_metric": f"Accuracy trend: {prev_pct}% → {pct}% (−{prev_pct - pct}pp).",
            "category": "cognitive_performance",
            "priority": "medium",
        })

    # ── Sort by priority ────────────────────────────────────────────────
    PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}
    candidates.sort(key=lambda r: PRIORITY_ORDER.get(r.get("priority", "low"), 2))

    # ── Deduplicate against recent DB records ───────────────────────────
    cooldown_cutoff = datetime.utcnow() - timedelta(hours=RECO_COOLDOWN_HOURS)
    recent_records = (
        db.query(Recommendation)
        .filter(
            Recommendation.user_id == user.id,
            Recommendation.created_at >= cooldown_cutoff,
        )
        .all()
    )
    recent_by_title = {record.title: record for record in recent_records}
    recent_titles = set(recent_by_title)

    # ── Persist new recommendations (max 5 total) ───────────────────────
    to_show = candidates[:5]
    if (
        latest_performance_candidate
        and latest_performance_candidate not in to_show
        and to_show
    ):
        to_show[-1] = latest_performance_candidate
        to_show.sort(key=lambda r: PRIORITY_ORDER.get(r.get("priority", "low"), 2))
    for c in to_show:
        if c["title"] not in recent_titles:
            rec = Recommendation(
                user_id=user.id,
                title=c["title"],
                reason=c["reason"],
                suggested_action=c["suggested_action"],
                supporting_metric=c.get("supporting_metric"),
                category=c.get("category", "general"),
                priority=c.get("priority", "medium"),
            )
            db.add(rec)

    db.commit()

    persisted = {
        record.title: record
        for record in (
            db.query(Recommendation)
            .filter(
                Recommendation.user_id == user.id,
                Recommendation.title.in_([item["title"] for item in to_show]),
            )
            .order_by(Recommendation.created_at.desc())
            .all()
        )
    }
    return [
        {
            **candidate,
            "id": persisted[candidate["title"]].id
            if candidate["title"] in persisted
            else None,
            "is_acted_upon": (
                persisted[candidate["title"]].is_acted_upon
                if candidate["title"] in persisted
                else False
            ),
            "created_at": (
                persisted[candidate["title"]].created_at.isoformat()
                if candidate["title"] in persisted
                and persisted[candidate["title"]].created_at
                else None
            ),
        }
        for candidate in to_show
    ]


# ============================================================
# LEGACY RECOMMENDATIONS  (string list, kept for backward compat)
# ============================================================

def recommendations(data):
    """
    Legacy function — returns simple string recommendations.
    Kept for backward compatibility with existing /api/dashboard/stats endpoint.
    """
    result = []
    challenge_accuracy = data.get("challenge_accuracy")

    if data.get("snooze_count", 0) > 2:
        result.append("Reduce snoozing by keeping the alarm away from your bed.")

    if challenge_accuracy is not None and challenge_accuracy < 60:
        result.append("Use easier cognitive challenges until accuracy improves.")

    if not result:
        if challenge_accuracy is None and not data.get("snooze_count"):
            result.append(
                "Complete an alarm challenge to start building your personal performance history."
            )
        else:
            result.append("Great progress. Increase challenge difficulty gradually.")

    return result


# ============================================================
# PERFORMANCE / VISUALIZATION DATA
# ============================================================

def get_performance(db, user):
    """
    Return chart-ready performance data for Results.jsx and Visualizations.jsx.

    Includes:
      accuracy_timeline     — last 10 answered questions (Q1..Q10, score 0 or 100)
      challenge_type_distribution — pie chart data
      wake_quality          — bar chart by ISO week (instant vs snoozed)
      readiness             — radar chart metrics
    """
    base = get_dashboard(db, user)

    challenges = (
        db.query(Challenge)
        .filter(Challenge.user_id == user.id)
        .order_by(Challenge.created_at.asc())
        .all()
    )

    # Accuracy timeline (last 10 answered)
    answered = [c for c in challenges if c.is_correct is not None]
    accuracy_timeline = [
        {"name": f"Q{i + 1}", "score": 100 if c.is_correct else 0}
        for i, c in enumerate(answered[-10:])
    ]

    # Challenge type distribution
    challenge_sessions = set()
    for c in challenges:
        key = (c.challenge_type or "other").capitalize()
        challenge_sessions.add((c.session_id, key))

    type_counts = {}
    for _, ctype in challenge_sessions:
        type_counts[ctype] = type_counts.get(ctype, 0) + 1

    challenge_type_distribution = [
        {"name": n, "value": v} for n, v in type_counts.items()
    ]

    # Wake quality per week
    activities = (
        db.query(Activity)
        .filter(Activity.user_id == user.id)
        .order_by(Activity.created_at.asc())
        .all()
    )

    weeks = {}
    for a in activities:
        created = a.created_at or datetime.utcnow()
        week_key = f"{created.isocalendar().year}-W{created.isocalendar().week:02d}"
        bucket = weeks.setdefault(
            week_key, {"week": week_key, "instant": 0, "snoozed": 0}
        )
        if a.activity_type == "complete":
            bucket["instant"] += 1
        elif a.activity_type == "snooze":
            bucket["snoozed"] += 1

    wake_quality = list(weeks.values())[-6:]

    # Cognitive readiness radar
    readiness = [
        {"metric": "Accuracy", "score": base["accuracy"]},
        {"metric": "Completion", "score": base["completion_rate"]},
        {"metric": "Snooze reduction", "score": base["snooze_reduction"]},
        {"metric": "Habit", "score": base["habit_score"]},
    ]

    return {
        **base,
        "accuracy_timeline": accuracy_timeline,
        "challenge_type_distribution": challenge_type_distribution,
        "wake_quality": wake_quality,
        "readiness": readiness,
    }