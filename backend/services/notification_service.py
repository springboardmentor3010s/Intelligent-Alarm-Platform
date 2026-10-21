from datetime import datetime, date, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException

from Models.notification import Notification, Announcement, CoachMessage
from Models.coach import CoachAssignment, CoachGuidance
from Models.user import User

def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    category: str,
    priority: str = "normal",
    link: Optional[str] = None,
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[int] = None,
    prevent_duplicate: bool = True
) -> Optional[Notification]:
    """
    Creates a stored notification for user_id.
    If prevent_duplicate is True, checks if an identical notification
    was created recently to avoid duplicate event notifications.
    """
    if prevent_duplicate:
        # Check if an identical notification was created today or recently
        query = db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.category == category,
            Notification.title == title,
        )
        if related_entity_type and related_entity_id:
            query = query.filter(
                Notification.related_entity_type == related_entity_type,
                Notification.related_entity_id == related_entity_id
            )
        
        # Check within last 24 hours
        one_day_ago = datetime.utcnow() - timedelta(hours=24)
        query = query.filter(Notification.created_at >= one_day_ago)
        existing = query.first()
        if existing:
            return existing

    valid_priorities = {"normal", "high", "urgent"}
    clean_priority = priority.lower() if priority else "normal"
    if clean_priority not in valid_priorities:
        clean_priority = "normal"

    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        category=category,
        priority=clean_priority,
        link=link,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
        is_read=False,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def notify_admins(
    db: Session,
    title: str,
    message: str,
    category: str = "system",
    priority: str = "normal",
    link: Optional[str] = None,
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[int] = None
):
    """
    Dispatches a notification to all platform administrators.
    """
    admins = db.query(User).filter(User.role == "admin").all()
    for admin in admins:
        create_notification(
            db=db,
            user_id=admin.id,
            title=title,
            message=message,
            category=category,
            priority=priority,
            link=link or "/admin-dashboard",
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
            prevent_duplicate=True
        )


def send_coach_message(
    db: Session,
    coach_id: int,
    user_id: int,
    subject: str,
    body: str,
    message_type: str = "recommendation"
) -> CoachMessage:
    """
    Validates that coach is assigned to user_id, creates CoachMessage,
    syncs CoachGuidance, and dispatches a role-based Notification.
    """
    # Authorization check: Coach must be assigned to this user
    assignment = db.query(CoachAssignment).filter(
        CoachAssignment.coach_id == coach_id,
        CoachAssignment.user_id == user_id
    ).first()

    # Also allow admin to act as supervisor
    coach_user = db.query(User).filter(User.id == coach_id).first()
    is_admin = coach_user and coach_user.role == "admin"

    if not assignment and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Unauthorized: You are not assigned to this user."
        )

    target_user = db.query(User).filter(User.id == user_id, User.role == "user").first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Assigned user not found.")

    coach_name = coach_user.name if coach_user else "Wellness Coach"

    # Store CoachMessage
    msg = CoachMessage(
        coach_id=coach_id,
        user_id=user_id,
        message_type="recommendation",
        subject=subject,
        body=body
    )
    db.add(msg)

    # Maintain backwards compatibility with CoachGuidance
    guidance = CoachGuidance(
        coach_id=coach_id,
        user_id=user_id,
        message=f"[Recommendation: {subject}] {body}"
    )
    db.add(guidance)

    db.commit()
    db.refresh(msg)

    # Create notification for recipient
    notif_title = f"Coach Recommendation: {subject}"
    notif_cat = "coach_recommendation"
    priority = "high"

    create_notification(
        db=db,
        user_id=user_id,
        title=notif_title,
        message=f"Coach {coach_name}: {body}",
        category=notif_cat,
        priority=priority,
        link="/coach-guidance",
        related_entity_type="coach_message",
        related_entity_id=msg.id,
        prevent_duplicate=False
    )

    return msg


def create_announcement_and_notify(
    db: Session,
    sender_id: int,
    title: str,
    message: str,
    recipient_type: str,
    priority: str = "normal",
    recipient_id: Optional[int] = None
) -> Announcement:
    """
    Creates an Announcement record and sends a Notification to every recipient
    in the targeted scope without duplication.
    """
    valid_priorities = {"normal", "high", "urgent"}
    clean_priority = priority.lower() if priority else "normal"
    if clean_priority not in valid_priorities:
        clean_priority = "normal"

    announcement = Announcement(
        sender_id=sender_id,
        title=title,
        message=message,
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        priority=clean_priority
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)

    # Determine recipient user IDs
    recipients: List[User] = []
    if recipient_type == "all":
        recipients = db.query(User).filter(User.role.in_(["user", "wellness_coach", "admin"])).all()
    elif recipient_type == "users":
        recipients = db.query(User).filter(User.role == "user").all()
    elif recipient_type == "coaches":
        recipients = db.query(User).filter(User.role == "wellness_coach").all()
    elif recipient_type == "user" and recipient_id:
        target = db.query(User).filter(User.id == recipient_id, User.role == "user").first()
        if target:
            recipients = [target]
    elif recipient_type == "coach" and recipient_id:
        target = db.query(User).filter(User.id == recipient_id, User.role == "wellness_coach").first()
        if target:
            recipients = [target]

    # Create notification for each recipient
    for recipient in recipients:
        create_notification(
            db=db,
            user_id=recipient.id,
            title=f"Announcement: {title}",
            message=message,
            category="announcement",
            priority=priority,
            link="/dashboard" if recipient.role == "user" else "/coach-dashboard" if recipient.role == "wellness_coach" else "/admin-dashboard",
            related_entity_type="announcement",
            related_entity_id=announcement.id,
            prevent_duplicate=True
        )

    # Admin publication confirmation notification
    create_notification(
        db=db,
        user_id=sender_id,
        title="Announcement Published",
        message=f"Your announcement '{title}' was published to {len(recipients)} recipient(s).",
        category="system",
        priority="normal",
        link="/admin/announcements",
        related_entity_type="announcement",
        related_entity_id=announcement.id,
        prevent_duplicate=True
    )

    return announcement
