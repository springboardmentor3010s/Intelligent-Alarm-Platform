"""Performance forecasting engine — BASELINE trend method (Phase 6).

Honesty contract: this is NOT a trained model. It fits an ordinary
least-squares line through the user's scored habit days and extrapolates the
direction — nothing more. It runs only when sufficient time-series data
exists; otherwise the envelope reports `"available": False` with the reason
instead of fabricating a forecast.

Data gate: at least `MIN_SCORED_DAYS` scored days in the trailing
`LOOKBACK_DAYS`. Confidence is derived from sample size and slope magnitude
(high: n>=7 and |slope|>=2 pts/day; medium: n>=5; else low) — a stated
heuristic, not a calibrated probability.
"""

from typing import Any, Dict, List

from sqlalchemy.orm import Session

METHOD = "baseline-linear"
LOOKBACK_DAYS = 30
MIN_SCORED_DAYS = 4
HORIZON_DAYS = 7
STABLE_BAND = 1.5  # |slope| below this (pts/day) counts as stable


def _scored_series(db: Session, user_id: int) -> List[Dict[str, Any]]:
    from ..services.habit_scoring_service import get_habit_score_history

    history = get_habit_score_history(db, user_id, days=LOOKBACK_DAYS)
    # Oldest-first for the regression; keep only real scored days.
    return [h for h in reversed(history) if h.get("overall_score") is not None]


def _least_squares_slope(values: List[float]) -> float:
    n = len(values)
    if n < 2:
        return 0.0
    mean_x = (n - 1) / 2.0
    mean_y = sum(values) / n
    denom = sum((i - mean_x) ** 2 for i in range(n))
    if denom == 0:
        return 0.0
    return sum((i - mean_x) * (y - mean_y) for i, y in enumerate(values)) / denom


def forecast(db: Session, user_id: int) -> Dict[str, Any]:
    """Return the gated forecast envelope."""
    series = _scored_series(db, user_id)
    n = len(series)
    if n < MIN_SCORED_DAYS:
        return {
            "available": False,
            "reason": (
                f"Forecasting needs at least {MIN_SCORED_DAYS} scored days in "
                f"the last {LOOKBACK_DAYS} days; found {n}."
            ),
            "scored_days": n,
            "method": METHOD,
            "trend": None,
            "confidence": None,
            "horizon_days": HORIZON_DAYS,
            "predicted_next_week": None,
        }

    values = [float(h["overall_score"]) for h in series]
    slope = _least_squares_slope(values)
    if slope > STABLE_BAND:
        trend = "improving"
    elif slope < -STABLE_BAND:
        trend = "declining"
    else:
        trend = "stable"

    if n >= 7 and abs(slope) >= 2.0:
        confidence = "high"
    elif n >= 5:
        confidence = "medium"
    else:
        confidence = "low"

    predicted = max(0.0, min(100.0, values[-1] + slope * HORIZON_DAYS))
    return {
        "available": True,
        "reason": None,
        "scored_days": n,
        "method": METHOD,
        "trend": trend,
        "slope_per_day": round(slope, 2),
        "confidence": confidence,
        "horizon_days": HORIZON_DAYS,
        "predicted_next_week": round(predicted, 1),
    }
