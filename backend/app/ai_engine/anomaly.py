"""Anomaly detection engine (AI/ML).

PLANNED — declared contract only; not implemented (per §25 nothing is
fabricated). Would flag erratic wake times, snooze spikes, and abandonment
patterns from real data.
"""

from typing import Any, Dict, List

from sqlalchemy.orm import Session


def detect(db: Session, user_id: int) -> List[Dict[str, Any]]:
    """Return anomaly descriptors.

    Planned for a later milestone; raises until wired.
    """
    raise NotImplementedError("Anomaly detection is planned, not yet implemented")
