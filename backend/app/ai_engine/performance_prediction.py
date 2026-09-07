"""Performance forecasting engine (AI/ML).

PLANNED — declared contract only; not implemented (per §25 nothing is
fabricated). Would forecast near-term engagement/performance trends.
"""

from typing import Any, Dict

from sqlalchemy.orm import Session


def forecast(db: Session, user_id: int) -> Dict[str, Any]:
    """Return {trend, confidence, horizon_days}.

    Planned for a later milestone; raises until wired.
    """
    raise NotImplementedError("Performance forecasting is planned, not yet implemented")
