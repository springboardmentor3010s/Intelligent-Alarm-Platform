"""
notification_service.py

Service layer for creating, managing, and automatically evaluating
intelligent notifications and reminders for the Cognitive Alarm Platform.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from ..models.notification import Notification
from ..models.alarm import Alarm
from ..models.activity import Activity


VALID_NOTIFICATION_TYPES = {
    "bedtime_reminder",
    "wake_up_reminder",
    "habit_alert",
    "challenge_reminder",
    "progress_notification",
    "platform_announcement",
    "reminder",  # legacy fallback
}


def create_notification(
    db,
    user_id: int,
    title: str,
    message: str,
    notification_type: str = "reminder",
):
    """
    Persist an in-app notification to the database.
    """
    ntype = notification_type if notification_type in VALID_NOTIFICATION_TYPES else "reminder"
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=ntype,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def evaluate_and_generate_reminders(db, user):
    """
    Evaluate user's sleep targets, alarm schedules, and behavioral streaks
    to generate proactive, timely reminders without spamming duplicates.
    """
    now = datetime.utcnow()
    recent_cutoff = now - timedelta(hours=18)

    recent_types = {
        n.notification_type for n in (
            db.query(Notification)
            .filter(
                Notification.user_id == user.id,
                Notification.created_at >= recent_cutoff,
            )
            .all()
        )
    }

    generated = []

    # 1. Bedtime Reminder (Domain: Sleep Hygiene)
    if "bedtime_reminder" not in recent_types:
        target_sleep = getattr(user, "sleep_duration", 8.0) or 8.0
        pref_wake = getattr(user, "preferred_wake_time", "07:00") or "07:00"
        try:
            whour, wmin = [int(p) for p in str(pref_wake).split(":")[:2]]
            wake_mins = whour * 60 + wmin
            bed_mins = (wake_mins - int(target_sleep * 60)) % 1440
            bhour = bed_mins // 60
            bmin = bed_mins % 60
            bedtime_str = f"{bhour:02d}:{bmin:02d}"
        except Exception:
            bedtime_str = "23:00"

        notif = create_notification(
            db,
            user_id=user.id,
            title="Bedtime Preparation Reminder",
            message=f"To reach your {target_sleep}h sleep goal before your {pref_wake} wake time, aim to start winding down by {bedtime_str}.",
            notification_type="bedtime_reminder",
        )
        generated.append(notif)

    # 2. Challenge & Wake-Up Preparation (Active Alarm Reminder)
    if "wake_up_reminder" not in recent_types:
        active_alarms = db.query(Alarm).filter(Alarm.user_id == user.id, Alarm.is_active == True).all()
        if active_alarms:
            next_alarm = active_alarms[0]
            notif = create_notification(
                db,
                user_id=user.id,
                title="Upcoming Cognitive Challenge Ready",
                message=f"Alarm '{next_alarm.title}' is active for {next_alarm.alarm_time} ({next_alarm.difficulty.capitalize()} {next_alarm.challenge_type.capitalize()} challenge).",
                notification_type="wake_up_reminder",
            )
            generated.append(notif)

    # 3. Habit Alert / Streak Milestone
    if "habit_alert" not in recent_types:
        completions = (
            db.query(Activity)
            .filter(Activity.user_id == user.id, Activity.activity_type == "complete")
            .all()
        )
        if len(completions) >= 3:
            notif = create_notification(
                db,
                user_id=user.id,
                title="Consistency Milestone Reached",
                message=f"You have recorded {len(completions)} successful alarm wake-ups! Keep building momentum.",
                notification_type="habit_alert",
            )
            generated.append(notif)
    return generated


# ============================================================
# MOBILE & CLOUD NOTIFICATION SERVICES
# (Firebase Cloud Messaging, Android Alarm Manager, iOS Local Notifications)
# ============================================================

def format_fcm_payload(
    device_token: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Constructs an official Firebase Cloud Messaging (FCM HTTP v1) push payload.
    """
    payload = {
        "message": {
            "token": device_token,
            "notification": {
                "title": title,
                "body": body,
            },
            "data": {k: str(v) for k, v in (data or {}).items()},
            "android": {
                "priority": "high",
                "notification": {
                    "sound": "alarm_ringtone",
                    "channel_id": "cognitive_alarm_channel",
                    "color": "#1E3A8A",
                },
            },
            "apns": {
                "payload": {
                    "aps": {
                        "sound": "alarm_ringtone.caf",
                        "badge": 1,
                        "category": "COGNITIVE_ALARM_CATEGORY",
                    }
                }
            },
        }
    }
    return payload


def format_android_alarm_manager_intent(
    alarm_id: int,
    alarm_time: str,
    challenge_type: str,
    difficulty: str,
) -> Dict[str, Any]:
    """
    Constructs Android AlarmManager intent configuration for exact wake-up scheduling.
    """
    return {
        "action": "com.cognitivealarm.app.TRIGGER_WAKEUP_ALARM",
        "type": "RTC_WAKEUP",
        "exact": True,
        "alarm_id": alarm_id,
        "alarm_time": alarm_time,
        "challenge_type": challenge_type,
        "difficulty": difficulty,
        "flags": [
            "FLAG_RECEIVER_FOREGROUND",
            "FLAG_INCLUDE_STOPPED_PACKAGES",
        ],
        "vibration_pattern": [0, 500, 250, 500, 250, 1000],
        "wake_lock_timeout_ms": 300000,
    }


def format_ios_local_notification_request(
    alarm_id: int,
    alarm_time: str,
    challenge_type: str,
    difficulty: str,
) -> Dict[str, Any]:
    """
    Constructs iOS UNNotificationRequest dictionary for UserNotifications framework.
    """
    parts = alarm_time.split(":")
    hour = int(parts[0]) if len(parts) > 0 else 7
    minute = int(parts[1]) if len(parts) > 1 else 0

    return {
        "identifier": f"cognitive_alarm_{alarm_id}",
        "content": {
            "title": "Wake Up - Cognitive Challenge Ready!",
            "body": f"Solve your {difficulty.capitalize()} {challenge_type.capitalize()} challenge to dismiss the alarm.",
            "sound": "default_alarm.caf",
            "categoryIdentifier": "COGNITIVE_ALARM_CATEGORY",
            "userInfo": {
                "alarm_id": alarm_id,
                "challenge_type": challenge_type,
                "difficulty": difficulty,
            },
        },
        "trigger": {
            "type": "UNCalendarNotificationTrigger",
            "dateComponents": {
                "hour": hour,
                "minute": minute,
            },
            "repeats": True,
        },
    }