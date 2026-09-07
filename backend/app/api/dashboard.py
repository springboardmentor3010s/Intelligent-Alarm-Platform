"""Dashboard routes for Intelligent Cognitive Alarm Platform.

Thin RBAC-guarded entry points; all aggregation lives in the admin and report
services.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime

from ..database import get_db
from ..Models import User
from ..schemas import AdminUserRes, AdminAnalyticsRes
from ..api.deps import get_current_user, require_roles
from ..services import admin_service, report_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Role guards
admin_only = require_roles("Administrator")
staff_only = require_roles("Administrator", "Wellness Coach")


@router.get("/users", response_model=list[AdminUserRes])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(staff_only),
):
    """List all users (Admin/Wellness Coach only)."""
    return admin_service.list_users(db)


@router.get("/analytics", response_model=AdminAnalyticsRes)
def platform_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    """Platform-wide analytics (Admin only)."""
    return admin_service.platform_analytics(db)


@router.get("/reports/habits")
def report_habits(
    days: int = Query(7, ge=1, le=365),
    format: str = Query("csv", pattern="^(csv|json|pdf|excel)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export habit scores as CSV, JSON, PDF, or Excel for the last N days."""
    today = datetime.utcnow().date()
    records = report_service.habits_report_records(db, current_user.id, days)
    return report_service.report_response(
        records, format, f"habit_report_{today}", "Habit Score Report", "habits", days
    )


@router.get("/reports/wake-up")
def report_wake_up(
    days: int = Query(7, ge=1, le=365),
    format: str = Query("csv", pattern="^(csv|json|pdf|excel)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export wake-up/alarm data as CSV, JSON, PDF, or Excel."""
    today = datetime.utcnow().date()
    records = report_service.wake_up_report_records(db, current_user.id, days)
    return report_service.report_response(
        records, format, f"wake_up_report_{today}", "Wake-Up Report", "wake_up", days
    )


@router.get("/reports/challenges")
def report_challenges(
    days: int = Query(7, ge=1, le=365),
    format: str = Query("csv", pattern="^(csv|json|pdf|excel)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export challenge attempt data as CSV, JSON, PDF, or Excel."""
    today = datetime.utcnow().date()
    records = report_service.challenges_report_records(db, current_user.id, days)
    return report_service.report_response(
        records, format, f"challenge_report_{today}", "Challenge Report", "challenges", days
    )
