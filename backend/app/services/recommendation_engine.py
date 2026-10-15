"""
Rule-Based Recommendation Engine for Milestone 3.

Generates deterministic, explainable recommendations across 5 key areas:
1. Sleep Improvement
2. Wake-Up Optimization
3. Habit Improvement
4. Productivity
5. Challenge Recommendation
"""

from typing import Any, Dict, List, Optional


# =====================================================================
# THRESHOLDS & RULE CONFIGURATION
# =====================================================================

THRESHOLD_SNOOZE_ALERT = 70.0          # Below 70% snooze reduction triggers wake-up optimization
THRESHOLD_CONSISTENCY_ALERT = 65.0     # Below 65% triggers consistency guidance
THRESHOLD_CHALLENGE_LOW = 60.0        # Below 60% accuracy triggers difficulty easing recommendation
THRESHOLD_CHALLENGE_HIGH = 85.0       # 85%+ accuracy triggers harder challenge recommendation
THRESHOLD_SLEEP_ADHERENCE_ALERT = 65.0# Below 65% triggers sleep schedule recommendation
THRESHOLD_HABIT_MASTERY = 80.0        # 80%+ overall score triggers productivity advancement
MIN_SESSIONS_FOR_TRENDS = 3           # Minimum sessions before declaring high performance trends


# =====================================================================
# RECOMMENDATION GENERATOR
# =====================================================================

def generate_recommendations(
    habit_score_data: Dict[str, Any],
    recent_sessions: Optional[List[Any]] = None,
    user_profile: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """
    Evaluates behavioral and cognitive metrics against rule thresholds
    to generate actionable, prioritized user recommendations.
    """
    recommendations: List[Dict[str, Any]] = []

    total_sessions = habit_score_data.get("total_sessions", 0)
    w_consistency = habit_score_data.get("wake_up_consistency", 50.0)
    c_completion = habit_score_data.get("challenge_completion", 50.0)
    s_reduction = habit_score_data.get("snooze_reduction", 100.0)
    s_adherence = habit_score_data.get("sleep_schedule_adherence", 50.0)
    overall_score = habit_score_data.get("overall_habit_score", 50.0)
    avg_snooze = habit_score_data.get("avg_snooze_count", 0.0)

    # -----------------------------------------------------------------
    # 1. Onboarding Guidance (Early Usage)
    # -----------------------------------------------------------------
    if total_sessions < MIN_SESSIONS_FOR_TRENDS:
        recommendations.append({
            "category": "habit_improvement",
            "title": "Establish Your Morning Baseline",
            "message": (
                f"You have recorded {total_sessions} alarm session(s). "
                "Complete at least 3 cognitive alarm sessions to unlock full "
                "personalized behavioral patterns and adaptive difficulty."
            ),
            "priority": "medium",
            "supporting_metric": {
                "total_sessions": total_sessions,
                "target": MIN_SESSIONS_FOR_TRENDS,
            },
        })

    # -----------------------------------------------------------------
    # 2. Wake-Up Optimization (Snooze Reduction)
    # -----------------------------------------------------------------
    if s_reduction < THRESHOLD_SNOOZE_ALERT or avg_snooze >= 1.5:
        recommendations.append({
            "category": "wake_up_optimization",
            "title": "Reduce Snoozing to Overcome Sleep Inertia",
            "message": (
                f"Your average snooze count is {avg_snooze} per morning. "
                "Repeated snoozing fragments sleep and increases morning grogginess. "
                "Try moving your alarm device across the room."
            ),
            "priority": "high",
            "supporting_metric": {
                "snooze_reduction_score": s_reduction,
                "avg_snooze_count": avg_snooze,
            },
        })

    # -----------------------------------------------------------------
    # 3. Habit Improvement (Wake-Up Consistency)
    # -----------------------------------------------------------------
    if w_consistency < THRESHOLD_CONSISTENCY_ALERT:
        recommendations.append({
            "category": "habit_improvement",
            "title": "Strengthen Wake-Up Consistency",
            "message": (
                f"Your wake-up consistency score is {w_consistency}%. "
                "Waking up at varying times disrupts your circadian clock. "
                "Aim for a consistent wake-up time within a 15-minute window daily."
            ),
            "priority": "high",
            "supporting_metric": {
                "wake_up_consistency": w_consistency,
                "threshold": THRESHOLD_CONSISTENCY_ALERT,
            },
        })

    # -----------------------------------------------------------------
    # 4. Challenge Recommendation (Cognitive Difficulty Tuning)
    # -----------------------------------------------------------------
    if c_completion < THRESHOLD_CHALLENGE_LOW and total_sessions >= 1:
        recommendations.append({
            "category": "challenge_recommendation",
            "title": "Ease Morning Cognitive Load",
            "message": (
                f"Your challenge completion rate is {c_completion}%. "
                "Morning cognitive puzzles shouldn't feel discouraging. "
                "Consider switching difficulty to 'Beginner' or 'Easy' to rebuild momentum."
            ),
            "priority": "medium",
            "supporting_metric": {
                "challenge_completion": c_completion,
                "threshold": THRESHOLD_CHALLENGE_LOW,
            },
        })
    elif c_completion >= THRESHOLD_CHALLENGE_HIGH and total_sessions >= MIN_SESSIONS_FOR_TRENDS:
        recommendations.append({
            "category": "challenge_recommendation",
            "title": "Step Up Your Cognitive Challenge",
            "message": (
                f"Outstanding! You are solving wake-up challenges with {c_completion}% accuracy. "
                "Consider advancing your puzzle difficulty to 'Hard' or 'Expert' to stimulate sharper executive function."
            ),
            "priority": "low",
            "supporting_metric": {
                "challenge_completion": c_completion,
                "threshold": THRESHOLD_CHALLENGE_HIGH,
            },
        })

    # -----------------------------------------------------------------
    # 5. Sleep Improvement (Schedule Adherence)
    # -----------------------------------------------------------------
    if s_adherence < THRESHOLD_SLEEP_ADHERENCE_ALERT:
        recommendations.append({
            "category": "sleep_improvement",
            "title": "Harmonize Bedtime with Wake Schedule",
            "message": (
                f"Your sleep schedule adherence is {s_adherence}%. "
                "Ensure you target 7 to 8 hours of uninterrupted rest before your scheduled wake-up time."
            ),
            "priority": "medium",
            "supporting_metric": {
                "sleep_schedule_adherence": s_adherence,
                "threshold": THRESHOLD_SLEEP_ADHERENCE_ALERT,
            },
        })

    # -----------------------------------------------------------------
    # 6. Productivity Enhancement (Habit Mastery)
    # -----------------------------------------------------------------
    if overall_score >= THRESHOLD_HABIT_MASTERY and total_sessions >= MIN_SESSIONS_FOR_TRENDS:
        recommendations.append({
            "category": "productivity",
            "title": "Leverage Peak Morning Alertness",
            "message": (
                f"With an overall habit score of {overall_score}/100, your cognitive wake routine is well established. "
                "Use your first 90 minutes post-wake for high-focus deep work."
            ),
            "priority": "low",
            "supporting_metric": {
                "overall_habit_score": overall_score,
            },
        })

    return recommendations
