"""The signed-in user's own account: profile, password, coach sharing, deletion."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.ratelimit import client_ip, limit
from app.core.security import hash_password, hash_token, password_problem, verify_password
from app.core.timeutil import utcnow
from app.models import (LEVELS, Alarm, ChallengeInstance, CoachLink, HabitScore, Notification, RefreshToken,
                        Recommendation, SleepLog, User, UserProfile, WakeSession)
from app.routers.auth import COOKIE, clear_refresh_cookie
from app.schemas import DeleteAccountIn, NameIn, PasswordChangeIn, ProfileIn
from app.services.notify import audit, notify
from app.views import profile_view, user_view

router = APIRouter(prefix="/users", tags=["Account"])


class RespondIn(BaseModel):
    accept: bool


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_view(user)


@router.patch("/me/name")
def rename(payload: NameIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.full_name = " ".join(payload.full_name.split())
    db.commit()
    return user_view(user)


@router.put("/me/profile")
def save_profile(payload: ProfileIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = user.profile or UserProfile(user_id=user.id)
    p.preferred_wake_time, p.bedtime = payload.preferred_wake_time, payload.bedtime
    p.sleep_duration_minutes, p.timezone = payload.sleep_duration_minutes, payload.timezone
    p.productivity_goal, p.wake_goal_streak = payload.productivity_goal, payload.wake_goal_streak
    p.difficulty_preference = payload.difficulty_preference
    if payload.difficulty_preference in LEVELS:
        p.current_difficulty = payload.difficulty_preference
    p.preferred_challenge_types = ",".join(payload.preferred_challenge_types)
    p.bedtime_reminders, p.browser_notifications = payload.bedtime_reminders, payload.browser_notifications
    p.onboarded = True
    db.add(p)
    db.commit()
    db.refresh(user)
    return profile_view(user.profile)


@router.post("/me/password", dependencies=[Depends(limit("pwchange", 5, 600))])
def change_password(payload: PasswordChangeIn, request: Request, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    if user.hashed_password and not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(400, "Your current password is incorrect.")
    problem = password_problem(payload.new_password)
    if problem:
        raise HTTPException(422, problem)
    user.hashed_password = hash_password(payload.new_password)
    keep = hash_token(request.cookies.get(COOKIE, ""))
    for t in db.query(RefreshToken).filter(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)):
        if t.token_hash != keep:
            t.revoked_at = utcnow()  # sign out every other device
    audit(db, "password_changed", user, ip=client_ip(request))
    db.commit()
    return {"ok": True}


def delete_user_data(db: Session, user: User) -> None:
    uid = user.id
    for model in (ChallengeInstance, WakeSession, Alarm, SleepLog, HabitScore, Recommendation, Notification,
                  RefreshToken, UserProfile):
        db.query(model).filter(model.user_id == uid).delete(synchronize_session=False)
    db.query(CoachLink).filter(or_(CoachLink.coach_id == uid, CoachLink.member_id == uid)).delete(synchronize_session=False)
    db.delete(user)


@router.delete("/me", dependencies=[Depends(limit("delete", 3, 600))])
def delete_me(payload: DeleteAccountIn, request: Request, response: Response, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    if user.hashed_password and not verify_password(payload.password, user.hashed_password):
        raise HTTPException(400, "Password is incorrect.")
    if user.role == "admin" and db.query(User).filter(User.role == "admin", User.is_active.is_(True)).count() <= 1:
        raise HTTPException(409, "You are the only administrator. Promote another admin before deleting this account.")
    audit(db, "account_deleted", user, ip=client_ip(request))
    delete_user_data(db, user)
    db.commit()
    clear_refresh_cookie(response)
    return {"ok": True}


# ---- coach sharing (consent) ----
@router.get("/me/coach-links")
def my_coach_links(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (db.query(CoachLink, User).join(User, User.id == CoachLink.coach_id)
            .filter(CoachLink.member_id == user.id, CoachLink.status.in_(["pending", "active"])).all())
    return [{"id": str(l.id), "status": l.status, "coach_name": c.full_name, "coach_email": c.email,
             "invited_by": l.invited_by, "created_at": l.created_at} for l, c in rows]


@router.post("/me/coach-links/{link_id}/respond")
def respond(link_id: UUID, payload: RespondIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    link = db.query(CoachLink).filter(CoachLink.id == link_id, CoachLink.member_id == user.id,
                                      CoachLink.status == "pending").first()
    if not link:
        raise HTTPException(404, "Invitation not found.")
    link.status = "active" if payload.accept else "declined"
    notify(db, link.coach_id, "progress", "Invitation " + ("accepted" if payload.accept else "declined"),
           f"{user.full_name} {'accepted' if payload.accept else 'declined'} your coaching invitation.")
    db.commit()
    return {"status": link.status}


@router.delete("/me/coach-links/{link_id}")
def revoke(link_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    link = db.query(CoachLink).filter(CoachLink.id == link_id, CoachLink.member_id == user.id).first()
    if not link:
        raise HTTPException(404, "Link not found.")
    link.status = "revoked"
    db.commit()
    return {"status": "revoked"}
