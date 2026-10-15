"""
NotificationService — Module 11 (Notification & Reminder System)

Generates in-app notifications:
  - BEDTIME_REMINDER  : derived from alarm_time - sleep_duration
  - WAKEUP_REMINDER   : upcoming alarm reminder
  - HABIT_ALERT       : triggered when habit score drops below a threshold
  - MISSED_ALARM      : alarm rang but was never verified/dismissed
  - PROGRESS          : positive reinforcement when habit score improves

Generation is idempotent per (user, type, alarm) per day, so it is safe to call
repeatedly (e.g. from the scheduler AND from the API) without creating duplicates.

NOTE: This delivers in-app notifications only. Wiring a real push channel
(Firebase Cloud Messaging, email, SMS) requires external provider credentials
that must be supplied by the project owner — see NotificationChannel below
for the extension point.
"""
from datetime import datetime, timedelta, timezone
import logging

from sqlalchemy.orm import Session

from app.models.models import Alarm, Notification, User, UserProfile, WakeUpSession
from app.services.habit_scoring import calculate_habit_score

logger = logging.getLogger(__name__)

HABIT_ALERT_THRESHOLD = 50.0
MISSED_ALARM_GRACE_MINUTES = 30
WEEKLY_SUMMARY_DAY = 6  # Sunday (weekday() == 6)


class NotificationChannel:
    """Extension point for real push delivery (FCM/email/SMS). No-op by default."""

    def send(self, notification: Notification) -> None:
        logger.debug("Notification %s created (in-app only, no external channel wired)", notification.id)


_channel = NotificationChannel()


def _today_start(now: datetime) -> datetime:
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _already_sent_today(db: Session, user_id: int, type_: str, ref: str, now: datetime) -> bool:
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.type == type_,
            Notification.title == ref,
            Notification.created_at >= _today_start(now),
        )
        .first()
        is not None
    )


def _create(db: Session, user_id: int, type_: str, title: str, message: str) -> Notification:
    note = Notification(user_id=user_id, type=type_, title=title, message=message)
    db.add(note)
    db.commit()
    db.refresh(note)
    _channel.send(note)
    return note


def _parse_time(hhmm: str) -> tuple[int, int]:
    try:
        h, m = hhmm.split(":")
        return int(h), int(m)
    except Exception:
        return 7, 0


def generate_weekly_summary(db: Session, user: User, now: datetime) -> list[Notification]:
    """Generate a weekly summary notification every Sunday."""
    if now.weekday() != WEEKLY_SUMMARY_DAY:
        return []
    if _already_sent_today(db, user.id, "WEEKLY_SUMMARY", "weekly_summary", now):
        return []
    result = calculate_habit_score(db, user.id, days=7)
    if result.get("insufficient_data"):
        return []
    score = result["habit_score"]
    components = result["components"]
    best = max(components.items(), key=lambda x: x[1]["score"])
    worst = min(components.items(), key=lambda x: x[1]["score"])
    note = _create(
        db, user.id, "WEEKLY_SUMMARY", "weekly_summary",
        f"Your weekly habit score is {score}/100. "
        f"Best: {best[1]['label']} ({best[1]['score']}/100). "
        f"Needs work: {worst[1]['label']} ({worst[1]['score']}/100). "
        f"Keep it up this week!",
    )
    return [note]


def generate_for_user(db: Session, user: User, now: datetime | None = None) -> list[Notification]:
    """Generate any due reminders/alerts for a single user. Returns newly created notifications."""
    now = now or datetime.now(timezone.utc)
    created: list[Notification] = []

    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    alarms = db.query(Alarm).filter(Alarm.user_id == user.id, Alarm.enabled == True).all()  # noqa: E712

    sleep_duration = profile.sleep_duration if profile else 8

    for alarm in alarms:
        # Wake-up reminder (once/day per alarm)
        title = f"wakeup:{alarm.id}"
        if not _already_sent_today(db, user.id, "WAKEUP_REMINDER", title, now):
            created.append(_create(
                db, user.id, "WAKEUP_REMINDER", title,
                f"Alarm '{alarm.alarm_name}' is set for {alarm.alarm_time}. Get ready to wake up!",
            ))

        # Bedtime reminder derived from alarm_time - sleep_duration hours (once/day per alarm)
        hour, minute = _parse_time(alarm.alarm_time)
        wake_dt = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        bedtime_dt = wake_dt - timedelta(hours=sleep_duration)
        bed_title = f"bedtime:{alarm.id}"
        if not _already_sent_today(db, user.id, "BEDTIME_REMINDER", bed_title, now):
            created.append(_create(
                db, user.id, "BEDTIME_REMINDER", bed_title,
                f"To get {sleep_duration}h of sleep before your '{alarm.alarm_name}' alarm, "
                f"aim to be in bed by {bedtime_dt.strftime('%H:%M')}.",
            ))

        # Missed alarm: most recent session for this alarm never verified/dismissed past grace period
        last_session = (
            db.query(WakeUpSession)
            .filter(WakeUpSession.alarm_id == alarm.id)
            .order_by(WakeUpSession.started_at.desc())
            .first()
        )
        if last_session and last_session.status != "WAKE_UP_VERIFIED" and not last_session.dismissed_at:
            age_minutes = (now - last_session.started_at.replace(tzinfo=timezone.utc)).total_seconds() / 60
            if age_minutes >= MISSED_ALARM_GRACE_MINUTES:
                miss_title = f"missed:{last_session.id}"
                if not _already_sent_today(db, user.id, "MISSED_ALARM", miss_title, now):
                    created.append(_create(
                        db, user.id, "MISSED_ALARM", miss_title,
                        f"You didn't verify wake-up for '{alarm.alarm_name}'. "
                        f"Try to stay consistent tomorrow!",
                    ))

    # Habit score alert / progress (once/day, not per-alarm)
    result = calculate_habit_score(db, user.id, days=7)
    score = result["habit_score"]
    if not result.get("insufficient_data"):
        if score < HABIT_ALERT_THRESHOLD and not _already_sent_today(db, user.id, "HABIT_ALERT", "habit_alert", now):
            created.append(_create(
                db, user.id, "HABIT_ALERT", "habit_alert",
                f"Your habit score is {score}/100 this week. Check your Analytics dashboard "
                f"for personalized recommendations to improve it.",
            ))
        elif score >= 80 and not _already_sent_today(db, user.id, "PROGRESS", "progress", now):
            created.append(_create(
                db, user.id, "PROGRESS", "progress",
                f"Great job! Your habit score is {score}/100 this week. Keep up the consistent routine.",
            ))

    created += generate_weekly_summary(db, user, now)
    return created


def generate_for_all_users(db: Session) -> int:
    """Run generation for every user. Used by the background scheduler. Returns count created."""
    total = 0
    for user in db.query(User).all():
        total += len(generate_for_user(db, user))
    return total
