from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Notification, User

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _view(n: Notification) -> dict:
    return {"id": str(n.id), "kind": n.kind, "title": n.title, "body": n.body, "is_read": n.is_read, "created_at": n.created_at}


@router.get("")
def list_notifications(unread_only: bool = False, limit: int = 50, offset: int = 0,
                       user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        q = q.filter(Notification.is_read.is_(False))
    items = q.order_by(Notification.created_at.desc()).offset(max(0, offset)).limit(max(1, min(limit, 100))).all()
    unread = db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read.is_(False)).count()
    return {"items": [_view(n) for n in items], "unread": unread}


@router.post("/read-all")
def read_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read.is_(False)) \
        .update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"ok": True}


def _own(db, user, nid):
    n = db.query(Notification).filter(Notification.id == nid, Notification.user_id == user.id).first()
    if not n:
        raise HTTPException(404, "Notification not found.")
    return n


@router.patch("/{nid}/read")
def read(nid: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = _own(db, user, nid)
    n.is_read = True
    db.commit()
    return _view(n)


@router.delete("/{nid}")
def delete(nid: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_own(db, user, nid))
    db.commit()
    return {"ok": True}
