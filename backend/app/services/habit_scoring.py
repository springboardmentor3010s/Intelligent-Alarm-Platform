"""
HabitScoringService — Milestone 3
Official weighted habit score formula:

    Habit Score =
        Wake-Up Consistency   × 0.35  (35%)
      + Challenge Completion  × 0.25  (25%)
      + Snooze Reduction      × 0.20  (20%)
      + Sleep Adherence       × 0.20  (20%)
                              ──────
                              = 100%

Each component is on a 0–100 scale.
Final score is on a 0–100 scale.
All component scores are returned so the calculation is fully explainable.

This is a deterministic, rule-based formula. NOT machine learning.
"""
from sqlalchemy.orm import Session
from app.services.behavioral_analytics import (
    calculate_wakeup_consistency,
    calculate_challenge_completion,
    calculate_snooze_reduction,
    calculate_sleep_adherence,
)

# Official weights — must sum to 1.0
WEIGHTS = {
    "wakeup_consistency":   0.35,
    "challenge_completion": 0.25,
    "snooze_reduction":     0.20,
    "sleep_adherence":      0.20,
}

# Labels for display
WEIGHT_LABELS = {
    "wakeup_consistency":   "Wake-Up Consistency (35%)",
    "challenge_completion": "Challenge Completion (25%)",
    "snooze_reduction":     "Snooze Reduction (20%)",
    "sleep_adherence":      "Sleep Schedule Adherence (20%)",
}


def calculate_habit_score(db: Session, user_id: int, days: int = 7) -> dict:
    """
    Calculate the official habit score with full component breakdown.

    Returns a dict with:
      - habit_score: float (0–100, the weighted total)
      - components: dict of each component score and its weight
      - days: the analysis window used
      - formula: human-readable explanation
      - insufficient_data: True if any component has no data
    """
    wc  = calculate_wakeup_consistency(db, user_id, days)
    cc  = calculate_challenge_completion(db, user_id, days)
    sr  = calculate_snooze_reduction(db, user_id, days)
    sa  = calculate_sleep_adherence(db, user_id, days)

    wc_score = wc["score"]
    cc_score = cc["score"]
    sr_score = sr["score"]
    sa_score = sa["score"]

    habit_score = round(
        wc_score  * WEIGHTS["wakeup_consistency"]
      + cc_score  * WEIGHTS["challenge_completion"]
      + sr_score  * WEIGHTS["snooze_reduction"]
      + sa_score  * WEIGHTS["sleep_adherence"],
        1
    )

    any_insufficient = any([
        wc.get("insufficient_data", False),
        cc.get("insufficient_data", False),
        sa.get("insufficient_data", False),
    ])

    return {
        "habit_score": habit_score,
        "days": days,
        "components": {
            "wakeup_consistency": {
                "score": wc_score,
                "weight": WEIGHTS["wakeup_consistency"],
                "label": WEIGHT_LABELS["wakeup_consistency"],
                "contribution": round(wc_score * WEIGHTS["wakeup_consistency"], 1),
                "detail": wc,
            },
            "challenge_completion": {
                "score": cc_score,
                "weight": WEIGHTS["challenge_completion"],
                "label": WEIGHT_LABELS["challenge_completion"],
                "contribution": round(cc_score * WEIGHTS["challenge_completion"], 1),
                "detail": cc,
            },
            "snooze_reduction": {
                "score": sr_score,
                "weight": WEIGHTS["snooze_reduction"],
                "label": WEIGHT_LABELS["snooze_reduction"],
                "contribution": round(sr_score * WEIGHTS["snooze_reduction"], 1),
                "detail": sr,
            },
            "sleep_adherence": {
                "score": sa_score,
                "weight": WEIGHTS["sleep_adherence"],
                "label": WEIGHT_LABELS["sleep_adherence"],
                "contribution": round(sa_score * WEIGHTS["sleep_adherence"], 1),
                "detail": sa,
            },
        },
        "formula": (
            f"{wc_score} × 0.35  +  {cc_score} × 0.25  +  "
            f"{sr_score} × 0.20  +  {sa_score} × 0.20  =  {habit_score}"
        ),
        "insufficient_data": any_insufficient,
        "weights": WEIGHTS,
    }
