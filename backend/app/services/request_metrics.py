"""In-memory API timing store (resets when the server restarts)."""
from __future__ import annotations

import threading
from collections import defaultdict, deque
from datetime import datetime, timezone

_MAX_SAMPLES = 5000
_lock = threading.Lock()
_samples: deque = deque(maxlen=_MAX_SAMPLES)

CHALLENGE_GENERATION_KEY = "POST /challenges/generate"


def record(key: str, duration_ms: float, status: int) -> None:
    with _lock:
        _samples.append(
            (datetime.now(timezone.utc), key, duration_ms, status)
        )


def _percentile(sorted_values: list[float], pct: float) -> float:
    if not sorted_values:
        return 0.0
    index = min(
        len(sorted_values) - 1,
        max(0, round(pct / 100 * (len(sorted_values) - 1))),
    )
    return sorted_values[index]


def _summarize(values: list[float], errors: int) -> dict:
    ordered = sorted(values)
    return {
        "count": len(ordered),
        "avg_ms": round(sum(ordered) / len(ordered), 1),
        "p50_ms": round(_percentile(ordered, 50), 1),
        "p95_ms": round(_percentile(ordered, 95), 1),
        "max_ms": round(ordered[-1], 1),
        "error_count": errors,
    }


def snapshot(start: datetime, end: datetime) -> dict:
    with _lock:
        rows = [r for r in _samples if start <= r[0] < end]

    if not rows:
        return {
            "available": False,
            "reason": (
                "No API requests have been timed in this period. "
                "Timings are held in memory and reset on restart."
            ),
        }

    grouped: dict[str, list[float]] = defaultdict(list)
    errors: dict[str, int] = defaultdict(int)
    for _, key, ms, status in rows:
        grouped[key].append(ms)
        if status >= 500:
            errors[key] += 1

    all_values = [r[2] for r in rows]
    routes = [
        {"route": key, **_summarize(vals, errors[key])}
        for key, vals in grouped.items()
    ]
    routes.sort(key=lambda r: r["p95_ms"], reverse=True)

    generation = grouped.get(CHALLENGE_GENERATION_KEY)
    return {
        "available": True,
        "overall": _summarize(
            all_values, sum(errors.values())
        ),
        "routes": routes[:15],
        "challenge_generation": (
            _summarize(
                generation, errors[CHALLENGE_GENERATION_KEY]
            )
            if generation
            else None
        ),
        "note": (
            "Challenge generation latency is the full request time "
            "of POST /challenges/generate, including the database write."
        ),
    }
