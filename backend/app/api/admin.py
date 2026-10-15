from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.database import get_db
from app.models.models import User, Alarm
from app.core.security import require_role

router = APIRouter(prefix="/admin", tags=["Admin"])

_admin_only = require_role("ADMINISTRATOR")

ALLOWED_ROLES = {"USER", "WELLNESS_COACH", "ADMINISTRATOR"}

class RoleUpdate(BaseModel):
    role: str


@router.get("/users")
def list_users(db: Session = Depends(get_db), _=Depends(_admin_only)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "created_at": u.created_at,
            "alarm_count": len(u.alarms),
        }
        for u in users
    ]


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    body: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin_only),
):
    if body.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail=f"Role must be one of {ALLOWED_ROLES}")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    user.role = body.role
    db.commit()
    return {"id": user.id, "email": user.email, "role": user.role}


@router.get("/stats")
def system_stats(db: Session = Depends(get_db), _=Depends(_admin_only)):
    from app.models.models import CognitiveChallenge, WakeUpSession
    users = db.query(User).all()
    role_counts = {}
    for u in users:
        role_counts[u.role] = role_counts.get(u.role, 0) + 1
    total_alarms = db.query(Alarm).count()
    total_challenges = db.query(CognitiveChallenge).count()
    total_sessions = db.query(WakeUpSession).count()
    verified_sessions = db.query(WakeUpSession).filter(WakeUpSession.status == "WAKE_UP_VERIFIED").count()
    return {
        "total_users": len(users),
        "users_by_role": role_counts,
        "total_alarms": total_alarms,
        "total_challenges": total_challenges,
        "total_sessions": total_sessions,
        "verified_sessions": verified_sessions,
    }
