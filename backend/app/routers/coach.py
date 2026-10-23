"""Wellness Coach portal. A coach only ever sees members who ACCEPTED their invitation."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.core.ratelimit import limit
from app.models import CoachLink, User
from app.routers.insights import rec_view
from app.schemas import InviteIn, MessageIn
from app.services import analytics as A, recommendations as R
from app.services.notify import audit, notify
from app.models import Recommendation

router = APIRouter(prefix="/coach", tags=["Wellness Coach"])
coach_only = require_roles("wellness_coach")


def _active_link(db: Session, coach: User, member_id: UUID) -> CoachLink:
    link = db.query(CoachLink).filter(CoachLink.coach_id == coach.id, CoachLink.member_id == member_id,
                                      CoachLink.status == "active").first()
    if not link:
        raise HTTPException(404, "Member not found or has not shared their data with you.")
    return link


@router.get("/overview")
def overview(coach: User = Depends(coach_only), db: Session = Depends(get_db)):
    links = (db.query(CoachLink, User).join(User, User.id == CoachLink.member_id)
             .filter(CoachLink.coach_id == coach.id, CoachLink.status.in_(["active", "pending"])).all())
    members, pending = [], []
    for link, m in links:
        if link.status == "pending":
            pending.append({"link_id": str(link.id), "full_name": m.full_name, "email": m.email, "invited_at": link.created_at})
            continue
        members.append({"id": str(m.id), "full_name": m.full_name, "email": m.email, "link_id": str(link.id),
                        **A.member_summary(db, m.id)})
    scored = [m["habit_score"] for m in members if m["habit_score"] is not None]
    return {"members": members, "pending": pending,
            "stats": {"members": len(members), "avg_habit_score": round(sum(scored) / len(scored), 1) if scored else None,
                      "needs_attention": sum(1 for m in members if m["habit_score"] is not None and m["habit_score"] < 50)}}


@router.get("/members/{member_id}")
def member_detail(member_id: UUID, coach: User = Depends(coach_only), db: Session = Depends(get_db)):
    _active_link(db, coach, member_id)
    m = db.get(User, member_id)
    p = m.profile
    recs = db.query(Recommendation).filter(Recommendation.user_id == m.id, Recommendation.is_dismissed.is_(False)) \
        .order_by(Recommendation.created_at.desc()).limit(6).all()
    return {
        "member": {"id": str(m.id), "full_name": m.full_name, "email": m.email,
                   "timezone": p.timezone if p else None, "bedtime": p.bedtime.isoformat() if p and p.bedtime else None,
                   "wake_time": p.preferred_wake_time.isoformat() if p and p.preferred_wake_time else None,
                   "goal": p.productivity_goal if p else None, "difficulty": p.current_difficulty if p else None},
        "habit": A.compute_habit_score(db, m.id), "history": A.habit_history(db, m.id, 30),
        "wake": A.wake_stats(db, m.id, 28), "snooze": A.snooze_pattern(db, m.id),
        "challenges": A.challenge_stats(db, m.id, 30), "sleep": A.sleep_stats(db, m.id, 30),
        "productivity": A.productivity_correlation(db, m.id), "recommendations": [rec_view(r) for r in recs],
    }


@router.post("/invite", dependencies=[Depends(limit("invite", 10, 600))])
def invite(payload: InviteIn, coach: User = Depends(coach_only), db: Session = Depends(get_db)):
    msg = {"detail": "If an account with that email exists, an invitation has been sent."}  # no account enumeration
    m = db.query(User).filter(User.email == payload.email.lower(), User.is_active.is_(True)).first()
    if not m or m.id == coach.id:
        return msg
    link = db.query(CoachLink).filter(CoachLink.coach_id == coach.id, CoachLink.member_id == m.id).first()
    if link and link.status in ("active", "pending"):
        return msg
    if link:
        link.status, link.invited_by = "pending", "coach"
    else:
        db.add(CoachLink(coach_id=coach.id, member_id=m.id, status="pending", invited_by="coach"))
    notify(db, m.id, "announcement", "Coaching invitation",
           f"{coach.full_name} invited you to share your progress with them. Review it in Settings → Coaching.")
    db.commit()
    return msg


@router.delete("/links/{link_id}")
def remove_link(link_id: UUID, coach: User = Depends(coach_only), db: Session = Depends(get_db)):
    link = db.query(CoachLink).filter(CoachLink.id == link_id, CoachLink.coach_id == coach.id).first()
    if not link:
        raise HTTPException(404, "Link not found.")
    link.status = "revoked"
    db.commit()
    return {"ok": True}


@router.post("/members/{member_id}/message", dependencies=[Depends(limit("coachmsg", 20, 600))])
def message(member_id: UUID, payload: MessageIn, coach: User = Depends(coach_only), db: Session = Depends(get_db)):
    _active_link(db, coach, member_id)
    notify(db, member_id, "progress", f"Message from {coach.full_name}", payload.message.strip())
    audit(db, "coach_message", coach, target=str(member_id))
    db.commit()
    return {"ok": True}
