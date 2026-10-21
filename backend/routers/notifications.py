from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime

from database import get_db
from auth import get_current_user, require_role, require_roles
from Models.notification import Notification, Announcement, CoachMessage
from Models.coach import CoachAssignment
from Models.user import User
from services.notification_service import (
    create_notification,
    send_coach_message,
    create_announcement_and_notify
)

router = APIRouter(tags=["Notifications & Messaging"])


# ==========================================
# PYDANTIC SCHEMAS
# ==========================================

class SendCoachMessageRequest(BaseModel):
    recipient_type: str = "single"  # "single" or "all_assigned"
    recipient_id: Optional[int] = None
    message_type: str = "recommendation"  # Strictly coaching recommendation
    subject: str
    body: str

class CreateAnnouncementRequest(BaseModel):
    title: str
    message: str
    recipient_type: str = "all"  # 'all', 'users', 'coaches', 'user', 'coach'
    recipient_id: Optional[int] = None
    priority: str = "normal"  # 'normal', 'high', 'urgent'


# ==========================================
# 1. NOTIFICATIONS ENDPOINTS
# ==========================================

@router.get("/notifications")
def get_notifications(
    filter: Optional[str] = Query("all", pattern="^(all|unread|read)$"),
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get("user_id") or current_user.get("id")
    query = db.query(Notification).filter(Notification.user_id == user_id)

    if filter == "unread":
        query = query.filter(Notification.is_read == False)
    elif filter == "read":
        query = query.filter(Notification.is_read == True)

    if category:
        query = query.filter(Notification.category == category)

    notifications = query.order_by(Notification.created_at.desc()).all()

    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "category": n.category,
            "priority": n.priority,
            "is_read": n.is_read,
            "link": n.link,
            "related_entity_type": n.related_entity_type,
            "related_entity_id": n.related_entity_id,
            "created_at": (n.created_at.isoformat() + "Z") if n.created_at else None
        }
        for n in notifications
    ]


@router.get("/notifications/unread-count")
def get_unread_count(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get("user_id") or current_user.get("id")
    count = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False
    ).count()
    return {"unread_count": count}


@router.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get("user_id") or current_user.get("id")
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user_id
    ).first()

    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    db.commit()
    return {"message": "Notification marked as read", "id": notification_id}


@router.patch("/notifications/read-all")
def mark_all_read(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get("user_id") or current_user.get("id")
    updated = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False
    ).update({"is_read": True})

    db.commit()
    return {"message": "All notifications marked as read", "count": updated}


# ==========================================
# 2. COACH MESSAGING ENDPOINTS
# ==========================================

@router.post("/messages")
def send_message(
    req: SendCoachMessageRequest,
    current_user: dict = Depends(require_roles(["wellness_coach", "admin"])),
    db: Session = Depends(get_db)
):
    coach_id = current_user.get("user_id") or current_user.get("id")
    is_admin = current_user.get("role") == "admin"

    subject = req.subject.strip()
    body = req.body.strip()
    if not subject:
        raise HTTPException(status_code=422, detail="Subject cannot be empty")
    if not body:
        raise HTTPException(status_code=422, detail="Message body cannot be empty")

    created_messages = []

    if req.recipient_type == "all_assigned":
        # Get all users assigned to this coach
        if is_admin:
            # If admin calls all_assigned, all users are recipients
            assignments = db.query(CoachAssignment).all()
            assigned_user_ids = list(set([a.user_id for a in assignments]))
        else:
            assignments = db.query(CoachAssignment).filter(CoachAssignment.coach_id == coach_id).all()
            assigned_user_ids = [a.user_id for a in assignments]

        if not assigned_user_ids:
            raise HTTPException(
                status_code=400,
                detail="No users are currently assigned to you."
            )

        for uid in assigned_user_ids:
            msg = send_coach_message(
                db=db,
                coach_id=coach_id,
                user_id=uid,
                subject=subject,
                body=body,
                message_type=req.message_type
            )
            created_messages.append(msg.id)

        return {
            "message": f"Coaching recommendation sent to {len(created_messages)} assigned client(s)",
            "message_ids": created_messages
        }

    else:
        # Single recipient
        if not req.recipient_id:
            raise HTTPException(status_code=422, detail="Recipient user must be selected")

        msg = send_coach_message(
            db=db,
            coach_id=coach_id,
            user_id=req.recipient_id,
            subject=subject,
            body=body,
            message_type="recommendation"
        )

        return {
            "message": "Coaching recommendation sent successfully",
            "id": msg.id,
            "created_at": (msg.created_at.isoformat() + "Z") if msg.created_at else None
        }


@router.get("/messages/sent")
def get_sent_messages(
    current_user: dict = Depends(require_roles(["wellness_coach", "admin"])),
    db: Session = Depends(get_db)
):
    coach_id = current_user.get("user_id") or current_user.get("id")
    messages = db.query(CoachMessage).filter(CoachMessage.coach_id == coach_id).order_by(CoachMessage.created_at.desc()).all()

    result = []
    for m in messages:
        client = db.query(User).filter(User.id == m.user_id).first()
        result.append({
            "id": m.id,
            "coach_id": m.coach_id,
            "user_id": m.user_id,
            "recipient_name": client.name if client else f"User #{m.user_id}",
            "recipient_email": client.email if client else "",
            "message_type": m.message_type,
            "subject": m.subject,
            "body": m.body,
            "created_at": (m.created_at.isoformat() + "Z") if m.created_at else None
        })
    return result


@router.get("/messages/received")
def get_received_messages(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get("user_id") or current_user.get("id")
    messages = db.query(CoachMessage).filter(CoachMessage.user_id == user_id).order_by(CoachMessage.created_at.desc()).all()

    result = []
    for m in messages:
        coach = db.query(User).filter(User.id == m.coach_id).first()
        result.append({
            "id": m.id,
            "coach_id": m.coach_id,
            "coach_name": coach.name if coach else f"Coach #{m.coach_id}",
            "coach_email": coach.email if coach else "",
            "message_type": m.message_type,
            "subject": m.subject,
            "body": m.body,
            "created_at": (m.created_at.isoformat() + "Z") if m.created_at else None
        })
    return result


# ==========================================
# 3. ADMIN ANNOUNCEMENTS ENDPOINTS
# ==========================================

@router.post("/announcements")
def create_announcement(
    req: CreateAnnouncementRequest,
    current_user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    admin_id = current_user.get("user_id") or current_user.get("id")

    title = req.title.strip()
    message = req.message.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Announcement title cannot be empty")
    if not message:
        raise HTTPException(status_code=422, detail="Announcement message cannot be empty")

    valid_types = ["all", "users", "coaches", "user", "coach"]
    if req.recipient_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid recipient type. Must be one of {valid_types}")

    if req.recipient_type in ["user", "coach"] and not req.recipient_id:
        raise HTTPException(status_code=422, detail="Specific recipient ID is required for this recipient type")

    valid_priorities = ["normal", "high", "urgent"]
    clean_priority = (req.priority or "normal").lower()
    if clean_priority not in valid_priorities:
        clean_priority = "normal"

    announcement = create_announcement_and_notify(
        db=db,
        sender_id=admin_id,
        title=title,
        message=message,
        recipient_type=req.recipient_type,
        priority=clean_priority,
        recipient_id=req.recipient_id
    )

    return {
        "message": "Announcement published successfully",
        "id": announcement.id,
        "title": announcement.title,
        "recipient_type": announcement.recipient_type,
        "created_at": announcement.created_at.isoformat() if announcement.created_at else None
    }


@router.get("/announcements")
def get_announcements(
    current_user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    announcements = db.query(Announcement).order_by(Announcement.created_at.desc()).all()

    result = []
    for a in announcements:
        # Calculate delivery and read stats from actual stored notifications
        notifs = db.query(Notification).filter(
            Notification.related_entity_type == "announcement",
            Notification.related_entity_id == a.id,
            Notification.category == "announcement"
        ).all()

        total_delivered = len(notifs)
        total_read = sum(1 for n in notifs if n.is_read)
        read_rate = round((total_read / total_delivered * 100), 1) if total_delivered > 0 else 0.0

        sender = db.query(User).filter(User.id == a.sender_id).first()
        target_user = None
        if a.recipient_id:
            target_user = db.query(User).filter(User.id == a.recipient_id).first()

        scope_label = {
            "all": "All Platform Users",
            "users": "All Users",
            "coaches": "All Wellness Coaches",
            "user": f"Single User ({target_user.name if target_user else f'#{a.recipient_id}'})",
            "coach": f"Single Coach ({target_user.name if target_user else f'#{a.recipient_id}'})"
        }.get(a.recipient_type, a.recipient_type)

        result.append({
            "id": a.id,
            "title": a.title,
            "message": a.message,
            "recipient_type": a.recipient_type,
            "recipient_id": a.recipient_id,
            "recipient_label": scope_label,
            "priority": a.priority,
            "sender_name": sender.name if sender else "Admin",
            "created_at": (a.created_at.isoformat() + "Z") if a.created_at else None,
            "stats": {
                "delivered": total_delivered,
                "read": total_read,
                "read_rate": read_rate
            }
        })

    return result


@router.get("/announcements/{announcement_id}")
def get_announcement_detail(
    announcement_id: int,
    current_user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")

    sender = db.query(User).filter(User.id == announcement.sender_id).first()

    # Get detailed recipient delivery list
    notifs = db.query(Notification).filter(
        Notification.related_entity_type == "announcement",
        Notification.related_entity_id == announcement.id,
        Notification.category == "announcement"
    ).all()

    recipient_details = []
    for n in notifs:
        u = db.query(User).filter(User.id == n.user_id).first()
        if u:
            recipient_details.append({
                "user_id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "is_read": n.is_read
            })

    total_delivered = len(notifs)
    total_read = sum(1 for n in notifs if n.is_read)

    return {
        "id": announcement.id,
        "title": announcement.title,
        "message": announcement.message,
        "recipient_type": announcement.recipient_type,
        "recipient_id": announcement.recipient_id,
        "priority": announcement.priority,
        "sender_name": sender.name if sender else "Admin",
        "created_at": (announcement.created_at.isoformat() + "Z") if announcement.created_at else None,
        "stats": {
            "delivered": total_delivered,
            "read": total_read,
            "read_rate": round((total_read / total_delivered * 100), 1) if total_delivered > 0 else 0.0
        },
        "recipients": recipient_details
    }


@router.delete("/announcements/{announcement_id}")
def delete_announcement(
    announcement_id: int,
    current_user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")

    # Clean up associated notifications
    db.query(Notification).filter(
        Notification.related_entity_type == "announcement",
        Notification.related_entity_id == announcement.id
    ).delete(synchronize_session=False)

    db.delete(announcement)
    db.commit()
    return {"message": "Announcement deleted successfully"}
