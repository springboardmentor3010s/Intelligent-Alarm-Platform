# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Manual productivity tracking service (Phase 7, FR-BA-003/FR-REP-004).

Provenance contract — every value this module returns is labeled:

- `source: "user-entered"` — daily scores/notes the user typed in. The app
  cannot measure productivity itself, so user entry is the ONLY origin of
  productivity data. No defaults are ever fabricated.
- `source: "inferred"` — the wake-up/productivity correlation, computed from
  paired user-entered scores and real wake-up components. Gated on at least
  `MIN_PAIRED_DAYS` overlapping days; otherwise honestly unavailable.
- `source: "estimated"` — sleep-duration values reused from behavior
  analytics (alarm-gap estimate or explicit preference), shown for context.

Correlation method (Pearson r on paired days, documented heuristic):
available with >= 4 paired days; strength bands |r|>=0.5 strong, >=0.3
moderate, else weak. This is a descriptive statistic, not a causal claim.
"""

from datetime import datetime, timedelta, timezone
from math import sqrt
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..Models import HabitScore, ProductivityLog

SOURCE_USER_ENTERED = "user-entered"
SOURCE_INFERRED = "inferred"
SOURCE_ESTIMATED = "estimated"

MIN_PAIRED_DAYS = 4
MIN_HISTORY_DAYS = 1
MAX_HISTORY_DAYS = 365


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _parse_date(value: Optional[str]) -> str:
    if not value:
        return _today()
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d")
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="date must be YYYY-MM-DD")
    if parsed.date() > datetime.now(timezone.utc).date():
        raise HTTPException(status_code=422, detail="productivity cannot be logged for future dates")
    return parsed.strftime("%Y-%m-%d")


def _payload(row: ProductivityLog) -> dict:
    return {
        "id": row.id,
        "date": row.date,
        "score": row.score,
        "note": row.note,
        "source": SOURCE_USER_ENTERED,
    }


def log_productivity(
    db: Session, user_id: int, score: int, date: Optional[str] = None, note: Optional[str] = None
) -> dict:
    """Upsert one day of user-entered productivity (owner only; route-enforced)."""
    target = _parse_date(date)
    row = db.query(ProductivityLog).filter(
        ProductivityLog.user_id == user_id,
        ProductivityLog.date == target,
    ).first()
    if row is None:
        row = ProductivityLog(user_id=user_id, date=target, score=int(score),
                              note=note, source=SOURCE_USER_ENTERED)
        db.add(row)
    else:
        row.score = int(score)
        row.note = note
    db.commit()
    db.refresh(row)
    return _payload(row)


def get_productivity_history(db: Session, user_id: int, days: int = 7) -> List[dict]:
    """Logged days in the window, most recent first (no fabricated gaps)."""
    try:
        days = int(days)
    except (TypeError, ValueError):
        days = 7
    days = max(MIN_HISTORY_DAYS, min(MAX_HISTORY_DAYS, days))
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    rows = db.query(ProductivityLog).filter(
        ProductivityLog.user_id == user_id,
        ProductivityLog.date >= cutoff,
    ).order_by(ProductivityLog.date.desc()).all()
    return [_payload(r) for r in rows]


def productivity_trend(db: Session, user_id: int, days: int = 14) -> dict:
    """Trend over the user's own logged scores (user-entered series only)."""
    entries = list(reversed(get_productivity_history(db, user_id, days=days)))
    values = [e["score"] for e in entries]
    if len(values) < 2:
        return {
            "available": False,
            "reason": "Log at least 2 days of productivity to see a trend.",
            "source": SOURCE_USER_ENTERED,
            "entries": entries,
            "trend": None,
        }
    slope = _slope(values)
    trend = "improving" if slope > 1.5 else ("declining" if slope < -1.5 else "stable")
    return {
        "available": True,
        "reason": None,
        "source": SOURCE_USER_ENTERED,
        "entries": entries,
        "trend": trend,
        "slope_per_day": round(slope, 2),
        "latest_score": values[-1],
    }


def _slope(values: List[float]) -> float:
    n = len(values)
    mean_x = (n - 1) / 2.0
    mean_y = sum(values) / n
    denom = sum((i - mean_x) ** 2 for i in range(n))
    if denom == 0:
        return 0.0
    return sum((i - mean_x) * (y - mean_y) for i, y in enumerate(values)) / denom


def _pearson(xs: List[float], ys: List[float]) -> Optional[float]:
    n = len(xs)
    if n < 2 or len(ys) != n:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    denom = sqrt(sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys))
    if denom == 0:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / denom


def wake_productivity_correlation(db: Session, user_id: int, days: int = 30) -> dict:
    """Correlate wake-up consistency with user-entered productivity.

    Pairs each logged productivity day with that day's stored habit
    `wake_up_consistency`. Inferred (computed), gated on >= 4 paired days.
    """
    logs = {e["date"]: e["score"] for e in get_productivity_history(db, user_id, days=days)}
    if not logs:
        return {
            "available": False,
            "reason": "No user-entered productivity data yet — log daily scores first.",
            "source": SOURCE_INFERRED,
            "paired_days": 0,
            "correlation": None,
            "strength": None,
        }
    scores = db.query(HabitScore).filter(
        HabitScore.user_id == user_id,
        HabitScore.date.in_(list(logs.keys())),
    ).all()
    paired = [(s.wake_up_consistency, logs[s.date]) for s in scores
              if s.wake_up_consistency is not None]
    if len(paired) < MIN_PAIRED_DAYS:
        return {
            "available": False,
            "reason": (
                f"Correlation needs at least {MIN_PAIRED_DAYS} days with both a "
                f"habit score and a logged productivity score; found {len(paired)}."
            ),
            "source": SOURCE_INFERRED,
            "paired_days": len(paired),
            "correlation": None,
            "strength": None,
        }
    xs = [float(w) for w, _ in paired]
    ys = [float(p) for _, p in paired]
    r = _pearson(xs, ys)
    if r is None:
        return {
            "available": False,
            "reason": "No variance in the paired data — correlation is undefined.",
            "source": SOURCE_INFERRED,
            "paired_days": len(paired),
            "correlation": None,
            "strength": None,
        }
    strength = "strong" if abs(r) >= 0.5 else ("moderate" if abs(r) >= 0.3 else "weak")
    direction = "positive" if r >= 0 else "negative"
    return {
        "available": True,
        "reason": None,
        "source": SOURCE_INFERRED,
        "paired_days": len(paired),
        "correlation": round(r, 3),
        "strength": strength,
        "direction": direction,
        "message": (
            f"{strength} {direction} association (r={r:.2f}) between wake-up "
            f"consistency and self-logged productivity over {len(paired)} days. "
            "Association only — steadier mornings do not prove higher output."
        ),
    }


def productivity_report_records(db: Session, user_id: int, days: int) -> List[Dict[str, Any]]:
    """Export rows for logged productivity days (empty when no real data)."""
    return [
        {
            "date": e["date"],
            "productivity_score": e["score"],
            "note": e["note"] or "",
            "source": e["source"],
        }
        for e in get_productivity_history(db, user_id, days=days)
    ]
