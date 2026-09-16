"""Dashboard routes for Intelligent Cognitive Alarm Platform.

Thin RBAC-guarded entry points; all aggregation lives in the admin and report
services.
"""

from fastapi import APIRouter, Depends, Query, Request
from fastapi import BackgroundTasks
from sqlalchemy.orm import Session
from uuid import uuid4

from ..database import get_db
from ..Models import User, UserRole
from ..schemas import AdminUserRes, AdminAnalyticsRes
from ..schemas.auth import RoleUpdateReq
from ..api.deps import get_current_user, require_roles, get_or_create_role
from ..services import admin_service, report_service
from ..services.audit_service import log_event
from ..workers import get_job_status, submit_to_background

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Role guards
admin_only = require_roles("Administrator")
staff_only = require_roles("Administrator", "Wellness Coach")


def _dispatch_report(
    builder, db, user_id, days, file_format, report_type, title,
    background_tasks, asynchronous=False,
):
    """Build a report synchronously, or submit it as a background job when async."""
    if not asynchronous or background_tasks is None:
        return report_service.build_report(
            builder, db, user_id, days, file_format, report_type, title
        )

    job_id = uuid4().hex
    submit_to_background(
        background_tasks,
        report_service.build_report,
        job_id,
        builder,
        db,
        user_id,
        days,
        file_format,
        report_type,
        title,
    )
    return {"job_id": job_id, "status": "queued", "endpoint": f"/dashboard/reports/{report_type}?format={file_format}&days={days}"}


@router.get("/reports/status/{job_id}")
def report_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
):
    """Return the status of an async report job."""
    return get_job_status(job_id)


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
    background_tasks: BackgroundTasks = None,
    async_flag: int = Query(0, alias="async"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export habit scores as CSV, JSON, PDF, or Excel for the last N days."""
    return _dispatch_report(
        report_service.habits_report_records, db, current_user.id, days,
        format, "habits", "Habit Score Report", background_tasks, bool(async_flag),
    )


@router.get("/reports/wake-up")
def report_wake_up(
    days: int = Query(7, ge=1, le=365),
    format: str = Query("csv", pattern="^(csv|json|pdf|excel)$"),
    background_tasks: BackgroundTasks = None,
    async_flag: int = Query(0, alias="async"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export wake-up/alarm data as CSV, JSON, PDF, or Excel."""
    return _dispatch_report(
        report_service.wake_up_report_records, db, current_user.id, days,
        format, "wake_up", "Wake-Up Report", background_tasks, bool(async_flag),
    )


@router.get("/reports/challenges")
def report_challenges(
    days: int = Query(7, ge=1, le=365),
    format: str = Query("csv", pattern="^(csv|json|pdf|excel)$"),
    background_tasks: BackgroundTasks = None,
    async_flag: int = Query(0, alias="async"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export challenge attempt data as CSV, JSON, PDF, or Excel."""
    return _dispatch_report(
        report_service.challenges_report_records, db, current_user.id, days,
        format, "challenges", "Challenge Report", background_tasks, bool(async_flag),
    )


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    payload: RoleUpdateReq,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    """Assign a new role to a user (Administrator only).

    Audit-logged so privilege escalation is always traceable.
    """
    target = db.query(User).filter(User.id == user_id).first()
    if target is None:
        from fastapi import HTTPException as _HTTP
        raise _HTTP(status_code=404, detail="User not found")
    if target.id == current_user.id:
        from fastapi import HTTPException as _HTTP
        raise _HTTP(status_code=400, detail="Cannot change your own role")

    # Upsert: ensure only one role per user (replace existing)
    existing_link = db.query(UserRole).filter(UserRole.user_id == user_id).first()
    if existing_link is not None:
        db.delete(existing_link)
        db.flush()

    role = get_or_create_role(db, payload.role)
    db.add(UserRole(user_id=user_id, role_id=role.id))
    log_event(
        db, "role.changed",
        user_id=user_id,
        actor_email=current_user.email,
        ip_address=request.client.host if request.client else None,
        detail={"old_role": "replaced", "new_role": payload.role},
    )
    db.commit()
    db.refresh(target)

    return AdminUserRes(
        id=target.id,
        email=target.email,
        is_active=target.is_active,
        is_verified=target.is_verified,
        created_at=target.created_at,
        last_login=None,
        role=payload.role,
    )
