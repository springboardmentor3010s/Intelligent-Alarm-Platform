"""Administrator portal: user management, coach approvals, platform analytics, recommendation monitoring,
audit log, system health, announcements."""
import time as _time
from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.core.ratelimit import client_ip
from app.core.timeutil import utcnow
from app.models import (Alarm, AuditLog, ChallengeInstance, CoachLink, HabitScore, Recommendation, User, WakeSession)
from app.schemas import AnnouncementIn, AssignIn, RoleIn
from app.services import eventlog, jobs
from app.services.notify import audit, notify

router = APIRouter(prefix="/admin", tags=["Administration"])
admin_only = require_roles("admin")
STARTED = _time.time()


def _active_admins(db: Session) -> int:
    return db.query(User).filter(User.role == "admin", User.is_active.is_(True)).count()


@router.get("/overview")
def overview(_: User = Depends(admin_only), db: Session = Depends(get_db)):
    now = utcnow()
    since = now - timedelta(days=30)
    roles = dict(db.query(User.role, func.count(User.id)).group_by(User.role).all())
    sess = db.query(WakeSession).filter(WakeSession.is_practice.is_(False), WakeSession.started_at >= since,
                                        WakeSession.status.in_(["dismissed", "missed"])).all()
    ok = sum(1 for s in sess if s.status == "dismissed")
    inst = db.query(ChallengeInstance).filter(ChallengeInstance.is_practice.is_(False),
                                              ChallengeInstance.answered_at.isnot(None),
                                              ChallengeInstance.issued_at >= since).all()
    by_diff: dict[str, list] = {}
    for i in inst:
        by_diff.setdefault(i.difficulty, [0, 0])
        by_diff[i.difficulty][0] += 1
        by_diff[i.difficulty][1] += 1 if i.is_correct else 0
    signups: dict[str, int] = {}
    for (d,) in db.query(User.created_at).filter(User.created_at >= since).all():
        signups[d.date().isoformat()] = signups.get(d.date().isoformat(), 0) + 1
    scores = [s for (s,) in db.query(HabitScore.total).filter(HabitScore.score_date >= (now - timedelta(days=14)).date()).all()]
    return {
        "users": {"total": sum(roles.values()), "by_role": roles,
                  "active_7d": db.query(User).filter(User.last_login_at >= now - timedelta(days=7)).count(),
                  "pending_coaches": db.query(User).filter(User.coach_requested.is_(True), User.role == "user").count()},
        "alarms": {"total": db.query(Alarm).count(), "active": db.query(Alarm).filter(Alarm.is_active.is_(True)).count()},
        "wake": {"sessions_30d": len(sess), "success_rate": round(ok / len(sess), 3) if sess else None},
        "challenges": {"attempts_30d": len(inst), "accuracy": round(sum(1 for i in inst if i.is_correct) / len(inst), 3) if inst else None,
                       "by_difficulty": [{"difficulty": k, "attempts": v[0], "accuracy": round(v[1] / v[0], 3)} for k, v in by_diff.items()]},
        "avg_habit_score": round(sum(scores) / len(scores), 1) if scores else None,
        "signups": [{"date": k, "count": v} for k, v in sorted(signups.items())],
    }


@router.get("/users")
def users(q: str = "", role: str = "", limit: int = 25, offset: int = 0, _: User = Depends(admin_only),
          db: Session = Depends(get_db)):
    query = db.query(User)
    if q.strip():
        like = f"%{q.strip().lower()}%"
        query = query.filter(or_(func.lower(User.email).like(like), func.lower(User.full_name).like(like)))
    if role in ("user", "wellness_coach", "admin"):
        query = query.filter(User.role == role)
    total = query.count()
    rows = query.order_by(User.created_at.desc()).offset(max(0, offset)).limit(max(1, min(limit, 100))).all()
    now = utcnow()
    return {"total": total, "items": [{
        "id": str(u.id), "full_name": u.full_name, "email": u.email, "role": u.role, "is_active": u.is_active,
        "locked": bool(u.locked_until and u.locked_until > now), "coach_requested": u.coach_requested,
        "oauth_provider": u.oauth_provider, "created_at": u.created_at, "last_login_at": u.last_login_at} for u in rows]}


def _target(db: Session, uid: UUID) -> User:
    u = db.get(User, uid)
    if not u:
        raise HTTPException(404, "User not found.")
    return u


@router.patch("/users/{uid}/role")
def set_role(uid: UUID, payload: RoleIn, request: Request, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    u = _target(db, uid)
    if u.id == admin.id:
        raise HTTPException(409, "You can't change your own role.")
    if u.role == "admin" and payload.role != "admin" and _active_admins(db) <= 1:
        raise HTTPException(409, "At least one administrator is required.")
    old, u.role = u.role, payload.role
    u.coach_requested = False if payload.role == "wellness_coach" else u.coach_requested
    audit(db, "role_changed", admin, target=u.email, ip=client_ip(request), detail=f"{old} -> {payload.role}")
    db.commit()
    return {"id": str(u.id), "role": u.role}


@router.patch("/users/{uid}/active")
def set_active(uid: UUID, request: Request, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    u = _target(db, uid)
    if u.id == admin.id:
        raise HTTPException(409, "You can't deactivate your own account.")
    if u.role == "admin" and u.is_active and _active_admins(db) <= 1:
        raise HTTPException(409, "At least one active administrator is required.")
    u.is_active = not u.is_active
    audit(db, "account_activated" if u.is_active else "account_deactivated", admin, target=u.email, ip=client_ip(request))
    db.commit()
    return {"id": str(u.id), "is_active": u.is_active}


@router.post("/users/{uid}/unlock")
def unlock(uid: UUID, request: Request, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    u = _target(db, uid)
    u.locked_until, u.failed_logins = None, 0
    audit(db, "account_unlocked", admin, target=u.email, ip=client_ip(request))
    db.commit()
    return {"ok": True}


@router.get("/coach-requests")
def coach_requests(_: User = Depends(admin_only), db: Session = Depends(get_db)):
    rows = db.query(User).filter(User.coach_requested.is_(True), User.role == "user").order_by(User.created_at.asc()).all()
    return [{"id": str(u.id), "full_name": u.full_name, "email": u.email, "created_at": u.created_at} for u in rows]


@router.post("/coach-requests/{uid}/{decision}")
def decide(uid: UUID, decision: str, request: Request, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    if decision not in ("approve", "reject"):
        raise HTTPException(404, "Not found")
    u = _target(db, uid)
    if not u.coach_requested:
        raise HTTPException(409, "No pending coach request.")
    u.coach_requested = False
    if decision == "approve":
        u.role = "wellness_coach"
    notify(db, u.id, "announcement", "Coach application " + ("approved 🎉" if decision == "approve" else "declined"),
           "You can now sign in through the Coach portal." if decision == "approve" else "Your coach application was not approved.")
    audit(db, f"coach_{decision}", admin, target=u.email, ip=client_ip(request))
    db.commit()
    return {"ok": True, "role": u.role}


@router.post("/assign")
def assign(payload: AssignIn, request: Request, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    coach, member = db.get(User, payload.coach_id), db.get(User, payload.member_id)
    if not coach or coach.role != "wellness_coach" or not member or member.id == coach.id:
        raise HTTPException(404, "Coach or member not found.")
    link = db.query(CoachLink).filter(CoachLink.coach_id == coach.id, CoachLink.member_id == member.id).first()
    if link:
        link.status, link.invited_by = "pending", "admin"
    else:
        db.add(CoachLink(coach_id=coach.id, member_id=member.id, status="pending", invited_by="admin"))
    notify(db, member.id, "announcement", "Coaching invitation",
           f"An administrator suggested {coach.full_name} as your wellness coach. Review it in Settings → Coaching.")
    audit(db, "coach_assigned", admin, target=f"{coach.email} -> {member.email}", ip=client_ip(request))
    db.commit()
    return {"ok": True}


@router.get("/recommendations")
def recommendation_monitor(_: User = Depends(admin_only), db: Session = Depends(get_db)):
    agg: dict[str, list] = {}
    for cat, dismissed in db.query(Recommendation.category, Recommendation.is_dismissed).all():
        agg.setdefault(cat, [0, 0])
        agg[cat][0] += 1
        agg[cat][1] += 1 if dismissed else 0
    cats = [(c, v[0], v[1]) for c, v in agg.items()]
    total = db.query(Recommendation).count()
    recent = (db.query(Recommendation, User).join(User, User.id == Recommendation.user_id)
              .order_by(Recommendation.created_at.desc()).limit(15).all())
    return {"total": total,
            "by_category": [{"category": c, "count": n, "dismissed": int(d or 0)} for c, n, d in cats],
            "recent": [{"id": str(r.id), "category": r.category, "title": r.title, "user": u.full_name,
                        "dismissed": r.is_dismissed, "created_at": r.created_at} for r, u in recent]}


@router.get("/audit")
def audit_log(limit: int = 50, offset: int = 0, action: str = "", _: User = Depends(admin_only), db: Session = Depends(get_db)):
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    total = q.count()
    rows = q.order_by(AuditLog.created_at.desc()).offset(max(0, offset)).limit(max(1, min(limit, 200))).all()
    return {"total": total, "items": [{"id": str(a.id), "action": a.action, "actor": a.actor_email, "target": a.target,
                                       "ip": a.ip, "detail": a.detail, "created_at": a.created_at} for a in rows]}


@router.get("/system")
def system(_: User = Depends(admin_only), db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_ok = "ok"
    except Exception:
        db_ok = "unavailable"
    return {"version": "2.0.0", "uptime_seconds": round(_time.time() - STARTED), "database": db_ok,
            "mongodb": eventlog.status(), "scheduler": {"running": jobs._scheduler is not None, **{
                k: v for k, v in jobs.state.items()}}, "server_time": utcnow()}


@router.post("/announcements", status_code=201)
def announce(payload: AnnouncementIn, request: Request, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    n = 0
    for (uid,) in db.query(User.id).filter(User.is_active.is_(True)).all():
        notify(db, uid, "announcement", payload.title.strip(), payload.body.strip())
        n += 1
    audit(db, "announcement", admin, detail=payload.title[:100], ip=client_ip(request))
    db.commit()
    return {"sent_to": n}
