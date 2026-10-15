"""
Alarm Trigger Service
Handles timezone-aware, duplicate-protected alarm trigger calculations
for the Intelligent Cognitive Alarm Platform.
"""

from datetime import datetime, timezone, time, date, timedelta
from typing import Any, Dict, List, Optional
import zoneinfo
import logging
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import (
    Alarm,
    AlarmSession,
    User,
    UserNotification,
    UserProfile,
)

logger = logging.getLogger("app.services.alarm_trigger")


def get_user_timezone(user: User, db: Session, client_tz: Optional[str] = None) -> zoneinfo.ZoneInfo:
    """
    Retrieves the user's configured timezone from UserProfile.
    If unconfigured, checks client_tz and persists it to UserProfile.
    Falls back safely to UTC if invalid or unconfigured.
    """
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if profile and profile.time_zone:
        try:
            return zoneinfo.ZoneInfo(profile.time_zone)
        except Exception as e:
            logger.warning(
                f"Invalid timezone '{profile.time_zone}' for user {user.id}, checking fallback: {e}"
            )

    # Use client timezone if supplied and valid
    if client_tz and isinstance(client_tz, str) and client_tz.strip():
        tz_str = client_tz.strip()
        try:
            parsed_tz = zoneinfo.ZoneInfo(tz_str)
            # Auto-persist to user profile so future checks and background jobs know user's timezone
            if profile:
                if not profile.time_zone:
                    profile.time_zone = tz_str
                    db.commit()
            else:
                new_profile = UserProfile(user_id=user.id, time_zone=tz_str)
                db.add(new_profile)
                db.commit()
            return parsed_tz
        except Exception as tz_err:
            logger.warning(f"Invalid client_tz '{tz_str}': {tz_err}")

    return zoneinfo.ZoneInfo("UTC")


def get_current_time_in_user_tz(user: User, db: Session, client_tz: Optional[str] = None) -> datetime:
    """Returns the current datetime localized to the user's timezone."""
    tz = get_user_timezone(user, db, client_tz=client_tz)
    return datetime.now(tz)


def is_alarm_scheduled_for_today(alarm: Alarm, user_now: datetime) -> bool:
    """
    Evaluates whether a recurring or custom alarm is scheduled to run on the current weekday.
    - daily: runs every day
    - weekly / custom: checks repeat_pattern (e.g. 'Mon,Tue,Wed', 'weekdays', 'weekends')
    """
    alarm_type = (alarm.alarm_type or "daily").strip().lower()
    
    if alarm_type == "daily":
        return True
    
    repeat_pattern = (alarm.repeat_pattern or "").strip().lower()
    if not repeat_pattern:
        # Defaults to daily if no pattern specified
        return True

    # Weekday mapping: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
    weekday_idx = user_now.weekday()
    weekday_short = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][weekday_idx]
    weekday_full = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][weekday_idx]

    if "weekdays" in repeat_pattern and weekday_idx < 5:
        return True
    if "weekends" in repeat_pattern and weekday_idx >= 5:
        return True

    # Check for specific days in comma-separated or space-separated pattern
    pattern_tokens = [t.strip() for t in repeat_pattern.replace(",", " ").split()]
    for token in pattern_tokens:
        if token in (weekday_short, weekday_full):
            return True

    return False


def is_alarm_due(alarm: Alarm, user_now: datetime, tolerance_minutes: int = 2) -> bool:
    """
    Determines if an alarm's scheduled time matches the user's current time
    within a small tolerance window (default 2 minutes).
    """
    if not alarm.is_active or not alarm.alarm_time:
        return False

    if not is_alarm_scheduled_for_today(alarm, user_now):
        return False

    alarm_t = alarm.alarm_time
    alarm_minutes = alarm_t.hour * 60 + alarm_t.minute
    current_minutes = user_now.hour * 60 + user_now.minute

    # Within tolerance window: current time >= alarm time and <= alarm time + tolerance
    diff = current_minutes - alarm_minutes
    return 0 <= diff <= tolerance_minutes


def has_alarm_triggered_today(alarm_id: int, user_id: int, user_now: datetime, db: Session) -> bool:
    """
    Idempotent duplicate check:
    Determines whether this alarm has already triggered on the user's current calendar day.
    Checks:
    1. UserNotification of category 'alarm_trigger' for this alarm on today's calendar date.
    2. AlarmSession started today for this alarm.
    """
    # Start of user's today in UTC for accurate timestamp query
    start_of_today_user_tz = user_now.replace(hour=0, minute=0, second=0, microsecond=0)
    # Convert to UTC datetime for database comparison
    start_of_today_utc = start_of_today_user_tz.astimezone(timezone.utc)

    # 1. Check existing trigger notification
    existing_notification = (
        db.query(UserNotification)
        .filter(
            UserNotification.user_id == user_id,
            UserNotification.category == "alarm_trigger",
            UserNotification.created_at >= start_of_today_utc,
            UserNotification.title.like(f"%Alarm ID {alarm_id}%") | UserNotification.message.like(f"%'{alarm_id}'%"),
        )
        .first()
    )
    if existing_notification:
        return True

    # 2. Check existing session for today
    existing_session = (
        db.query(AlarmSession)
        .filter(
            AlarmSession.alarm_id == alarm_id,
            AlarmSession.started_at >= start_of_today_utc,
        )
        .first()
    )
    if existing_session:
        return True

    return False


def trigger_alarm_for_user(alarm: Alarm, user: User, db: Session, force: bool = False, client_tz: Optional[str] = None) -> Dict[str, Any]:
    """
    Executes the trigger for a specific alarm:
    - Validates ownership and active status.
    - Enforces duplicate protection unless force=True.
    - Creates a high-priority UserNotification.
    - Returns structured trigger payload with deep-link metadata.
    """
    if alarm.user_id != user.id:
        raise ValueError("Unauthorized alarm access")

    if not alarm.is_active and not force:
        return {
            "triggered": False,
            "alarm_id": alarm.id,
            "status": "inactive",
            "message": "Alarm is currently disabled.",
        }

    user_now = get_current_time_in_user_tz(user, db, client_tz=client_tz)

    # Duplicate trigger check
    if not force and has_alarm_triggered_today(alarm.id, user.id, user_now, db):
        return {
            "triggered": False,
            "alarm_id": alarm.id,
            "status": "already_triggered_today",
            "message": f"Alarm '{alarm.name}' has already triggered today.",
            "target_route": f"/cognitive-alarm?alarmId={alarm.id}",
        }

    time_str = (
        alarm.alarm_time.strftime("%H:%M")
        if hasattr(alarm.alarm_time, "strftime")
        else str(alarm.alarm_time)[:5]
    )

    # Create persistent UserNotification for this alarm trigger
    notification = UserNotification(
        user_id=user.id,
        category="alarm_trigger",
        title=f"Wake Up — Cognitive Challenge [Alarm ID {alarm.id}]",
        message=f"Your alarm '{alarm.name}' scheduled for {time_str} is ringing. Tap to start your cognitive challenge.",
        priority="urgent",
        is_read=False,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    logger.info(
        f"Alarm {alarm.id} ('{alarm.name}') triggered successfully for user {user.id} at {user_now.isoformat()}"
    )

    return {
        "triggered": True,
        "alarm_id": alarm.id,
        "alarm_name": alarm.name,
        "alarm_time": time_str,
        "challenge_type": alarm.challenge_type or "math",
        "difficulty": alarm.difficulty or "medium",
        "target_route": f"/cognitive-alarm?alarmId={alarm.id}",
        "notification_id": notification.id,
        "notification_title": "Wake Up — Cognitive Challenge",
        "notification_body": f"Your alarm '{alarm.name}' is ringing. Tap to start your cognitive challenge.",
        "user_timezone": str(get_user_timezone(user, db, client_tz=client_tz)),
        "triggered_at": user_now.isoformat(),
    }


def check_due_alarms_for_user(user: User, db: Session, auto_trigger: bool = True, client_tz: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Scans all active alarms for the user against their local timezone clock.
    Identifies alarms that are currently due and have not yet triggered today.
    If auto_trigger is True, automatically generates the trigger notification.
    """
    user_now = get_current_time_in_user_tz(user, db, client_tz=client_tz)
    active_alarms = (
        db.query(Alarm)
        .filter(Alarm.user_id == user.id, Alarm.is_active.is_(True))
        .all()
    )

    due_list = []
    for alarm in active_alarms:
        if is_alarm_due(alarm, user_now, tolerance_minutes=3):
            if not has_alarm_triggered_today(alarm.id, user.id, user_now, db):
                if auto_trigger:
                    result = trigger_alarm_for_user(alarm, user, db, force=False, client_tz=client_tz)
                    if result.get("triggered"):
                        due_list.append(result)
                else:
                    time_str = (
                        alarm.alarm_time.strftime("%H:%M")
                        if hasattr(alarm.alarm_time, "strftime")
                        else str(alarm.alarm_time)[:5]
                    )
                    due_list.append({
                        "alarm_id": alarm.id,
                        "alarm_name": alarm.name,
                        "alarm_time": time_str,
                        "challenge_type": alarm.challenge_type or "math",
                        "difficulty": alarm.difficulty or "medium",
                        "target_route": f"/cognitive-alarm?alarmId={alarm.id}",
                        "is_due": True,
                    })

    return due_list
