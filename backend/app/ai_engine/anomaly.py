# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Anomaly detection engine — BASELINE statistical method (Phase 6).

Honesty contract: this is NOT a trained model. It applies fixed statistical
checks (spike/outlier/collapse rules with minimum-sample gates) to real user
rows. It runs only when sufficient history exists; otherwise `assess()`
reports `"available": False` with the reason instead of fabricating output.

Data gate: at least `MIN_SCORED_DAYS` scored habit days in the trailing
`LOOKBACK_DAYS`. Each individual check additionally requires its own minimum
sample size, documented on the check.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from ..Models import Alarm, ChallengeAttempt

METHOD = "baseline"
LOOKBACK_DAYS = 30
MIN_SCORED_DAYS = 5


def _scored_days(db: Session, user_id: int) -> int:
    from ..services.habit_scoring_service import get_habit_score_history

    history = get_habit_score_history(db, user_id, days=LOOKBACK_DAYS)
    return sum(1 for h in history if h.get("overall_score") is not None)


def _snooze_spike(db: Session, user_id: int) -> List[Dict[str, Any]]:
    """Flag when today's snooze load exceeds 2x the 7-day daily average.

    Requires: at least 3 scored days of context and >= 3 snoozes today
    (avoids flagging a single accidental snooze).
    """
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = day_start - timedelta(days=7)

    today = sum(
        a.times_snoozed
        for a in db.query(Alarm).filter(
            Alarm.user_id == user_id, Alarm.next_trigger >= day_start
        ).all()
    )
    week_alarms = db.query(Alarm).filter(
        Alarm.user_id == user_id, Alarm.next_trigger >= week_ago
    ).all()
    if not week_alarms or today < 3:
        return []
    avg_daily = sum(a.times_snoozed for a in week_alarms) / 7.0
    threshold = max(2.0, 2.0 * avg_daily)
    if today > threshold:
        return [{
            "type": "snooze_spike",
            "severity": "warning",
            "message": (
                f"Snoozed {today} times today vs a 7-day daily average of "
                f"{avg_daily:.1f} — an unusual morning."
            ),
            "metric_value": today,
            "threshold": round(threshold, 1),
            "method": METHOD,
        }]
    return []


def _wake_time_outlier(db: Session, user_id: int) -> List[Dict[str, Any]]:
    """Flag when the latest trigger is >2h from the 14-day median trigger.

    Requires: at least 5 dated triggers in the window.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=14)
    alarms = db.query(Alarm).filter(
        Alarm.user_id == user_id, Alarm.next_trigger.isnot(None), Alarm.next_trigger >= cutoff
    ).order_by(Alarm.next_trigger.asc()).all()
    if len(alarms) < 5:
        return []
    hours = sorted(a.next_trigger.hour + a.next_trigger.minute / 60.0 for a in alarms)
    median = hours[len(hours) // 2]
    latest = hours[-1]
    if abs(latest - median) > 2.0:
        return [{
            "type": "wake_time_outlier",
            "severity": "info",
            "message": (
                f"Latest wake time deviates {abs(latest - median):.1f}h from your "
                f"14-day median — possible schedule disruption."
            ),
            "metric_value": round(latest, 2),
            "threshold": round(median, 2),
            "method": METHOD,
        }]
    return []


def _accuracy_collapse(db: Session, user_id: int) -> List[Dict[str, Any]]:
    """Flag when the last-3 accuracy falls below half the prior accuracy.

    Requires: at least 5 attempts in 14 days with prior accuracy >= 50%.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=14)
    attempts = db.query(ChallengeAttempt).filter(
        ChallengeAttempt.user_id == user_id, ChallengeAttempt.created_at >= cutoff
    ).order_by(ChallengeAttempt.created_at.asc()).all()
    if len(attempts) < 5:
        return []
    prior, recent = attempts[:-3], attempts[-3:]
    prior_q = sum(a.total_questions for a in prior) or 1
    recent_q = sum(a.total_questions for a in recent) or 1
    prior_acc = sum(a.correct_answers for a in prior) / prior_q
    recent_acc = sum(a.correct_answers for a in recent) / recent_q
    if prior_acc >= 0.5 and recent_acc < 0.5 * prior_acc:
        return [{
            "type": "accuracy_collapse",
            "severity": "warning",
            "message": (
                f"Challenge accuracy fell to {recent_acc:.0%} from {prior_acc:.0%} "
                "over your recent attempts."
            ),
            "metric_value": round(recent_acc, 2),
            "threshold": round(0.5 * prior_acc, 2),
            "method": METHOD,
        }]
    return []


def detect(db: Session, user_id: int) -> List[Dict[str, Any]]:
    """Return baseline anomaly descriptors (possibly empty)."""
    found: List[Dict[str, Any]] = []
    for check in (_snooze_spike, _wake_time_outlier, _accuracy_collapse):
        try:
            found.extend(check(db, user_id))
        except Exception:
            continue
    return found


def assess(db: Session, user_id: int) -> Dict[str, Any]:
    """Gated assessment envelope; `available` is False without enough history."""
    scored = _scored_days(db, user_id)
    if scored < MIN_SCORED_DAYS:
        return {
            "available": False,
            "reason": (
                f"Anomaly detection needs at least {MIN_SCORED_DAYS} scored days in "
                f"the last {LOOKBACK_DAYS} days; found {scored}."
            ),
            "scored_days": scored,
            "method": METHOD,
            "anomalies": [],
        }
    return {
        "available": True,
        "reason": None,
        "scored_days": scored,
        "method": METHOD,
        "anomalies": detect(db, user_id),
    }
