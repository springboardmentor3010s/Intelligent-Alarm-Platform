from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.security import get_current_user, require_role
from app.models.models import User
from app.services.report_generator import build_habit_report_excel, build_habit_report_pdf

router = APIRouter(prefix="/reports", tags=["Reports"])


def _resolve_user(current_user: User, user_id: int | None, db: Session) -> User:
    """Return the target user. Admins/coaches can pass user_id to get another user's report."""
    if user_id and user_id != current_user.id:
        if current_user.role not in ("ADMINISTRATOR", "WELLNESS_COACH"):
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Not authorised to view other users' reports")
        target = db.query(User).filter(User.id == user_id).first()
        if not target:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="User not found")
        return target
    return current_user


@router.get("/habit/pdf")
def habit_report_pdf(
    days: int = Query(default=7, ge=1, le=90),
    user_id: int = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = _resolve_user(current_user, user_id, db)
    buffer = build_habit_report_pdf(db, target, days)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=habit_report_{target.name}_{days}d.pdf"},
    )


@router.get("/habit/xlsx")
def habit_report_excel(
    days: int = Query(default=7, ge=1, le=90),
    user_id: int = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = _resolve_user(current_user, user_id, db)
    buffer = build_habit_report_excel(db, target, days)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=habit_report_{target.name}_{days}d.xlsx"},
    )
