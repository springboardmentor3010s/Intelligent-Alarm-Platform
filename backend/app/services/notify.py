from sqlalchemy.orm import Session

from app.models import AuditLog, Notification


def notify(db: Session, user_id, kind: str, title: str, body: str, dedupe_key: str | None = None) -> bool:
    """Create an in-app notification. Returns False if a notification with the same dedupe key exists."""
    if dedupe_key:
        exists = db.query(Notification.id).filter(Notification.user_id == user_id,
                                                  Notification.dedupe_key == dedupe_key).first()
        if exists:
            return False
    db.add(Notification(user_id=user_id, kind=kind, title=title[:150], body=body, dedupe_key=dedupe_key))
    db.flush()
    return True


def audit(db: Session, action: str, actor=None, target: str | None = None, ip: str | None = None,
          detail: str | None = None) -> None:
    db.add(AuditLog(actor_id=getattr(actor, "id", None), actor_email=getattr(actor, "email", None),
                    action=action, target=(target or None) and target[:120], ip=ip, detail=(detail or "")[:300] or None))
    db.flush()
