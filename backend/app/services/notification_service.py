from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.database.models import (
    Alarm,
    AlarmSession,
    Announcement,
    Habit,
    User,
    UserNotification,
    UserProfile,
)
from app.services.habit_scorer import calculate_habit_score, compute_behavioral_metrics


def calculate_bedtime(wake_time, sleep_duration_hours: int) -> str:
    """Calculates target bedtime given preferred wake time and sleep duration hours."""
    if not wake_time or not sleep_duration_hours:
        return "22:30"
    
    wake_hour = wake_time.hour if hasattr(wake_time, "hour") else 7
    wake_min = wake_time.minute if hasattr(wake_time, "minute") else 0
    total_wake_mins = (wake_hour * 60) + wake_min
    total_sleep_mins = int(sleep_duration_hours * 60)
    
    bedtime_mins = (total_wake_mins - total_sleep_mins) % 1440
    bed_hour = bedtime_mins // 60
    bed_min = bedtime_mins % 60
    return f"{bed_hour:02d}:{bed_min:02d}"


def get_bedtime_reminder_data(user: User, db: Session) -> Optional[Dict[str, Any]]:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    wake_time = None
    sleep_duration_hours = 8

    if profile:
        if profile.preferred_wake_time:
            wake_time = profile.preferred_wake_time
        if profile.sleep_duration:
            sleep_duration_hours = profile.sleep_duration

    if not wake_time:
        first_alarm = (
            db.query(Alarm)
            .filter(Alarm.user_id == user.id, Alarm.is_active.is_(True))
            .order_by(Alarm.alarm_time.asc())
            .first()
        )
        if first_alarm:
            wake_time = first_alarm.alarm_time

    if not wake_time:
        return None

    target_bedtime = calculate_bedtime(wake_time, sleep_duration_hours)
    wake_str = wake_time.strftime("%H:%M") if hasattr(wake_time, "strftime") else str(wake_time)[:5]

    return {
        "category": "bedtime",
        "title": "🌙 Bedtime Reminder",
        "message": f"Target bedtime is {target_bedtime} to achieve your {sleep_duration_hours}h sleep goal before waking at {wake_str}.",
        "recommended_bedtime": target_bedtime,
        "next_alarm_time": wake_str,
        "target_bedtime": target_bedtime,
        "sleep_duration": sleep_duration_hours,
        "lead_time_minutes": 45,
    }


def get_wake_advance_reminders(user: User, db: Session) -> List[Dict[str, Any]]:
    active_alarms = (
        db.query(Alarm)
        .filter(Alarm.user_id == user.id, Alarm.is_active.is_(True))
        .order_by(Alarm.alarm_time.asc())
        .all()
    )
    reminders = []
    for alarm in active_alarms:
        time_str = alarm.alarm_time.strftime("%H:%M") if hasattr(alarm.alarm_time, "strftime") else str(alarm.alarm_time)[:5]
        reminders.append({
            "category": "wake_advance",
            "title": f"⏰ Upcoming Alarm: {alarm.name}",
            "message": f"Alarm '{alarm.name}' is scheduled for {time_str} with {alarm.challenge_type.capitalize()} challenge.",
            "alarm_id": alarm.id,
            "alarm_name": alarm.name,
            "alarm_time": time_str,
            "challenge_type": alarm.challenge_type,
            "difficulty": getattr(alarm, "difficulty", getattr(alarm, "difficulty_level", "medium")),
        })
    return reminders


def get_habit_alerts(user: User, db: Session) -> List[Dict[str, Any]]:
    habit = db.query(Habit).filter(Habit.user_id == user.id).first()
    if not habit:
        return []
    
    alerts = []
    if habit.wake_up_goal:
        alerts.append({
            "category": "habit",
            "title": "🎯 Wake-Up Goal Adherence",
            "message": f"Daily Target: {habit.wake_up_goal}. Stay consistent to build lasting circadian rhythm.",
            "priority": "normal",
        })
    if habit.productivity_goals:
        alerts.append({
            "category": "habit",
            "title": "⚡ Morning Productivity Focus",
            "message": f"Goal: {habit.productivity_goals}. Start your morning with immediate focus after dismissing your alarm.",
            "priority": "normal",
        })
    if habit.habit_preferences:
        alerts.append({
            "category": "habit",
            "title": "🛡️ Morning Habit Rule",
            "message": f"Preference: {habit.habit_preferences}. Complete your challenge without snoozing.",
            "priority": "normal",
        })
    return alerts


def get_challenge_reminders(user: User, db: Session) -> List[Dict[str, Any]]:
    active_sessions = (
        db.query(AlarmSession)
        .join(Alarm, Alarm.id == AlarmSession.alarm_id)
        .filter(Alarm.user_id == user.id, AlarmSession.session_status == "started")
        .all()
    )
    reminders = []
    for s in active_sessions:
        reminders.append({
            "category": "challenge",
            "title": "🧠 Cognitive Challenge Active",
            "message": f"Alarm session is active for '{s.alarm.name}'. Complete the cognitive challenge to stop the alarm.",
            "session_id": s.id,
            "alarm_id": s.alarm_id,
            "alarm_name": s.alarm.name,
            "challenge_type": getattr(s.alarm, "challenge_type", "cognitive"),
            "priority": "urgent",
        })

    active_alarms = (
        db.query(Alarm)
        .filter(Alarm.user_id == user.id, Alarm.is_active.is_(True), Alarm.challenge_type.isnot(None))
        .all()
    )
    for a in active_alarms:
        time_str = a.alarm_time.strftime("%H:%M") if hasattr(a.alarm_time, "strftime") else str(a.alarm_time)[:5]
        reminders.append({
            "category": "challenge",
            "title": f"🧩 Cognitive Challenge Scheduled: {a.name}",
            "message": f"Prepare for a {a.challenge_type.capitalize()} challenge when '{a.name}' rings at {time_str}.",
            "alarm_id": a.id,
            "alarm_name": a.name,
            "challenge_type": a.challenge_type,
            "priority": "normal",
        })
    return reminders


def get_progress_notifications(user: User, db: Session) -> List[Dict[str, Any]]:
    sessions = (
        db.query(AlarmSession)
        .join(Alarm, Alarm.id == AlarmSession.alarm_id)
        .filter(Alarm.user_id == user.id)
        .all()
    )
    if not sessions:
        return []
    
    completed = [
        s for s in sessions
        if s.session_status == "completed" or s.is_correct is not None or s.completed_at is not None
    ]
    notifications = []
    
    if len(completed) >= 1:
        metrics = compute_behavioral_metrics(sessions)
        score_data = calculate_habit_score(
            metrics["wake_up_consistency"],
            metrics["challenge_completion"],
            metrics["snooze_reduction"],
            metrics["sleep_schedule_adherence"],
        )
        score = score_data["overall_habit_score"]
        
        if score >= 80:
            notifications.append({
                "category": "progress",
                "title": "🏆 High Habit Score Achieved!",
                "message": f"Outstanding consistency! Your Habit Score is {score}/100.",
                "priority": "high",
            })
        elif score >= 60:
            notifications.append({
                "category": "progress",
                "title": "📈 Good Progress Milestone",
                "message": f"You're building strong morning habits with an overall Habit Score of {score}/100.",
                "priority": "normal",
            })
            
        notifications.append({
            "category": "progress",
            "title": "🎉 Sessions Milestone",
            "message": f"You have successfully completed {len(completed)} cognitive alarm session(s).",
            "priority": "normal",
        })
        
    return notifications


def sync_user_notifications(user: User, db: Session) -> List[UserNotification]:
    """
    Synchronizes dynamic reminders and alerts into user_notifications table,
    safely preventing duplicate entries within the same 12-hour window.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=12)
    existing_recent = (
        db.query(UserNotification)
        .filter(UserNotification.user_id == user.id, UserNotification.created_at >= cutoff)
        .all()
    )
    existing_titles = {n.title for n in existing_recent}

    items_to_create = []

    # 1. Bedtime Reminder
    bedtime = get_bedtime_reminder_data(user, db)
    if bedtime and bedtime["title"] not in existing_titles:
        items_to_create.append(
            UserNotification(
                user_id=user.id,
                category=bedtime["category"],
                title=bedtime["title"],
                message=bedtime["message"],
                priority="normal",
                is_read=False,
            )
        )

    # 2. Advance Wake-Up Reminders
    for r in get_wake_advance_reminders(user, db)[:2]:
        if r["title"] not in existing_titles:
            items_to_create.append(
                UserNotification(
                    user_id=user.id,
                    category=r["category"],
                    title=r["title"],
                    message=r["message"],
                    priority="normal",
                    is_read=False,
                )
            )

    # 3. Habit Alert (top item)
    habit_items = get_habit_alerts(user, db)
    if habit_items and habit_items[0]["title"] not in existing_titles:
        items_to_create.append(
            UserNotification(
                user_id=user.id,
                category=habit_items[0]["category"],
                title=habit_items[0]["title"],
                message=habit_items[0]["message"],
                priority=habit_items[0]["priority"],
                is_read=False,
            )
        )

    # 4. Progress notification (top item)
    progress_items = get_progress_notifications(user, db)
    if progress_items and progress_items[0]["title"] not in existing_titles:
        items_to_create.append(
            UserNotification(
                user_id=user.id,
                category=progress_items[0]["category"],
                title=progress_items[0]["title"],
                message=progress_items[0]["message"],
                priority=progress_items[0]["priority"],
                is_read=False,
            )
        )

    # Commit new items
    if items_to_create:
        db.add_all(items_to_create)
        db.commit()

    return (
        db.query(UserNotification)
        .filter(UserNotification.user_id == user.id)
        .order_by(UserNotification.created_at.desc())
        .limit(50)
        .all()
    )
