"""
notifications.py

FastAPI router for notification operations:
- Retrieve in-app notifications
- Mark individual or all notifications as read
- Delete notifications
- Trigger automated reminder evaluations
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.notification import Notification
from ..schemas.notification import NotificationResponse
from ..services.notification_service import evaluate_and_generate_reminders
from ..utils.deps import get_current_user


router = APIRouter(
    prefix="/api/notifications",
    tags=["Notifications"],
)


@router.get(
    "",
    response_model=list[NotificationResponse],
)
def get_notifications(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Retrieve user notifications ordered chronologically by newest first.
    """
    return (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Get the count of unread notifications for badge rendering.
    """
    count = (
        db.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.is_read == False,
        )
        .count()
    )
    return {"unread_count": count}


@router.put("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Mark a single notification as read.
    """
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    notification.is_read = True
    db.commit()
    return {"message": "Marked as read", "id": notification.id}


@router.put("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Mark all unread notifications for the current user as read.
    """
    updated_count = (
        db.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.is_read == False,
        )
        .update({"is_read": True})
    )
    db.commit()
    return {"message": "All notifications marked as read", "updated_count": updated_count}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Delete a notification.
    """
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    db.delete(notification)
    db.commit()
    return {"message": "Notification deleted successfully"}


@router.post("/generate-reminders")
def trigger_reminder_evaluation(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Evaluate user's sleep targets, upcoming alarms, and streaks to generate proactive notifications.
    """
    new_notifs = evaluate_and_generate_reminders(db, user)
    return {
        "message": f"Generated {len(new_notifs)} reminder(s)",
        "generated": len(new_notifs),
        "generated_count": len(new_notifs),
    }


# ============================================================
# MOBILE INTEGRATION (FCM, Android Alarm Manager, iOS)
# ============================================================

@router.get("/mobile/alarm-intent/{alarm_id}")
def get_mobile_alarm_intent(
    alarm_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Generate Android AlarmManager and iOS Local Notification configurations
    for exact native device scheduling.
    """
    from ..models.alarm import Alarm
    from ..services.notification_service import (
        format_android_alarm_manager_intent,
        format_ios_local_notification_request,
    )

    alarm = db.query(Alarm).filter(Alarm.id == alarm_id, Alarm.user_id == user.id).first()
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")

    android_intent = format_android_alarm_manager_intent(
        alarm_id=alarm.id,
        alarm_time=alarm.alarm_time,
        challenge_type=alarm.challenge_type or "math",
        difficulty=alarm.difficulty or "medium",
    )
    ios_request = format_ios_local_notification_request(
        alarm_id=alarm.id,
        alarm_time=alarm.alarm_time,
        challenge_type=alarm.challenge_type or "math",
        difficulty=alarm.difficulty or "medium",
    )

    return {
        "alarm_id": alarm.id,
        "alarm_time": alarm.alarm_time,
        "android_alarm_manager": android_intent,
        "ios_local_notification": ios_request,
    }


@router.post("/fcm/format-payload")
def format_fcm_push_payload(
    device_token: str,
    title: str = "Cognitive Alarm Alert",
    body: str = "Time to wake up and solve your challenge!",
    user=Depends(get_current_user),
):
    """
    Format standard Firebase Cloud Messaging (FCM HTTP v1) payload for push delivery.
    """
    from ..services.notification_service import format_fcm_payload
    return format_fcm_payload(
        device_token=device_token,
        title=title,
        body=body,
        data={"user_id": str(user.id)},
    )