# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
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
from ..schemas import AdminUserRes, AdminAnalyticsRes, CoachAssignmentReq, CoachAssignmentRes
from ..schemas.auth import RoleUpdateReq
from ..api.deps import get_current_user, require_roles, get_or_create_role
from ..services import admin_service, coach_service, report_service
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
    """List visible users.

    Administrators see everyone; Wellness Coaches see only users assigned to
    their cohort (scope enforced server-side, never client-side).
    """
    if coach_service.is_admin(db, current_user.id):
        return admin_service.list_users(db)
    return coach_service.list_cohort_users(db, current_user.id)


@router.get("/coach/assignments", response_model=list[CoachAssignmentRes])
def list_coach_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    """List every coach-to-user cohort assignment (Administrator only)."""
    return coach_service.list_assignments(db)


@router.post("/coach/assignments", response_model=CoachAssignmentRes, status_code=201)
def assign_cohort_user(
    payload: CoachAssignmentReq,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    """Assign a user to a wellness coach's cohort (Administrator only)."""
    row = coach_service.assign_user(db, payload.coach_id, payload.user_id)
    return row


@router.delete("/coach/assignments")
def unassign_cohort_user(
    coach_id: int = Query(..., ge=1),
    user_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only),
):
    """Remove a user from a coach's cohort (Administrator only)."""
    coach_service.unassign_user(db, coach_id, user_id)
    return {"removed": True}


@router.get("/coach/users", response_model=list[AdminUserRes])
def list_cohort_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(staff_only),
):
    """Cohort roster: coaches see their assigned users, admins see everyone."""
    return coach_service.list_cohort_users(db, current_user.id)


@router.get("/coach/users/{user_id}", response_model=dict)
def get_cohort_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(staff_only),
):
    """Scoped per-user coaching view (habit adherence, sleep trend, challenge
    performance, progress). Coaches outside the assignment scope get 403."""
    return coach_service.get_cohort_user_detail(db, current_user.id, user_id)


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


@router.get("/reports/sleep")
def report_sleep(
    days: int = Query(7, ge=1, le=365),
    format: str = Query("csv", pattern="^(csv|json|pdf|excel)$"),
    background_tasks: BackgroundTasks = None,
    async_flag: int = Query(0, alias="async"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export sleep analytics (FR-REP-005): bedtime/wake-time trend + duration.

    Contains only days with a derivable overnight alarm window; honest-empty for
    accounts without consecutive-day alarms.
    """
    return _dispatch_report(
        report_service.sleep_report_records, db, current_user.id, days,
        format, "sleep", "Sleep Report", background_tasks, bool(async_flag),
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


@router.get("/reports/productivity")
def report_productivity(
    days: int = Query(7, ge=1, le=365),
    format: str = Query("csv", pattern="^(csv|json|pdf|excel)$"),
    background_tasks: BackgroundTasks = None,
    async_flag: int = Query(0, alias="async"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export user-entered productivity logs (FR-REP-004).

    Contains only days the user actually logged; empty accounts export an
    honest empty file, never fabricated scores.
    """
    return _dispatch_report(
        report_service.productivity_report_records, db, current_user.id, days,
        format, "productivity", "Productivity Report", background_tasks, bool(async_flag),
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
