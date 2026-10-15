from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import Announcement, User, UserNotification
from app.schemas.notification import (
    AnnouncementCreate,
    AnnouncementResponse,
    AnnouncementUpdate,
    NotificationResponse,
    NotificationSummaryResponse,
)
from app.services.notification_service import (
    get_bedtime_reminder_data,
    get_challenge_reminders,
    get_habit_alerts,
    get_progress_notifications,
    get_wake_advance_reminders,
    sync_user_notifications,
)
from app.utils.dependencies import get_current_user, require_admin

router = APIRouter(
    prefix="/api/notifications",
    tags=["Notifications"],
)

announcements_router = APIRouter(
    prefix="/api",
    tags=["Announcements"],
)


# =====================================================================
# 1. USER NOTIFICATIONS & DYNAMIC REMINDERS
# =====================================================================

@router.get("", response_model=NotificationSummaryResponse)
def get_user_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns private notifications and active reminders for the authenticated user.
    Synchronizes new dynamic reminders into user_notifications without duplicates.
    """
    notifications = sync_user_notifications(current_user, db)
    unread_count = (
        db.query(UserNotification)
        .filter(UserNotification.user_id == current_user.id, UserNotification.is_read.is_(False))
        .count()
    )

    active_announcements = (
        db.query(Announcement)
        .filter(Announcement.is_active.is_(True))
        .order_by(Announcement.created_at.desc())
        .limit(10)
        .all()
    )

    bedtime = get_bedtime_reminder_data(current_user, db)
    wake_advance = get_wake_advance_reminders(current_user, db)
    habits = get_habit_alerts(current_user, db)
    challenges = get_challenge_reminders(current_user, db)
    progress = get_progress_notifications(current_user, db)

    return NotificationSummaryResponse(
        notifications=[
            NotificationResponse(
                id=n.id,
                user_id=n.user_id,
                category=n.category,
                title=n.title,
                message=n.message,
                priority=n.priority,
                is_read=n.is_read,
                created_at=n.created_at,
            )
            for n in notifications
        ],
        announcements=[
            AnnouncementResponse(
                id=a.id,
                title=a.title,
                message=a.message,
                priority=a.priority,
                is_active=a.is_active,
                created_at=a.created_at,
                created_by=a.created_by,
            )
            for a in active_announcements
        ],
        unread_count=unread_count,
        bedtime_reminder=bedtime,
        advance_wake_reminders=wake_advance,
        habit_alerts=habits,
        challenge_reminders=challenges,
        progress_notifications=progress,
    )


@router.patch("/{notification_id}/read")
def mark_notification_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = (
        db.query(UserNotification)
        .filter(UserNotification.id == notification_id, UserNotification.user_id == current_user.id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()
    db.refresh(notification)

    return {"message": "Notification marked as read", "id": notification.id, "is_read": True}


@router.post("/mark-all-read")
def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(UserNotification).filter(
        UserNotification.user_id == current_user.id,
        UserNotification.is_read.is_(False),
    ).update({"is_read": True}, synchronize_session=False)

    db.commit()
    return {"message": "All notifications marked as read"}


@router.delete("/{notification_id}")
def delete_user_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = (
        db.query(UserNotification)
        .filter(UserNotification.id == notification_id, UserNotification.user_id == current_user.id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(notification)
    db.commit()
    return {"message": "Notification deleted", "id": notification_id}


# =====================================================================
# 2. PUBLIC / USER ANNOUNCEMENTS
# =====================================================================

@announcements_router.get("/announcements", response_model=List[AnnouncementResponse])
def get_public_announcements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns active platform announcements for logged-in users."""
    announcements = (
        db.query(Announcement)
        .filter(Announcement.is_active.is_(True))
        .order_by(Announcement.created_at.desc())
        .all()
    )
    return announcements


# =====================================================================
# 3. ADMINISTRATOR ANNOUNCEMENT MANAGEMENT
# =====================================================================

@announcements_router.get("/admin/announcements", response_model=List[AnnouncementResponse])
def get_admin_announcements(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Administrator access to list all announcements (active and inactive)."""
    return db.query(Announcement).order_by(Announcement.id.desc()).all()


@announcements_router.post("/admin/announcements", response_model=AnnouncementResponse)
def create_admin_announcement(
    data: AnnouncementCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Administrator endpoint to create a new platform announcement."""
    announcement = Announcement(
        title=data.title.strip(),
        message=data.message.strip(),
        priority=data.priority.strip().lower(),
        is_active=data.is_active,
        created_by=current_user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return announcement


@announcements_router.put("/admin/announcements/{announcement_id}", response_model=AnnouncementResponse)
def update_admin_announcement(
    announcement_id: int,
    data: AnnouncementUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")

    if data.title is not None:
        announcement.title = data.title.strip()
    if data.message is not None:
        announcement.message = data.message.strip()
    if data.priority is not None:
        announcement.priority = data.priority.strip().lower()
    if data.is_active is not None:
        announcement.is_active = data.is_active

    db.commit()
    db.refresh(announcement)
    return announcement


@announcements_router.patch("/admin/announcements/{announcement_id}/toggle")
def toggle_admin_announcement(
    announcement_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")

    announcement.is_active = not announcement.is_active
    db.commit()
    db.refresh(announcement)
    return {"message": "Announcement status updated", "id": announcement.id, "is_active": announcement.is_active}


@announcements_router.delete("/admin/announcements/{announcement_id}")
def delete_admin_announcement(
    announcement_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")

    db.delete(announcement)
    db.commit()
    return {"message": "Announcement deleted successfully", "id": announcement_id}
