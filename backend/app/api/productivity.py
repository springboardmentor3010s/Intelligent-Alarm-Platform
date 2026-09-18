# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Productivity routes (Phase 7, FR-BA-003).

The app cannot measure productivity, so every productivity datum originates
from explicit user entry (`POST /productivity/log`). Correlations are
computed (inferred) and gated; nothing is fabricated for empty accounts.
All routes are owner-scoped: users see only their own logs.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..Models import User
from ..api.deps import get_current_user
from ..schemas import ProductivityLogReq, ProductivityLogRes
from ..services import productivity_service

router = APIRouter(prefix="/productivity", tags=["productivity"])


@router.post("/log", response_model=ProductivityLogRes, status_code=201)
def log_productivity(
    payload: ProductivityLogReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log (or overwrite) one day of self-assessed productivity, 0-100.

    `source` is always `"user-entered"`. Same-day resubmission overwrites
    (upsert) so a day never holds two conflicting scores.
    """
    return productivity_service.log_productivity(
        db, current_user.id, payload.score, payload.date, payload.note
    )


@router.get("/log", response_model=ProductivityLogRes)
def get_log(
    date: str = Query(None, description="YYYY-MM-DD; defaults to today (UTC)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Read one day's user-entered log (404 when the day was never logged)."""
    from fastapi import HTTPException

    target = productivity_service._parse_date(date)
    row = productivity_service.get_productivity_history(db, current_user.id, days=365)
    for entry in row:
        if entry["date"] == target:
            return entry
    raise HTTPException(status_code=404, detail="No productivity log for this date")


@router.get("/history", response_model=list)
def get_history(
    days: int = Query(7, ge=1, le=365, description="Lookback window in days"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Logged productivity days, most recent first (logged days only)."""
    return productivity_service.get_productivity_history(db, current_user.id, days=days)


@router.get("/trend", response_model=dict)
def get_trend(
    days: int = Query(14, ge=1, le=365, description="Lookback window in days"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trend over the user's own logged scores (`available:false` under 2 logs)."""
    return productivity_service.productivity_trend(db, current_user.id, days=days)


@router.get("/correlation", response_model=dict)
def get_correlation(
    days: int = Query(30, ge=1, le=365, description="Lookback window in days"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Wake-up consistency vs productivity correlation (inferred, gated).

    `available:false` with a reason until >= 4 paired days exist. The message
    states association-only; no causal claim is made.
    """
    return productivity_service.wake_productivity_correlation(db, current_user.id, days=days)
