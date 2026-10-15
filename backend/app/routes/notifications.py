from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import get_current_user, user_scope
from app.db.database import get_db
from app.models.alarm import Alarm
from app.models.challenge_attempt import ChallengeAttempt
from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.models.reminder import Reminder
from app.models.user import User
from app.services import alarm_service
from app.services.habit_score import habit_score_service
from app.services.profile_service import get_or_create_profile

router = APIRouter(
    tags=["Notifications and Reminders"],
    dependencies=[Depends(user_scope)],
)

CATEGORIES = {
    "general", "announcement", "reminder", "bedtime", "wake_up",
    "habit", "challenge", "progress",
}
REPEAT_RULES = {"once", "daily", "weekly"}


class NotificationCreate(BaseModel):
    user_id: int | None = None
    title: str = Field(min_length=1, max_length=160)
    message: str = Field(min_length=1)
    category: str = "general"


class ReminderCreate(BaseModel):
    user_id: int | None = None
    title: str = Field(min_length=1, max_length=160)
    message: str = ""
    due_at: datetime
    repeat_rule: str = "once"
    category: str = "reminder"


class ReminderUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=160)
    message: str | None = None
    due_at: datetime | None = None
    repeat_rule: str | None = None
    enabled: bool | None = None


class PreferencesUpdate(BaseModel):
    in_app_enabled: bool = True
    reminder_enabled: bool = True
    wellness_enabled: bool = True


def _user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _notification_dict(n: Notification):
    return {"id": n.id, "user_id": n.user_id, "title": n.title, "message": n.message,
            "category": n.category, "is_read": n.is_read, "created_at": n.created_at}


def _reminder_dict(r: Reminder):
    return {"id": r.id, "user_id": r.user_id, "title": r.title, "message": r.message,
            "due_at": r.due_at, "repeat_rule": r.repeat_rule, "enabled": r.enabled,
            "category": r.category, "last_fired_at": r.last_fired_at,
            "created_at": r.created_at}


def _prefs(db: Session, user_id: int) -> NotificationPreference:
    row = db.execute(select(NotificationPreference).where(
        NotificationPreference.user_id == user_id)).scalar_one_or_none()
    if row is None:
        row = NotificationPreference(user_id=user_id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _prefs_dict(row: NotificationPreference):
    return {"user_id": row.user_id, "in_app_enabled": row.in_app_enabled,
            "reminder_enabled": row.reminder_enabled,
            "wellness_enabled": row.wellness_enabled}


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def process_due_reminders(db: Session, user_id: int | None = None):
    now = datetime.now(timezone.utc)
    query = select(Reminder).where(Reminder.enabled.is_(True), Reminder.due_at <= now)
    if user_id is not None:
        query = query.where(Reminder.user_id == user_id)
    due = db.execute(query).scalars().all()
    created = 0
    for reminder in due:
        due_at = _aware(reminder.due_at)
        # A due reminder fires once for its current due_at value.
        if reminder.last_fired_at and _aware(reminder.last_fired_at) >= due_at:
            continue
        pref = db.execute(select(NotificationPreference).where(
            NotificationPreference.user_id == reminder.user_id)).scalar_one_or_none()
        if pref is None or (pref.in_app_enabled and pref.reminder_enabled):
            db.add(Notification(user_id=reminder.user_id, title=reminder.title,
                message=reminder.message or "Your reminder is due.",
                category=reminder.category or "reminder"))
            created += 1
        reminder.last_fired_at = now
        step = {"daily": timedelta(days=1), "weekly": timedelta(days=7)}.get(reminder.repeat_rule)
        if step:
            # Skip any missed days so a daily reminder does not fire in a burst.
            next_due = due_at + step
            while next_due <= now:
                next_due += step
            reminder.due_at = next_due
        else:
            reminder.enabled = False
    if due:
        db.commit()
    return created


@router.get("/notifications")
def list_notifications(user_id: int | None = None, unread_only: bool = False, limit: int = 50,
                       current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user_id or current.id
    _user_or_404(db, user_id)
    process_due_reminders(db, user_id)
    query = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        query = query.where(Notification.is_read.is_(False))
    rows = db.execute(query.order_by(Notification.created_at.desc()).limit(max(1, min(limit, 200)))).scalars().all()
    return {"items": [_notification_dict(n) for n in rows],
            "unread_count": db.scalar(select(func.count(Notification.id)).where(
                Notification.user_id == user_id, Notification.is_read.is_(False))) or 0}


@router.get("/notifications/unread-count")
def unread_count(user_id: int | None = None, current: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    user_id = user_id or current.id
    _user_or_404(db, user_id)
    process_due_reminders(db, user_id)
    return {"user_id": user_id, "unread_count": db.scalar(select(func.count(Notification.id)).where(
        Notification.user_id == user_id, Notification.is_read.is_(False))) or 0}


@router.post("/notifications")
def create_notification(body: NotificationCreate, current: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    user_id = body.user_id or current.id
    _user_or_404(db, user_id)
    row = Notification(user_id=user_id, title=body.title, message=body.message, category=body.category)
    db.add(row); db.commit(); db.refresh(row)
    return _notification_dict(row)


@router.patch("/notifications/{notification_id}/read")
def mark_read(notification_id: int, user_id: int | None = None,
              current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user_id or current.id
    row = db.execute(select(Notification).where(Notification.id == notification_id,
        Notification.user_id == user_id)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    row.is_read = True; db.commit()
    return {"message": "Notification marked as read", "id": row.id}


@router.post("/notifications/read-all")
def mark_all_read(user_id: int | None = None, current: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    user_id = user_id or current.id
    rows = db.execute(select(Notification).where(Notification.user_id == user_id,
        Notification.is_read.is_(False))).scalars().all()
    for row in rows:
        row.is_read = True
    db.commit()
    return {"message": "All notifications marked as read", "updated": len(rows)}


@router.get("/reminders")
def list_reminders(user_id: int | None = None, current: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    user_id = user_id or current.id
    _user_or_404(db, user_id)
    process_due_reminders(db, user_id)
    rows = db.execute(select(Reminder).where(Reminder.user_id == user_id).order_by(Reminder.due_at)).scalars().all()
    return [_reminder_dict(r) for r in rows]


@router.post("/reminders", status_code=201)
def create_reminder(body: ReminderCreate, current: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    user_id = body.user_id or current.id
    _user_or_404(db, user_id)
    if body.repeat_rule not in REPEAT_RULES:
        raise HTTPException(status_code=400, detail="repeat_rule must be once, daily, or weekly")
    if body.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Unknown reminder category")
    row = Reminder(user_id=user_id, title=body.title, message=body.message,
        due_at=_aware(body.due_at), repeat_rule=body.repeat_rule, category=body.category)
    db.add(row); db.commit(); db.refresh(row)
    process_due_reminders(db, user_id)
    return _reminder_dict(row)


@router.patch("/reminders/{reminder_id}")
def update_reminder(reminder_id: int, body: ReminderUpdate, user_id: int | None = None,
                    current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user_id or current.id
    row = db.execute(select(Reminder).where(Reminder.id == reminder_id, Reminder.user_id == user_id)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Reminder not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        if key == "repeat_rule" and value not in REPEAT_RULES:
            raise HTTPException(status_code=400, detail="repeat_rule must be once, daily, or weekly")
        if key == "due_at" and value is not None:
            value = _aware(value)
        setattr(row, key, value)
    db.commit(); db.refresh(row)
    return _reminder_dict(row)


@router.delete("/reminders/{reminder_id}")
def delete_reminder(reminder_id: int, user_id: int | None = None,
                    current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user_id or current.id
    row = db.execute(select(Reminder).where(Reminder.id == reminder_id, Reminder.user_id == user_id)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Reminder not found")
    db.delete(row); db.commit()
    return {"message": "Reminder deleted successfully"}


@router.get("/notification-preferences/{user_id}")
def get_preferences(user_id: int, db: Session = Depends(get_db)):
    _user_or_404(db, user_id)
    return _prefs_dict(_prefs(db, user_id))


@router.put("/notification-preferences/{user_id}")
def update_preferences(user_id: int, body: PreferencesUpdate, db: Session = Depends(get_db)):
    _user_or_404(db, user_id)
    row = _prefs(db, user_id)
    row.in_app_enabled = body.in_app_enabled
    row.reminder_enabled = body.reminder_enabled
    row.wellness_enabled = body.wellness_enabled
    db.commit(); db.refresh(row)
    return _prefs_dict(row)


# ---------------------------------------------------------
# AUTOMATIC REMINDERS: BEDTIME AND WAKE-UP
# ---------------------------------------------------------

def _next_local(at: time, tz: ZoneInfo) -> datetime:
    now_local = datetime.now(timezone.utc).astimezone(tz)
    candidate = datetime.combine(now_local.date(), at, tzinfo=tz)
    if candidate <= now_local:
        candidate += timedelta(days=1)
    return candidate.astimezone(timezone.utc)


@router.post("/reminders/auto-setup/{user_id}")
def auto_setup_reminders(user_id: int, bedtime_lead_minutes: int = 30,
                         wake_lead_minutes: int = 10, db: Session = Depends(get_db)):
    """Create daily bedtime and wake-up reminders from the profile and alarms.

    Running it again replaces the earlier automatic reminders instead of
    adding duplicates.
    """
    user = _user_or_404(db, user_id)
    profile = get_or_create_profile(db, user_id)
    tz = alarm_service.user_tz(user)

    old = db.execute(select(Reminder).where(
        Reminder.user_id == user_id,
        Reminder.category.in_(["bedtime", "wake_up"]),
        Reminder.title.like("[Auto]%"))).scalars().all()
    for row in old:
        db.delete(row)

    created = []
    bedtime = profile.sleep_target
    if bedtime is None and profile.wake_target is not None:
        bedtime = alarm_service.shift_time(profile.wake_target, -profile.daily_sleep_goal_minutes)
    if bedtime is not None:
        at = alarm_service.shift_time(bedtime, -max(0, min(bedtime_lead_minutes, 180)))
        row = Reminder(user_id=user_id, title="[Auto] Bedtime reminder",
            message=f"Start winding down. Your bedtime is {bedtime.strftime('%H:%M')}.",
            due_at=_next_local(at, tz), repeat_rule="daily", category="bedtime")
        db.add(row); created.append("bedtime")

    first_alarm = db.execute(select(Alarm).where(Alarm.user_id == user_id, Alarm.enabled.is_(True))
        .order_by(Alarm.alarm_time)).scalars().first()
    wake = first_alarm.alarm_time if first_alarm else profile.wake_target
    if wake is not None:
        at = alarm_service.shift_time(wake, -max(0, min(wake_lead_minutes, 120)))
        row = Reminder(user_id=user_id, title="[Auto] Wake-up reminder",
            message=f"Your alarm rings at {wake.strftime('%H:%M')}. Keep your device within reach.",
            due_at=_next_local(at, tz), repeat_rule="daily", category="wake_up")
        db.add(row); created.append("wake_up")

    db.commit()
    return {"created": created,
            "note": None if created else "Set a wake-up time or bedtime in your profile first."}


# ---------------------------------------------------------
# GENERATED ALERTS: HABIT, CHALLENGE AND PROGRESS
# ---------------------------------------------------------

def _add_once_per_day(db: Session, user: User, category: str, title: str, message: str) -> bool:
    tz = alarm_service.user_tz(user)
    start = alarm_service.local_day_start_utc(tz)
    exists = db.scalar(select(func.count(Notification.id)).where(
        Notification.user_id == user.id, Notification.category == category,
        Notification.created_at >= start)) or 0
    if exists:
        return False
    db.add(Notification(user_id=user.id, title=title, message=message, category=category))
    return True


@router.post("/notifications/generate/{user_id}")
def generate_alerts(user_id: int, db: Session = Depends(get_db)):
    """Create habit, challenge and progress notifications from recent data.

    Each category is created at most once a day.
    """
    user = _user_or_404(db, user_id)
    prefs = _prefs(db, user_id)
    if not (prefs.in_app_enabled and prefs.wellness_enabled):
        return {"created": [], "note": "Wellness notifications are turned off."}

    created: list[str] = []
    tz = alarm_service.user_tz(user)
    today_start = alarm_service.local_day_start_utc(tz).replace(tzinfo=None)  # naive UTC column

    tried_today = db.scalar(select(func.count(ChallengeAttempt.id)).where(
        ChallengeAttempt.user_id == user_id, ChallengeAttempt.created_at >= today_start)) or 0
    if tried_today == 0 and _add_once_per_day(db, user, "challenge", "Time for a quick challenge",
            "A short brain challenge today keeps your wake-up routine sharp."):
        created.append("challenge")

    try:
        habit = habit_score_service.calculate_habit_score(db=db, user_id=user_id)
        score = habit["habit_score"]
        has_data = any(v is not None for v in habit["components"].values())
    except Exception:
        score, has_data = 0, False

    if has_data and score < 50 and _add_once_per_day(db, user, "habit", "Your habit score needs attention",
            f"Your habit score is {score:.0f}. Pick one steady wake-up time this week."):
        created.append("habit")
    if has_data and score >= 80 and _add_once_per_day(db, user, "progress", "Great consistency",
            f"Your habit score is {score:.0f}. Keep the streak going."):
        created.append("progress")

    db.commit()
    return {"created": created}
