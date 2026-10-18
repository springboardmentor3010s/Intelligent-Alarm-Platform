
import json
from fastapi import FastAPI, Depends, HTTPException
from bson import ObjectId
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from behavior_api import router as behavior_router
from analytics_ai import analyze_challenge_behavior
from mongodb import log_behavior_event, behavior_events
from sqlalchemy import text
from database import SessionLocal, Base, engine
from models import (
    User,
    UserProfile,
    Alarm,
    Recommendation,
    Challenge,
    ChallengeResult
)

Base.metadata.create_all(bind=engine)

# In-app notification storage. Kept in a small dedicated table so the
# notification bell works for User, Coach, and Admin without changing
# the existing SQLAlchemy models.
def ensure_notifications_table():
    db = SessionLocal()
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                notification_type VARCHAR(50) NOT NULL DEFAULT 'general',
                is_read BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.commit()
    finally:
        db.close()


ensure_notifications_table()


def create_in_app_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: str = "general",
):
    """Create one persistent in-app notification for a specific user."""
    db.execute(
        text("""
            INSERT INTO notifications
                (user_id, title, message, notification_type)
            VALUES
                (:user_id, :title, :message, :notification_type)
        """),
        {
            "user_id": user_id,
            "title": title,
            "message": message,
            "notification_type": notification_type,
        },
    )
    db.commit()

from schemas import (
    UserRegister,
    UserLogin,
    UserProfileCreate,
    AlarmCreate,
    ChallengeRequest,
    ChallengeAnswer
)
from auth import hash_password, verify_password
from jwt_auth import create_access_token
from dependencies import get_current_user
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, date, timedelta, timezone
from pydantic import BaseModel
from typing import Literal, Optional
from io import BytesIO
from pytorch_service import predict_user_behavior
from rl_adaptive import AdaptiveDifficultyRL
from firebase_service import send_fcm_notification

# Registration request for User, Admin, or Coach
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: Literal["user", "admin", "wellness_coach"]


app = FastAPI()
app.include_router(behavior_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


scheduler = BackgroundScheduler()
last_triggered = {}

def check_alarms():
    db = SessionLocal()

    try:
        current_time = datetime.now()
        current_day = current_time.strftime("%A").lower()

        alarms = db.query(Alarm).filter(
            Alarm.is_active == True
        ).all()

        for alarm in alarms:

            # Check alarm time
            if (
                alarm.alarm_time.hour != current_time.hour
                or alarm.alarm_time.minute != current_time.minute
            ):
                continue

            # Get repeat type
            repeat_type = alarm.repeat_type or "daily"

            # Check whether alarm should run today
            should_trigger = False

            if repeat_type == "daily":
                should_trigger = True

            elif repeat_type == "weekdays":
                # Monday = 0 ... Friday = 4
                should_trigger = current_time.weekday() < 5

            elif repeat_type == "weekends":
                # Saturday = 5, Sunday = 6
                should_trigger = current_time.weekday() >= 5

            elif repeat_type == "custom":
                try:
                    repeat_days = json.loads(
                        alarm.repeat_days or "[]"
                    )

                    repeat_days = [
                        day.lower() for day in repeat_days
                    ]

                    should_trigger = current_day in repeat_days

                except Exception:
                    should_trigger = False

            # If today is not a selected day, don't trigger
            if not should_trigger:
                continue

            # Prevent duplicate triggering within the same minute
            trigger_key = (
                alarm.id,
                current_time.strftime("%Y-%m-%d %H:%M")
            )

            if trigger_key in last_triggered:
                continue

            print(
                f"ALARM TRIGGERED: {alarm.alarm_name} "
                f"(Alarm ID: {alarm.id}, User ID: {alarm.user_id})"
            )

            # Find the user who owns this alarm
            user = db.query(User).filter(
                User.id == alarm.user_id
            ).first()

            # Create an in-app notification as well as the existing FCM popup.
            if user:
                create_in_app_notification(
                    db,
                    user.id,
                    "Alarm triggered",
                    f"Your alarm '{alarm.alarm_name}' is ringing. "
                    "Solve the cognitive challenge to dismiss it.",
                    "alarm",
                )

            # Send FCM notification
            if user and user.fcm_token:
                send_fcm_notification(
                    user.fcm_token,
                    "Intelligent Cognitive Alarm",
                    f"Your alarm '{alarm.alarm_name}' is ringing. "
                    "Solve the cognitive challenge to dismiss it."
                )

                print(
                    f"FCM notification sent to User ID: {alarm.user_id}"
                )

            else:
                print(
                    f"No FCM token found for User ID: {alarm.user_id}"
                )

            last_triggered[trigger_key] = True

    finally:
        db.close()


scheduler.add_job(check_alarms, "interval", seconds=10)
scheduler.start()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# =========================
# ROLE-BASED ACCESS CONTROL
# =========================
def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def require_coach(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "wellness_coach":
        raise HTTPException(status_code=403, detail="Wellness Coach access required")
    return current_user

@app.get("/")
def home():
    return {"message": "Intelligent Cognitive Alarm Backend is running"}
class FCMTokenRequest(BaseModel):
    token: str


@app.post("/notifications/register-token")
def register_fcm_token(
    data: FCMTokenRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.id == current_user["user_id"]
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    user.fcm_token = data.token
    db.commit()

    return {
        "message": "FCM token registered successfully"
    }

# =========================================================
# IN-APP NOTIFICATIONS
# =========================================================

@app.get("/notifications")
def get_notifications(
    limit: int = 30,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the signed-in user's newest notifications and unread count."""
    safe_limit = max(1, min(limit, 50))

    rows = db.execute(
        text("""
            SELECT id, title, message, notification_type,
                   is_read, created_at
            FROM notifications
            WHERE user_id = :user_id
            ORDER BY created_at DESC
            LIMIT :limit
        """),
        {"user_id": current_user["user_id"], "limit": safe_limit},
    ).mappings().all()

    unread_count = db.execute(
        text("""
            SELECT COUNT(*)
            FROM notifications
            WHERE user_id = :user_id AND is_read = FALSE
        """),
        {"user_id": current_user["user_id"]},
    ).scalar_one()

    return {
        "notifications": [
            {
                "id": row["id"],
                "title": row["title"],
                "message": row["message"],
                "notification_type": row["notification_type"],
                "is_read": bool(row["is_read"]),
                "created_at": row["created_at"].isoformat()
                if row["created_at"] else None,
            }
            for row in rows
        ],
        "unread_count": int(unread_count or 0),
    }


@app.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = db.execute(
        text("""
            UPDATE notifications
            SET is_read = TRUE
            WHERE id = :notification_id
              AND user_id = :user_id
        """),
        {
            "notification_id": notification_id,
            "user_id": current_user["user_id"],
        },
    )
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found")

    return {"message": "Notification marked as read"}


@app.post("/notifications/read-all")
def mark_all_notifications_read(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(
        text("""
            UPDATE notifications
            SET is_read = TRUE
            WHERE user_id = :user_id AND is_read = FALSE
        """),
        {"user_id": current_user["user_id"]},
    )
    db.commit()

    return {"message": "All notifications marked as read"}


@app.get("/database-test")
def database_test():
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return {"status": "success", "message": "FastAPI is connected to PostgreSQL"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/register")
def register(user: RegisterRequest, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user.email).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    new_user = User(
        name=user.name,
        email=user.email,
        password_hash=hash_password(user.password),
        role=user.role
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    role_name = "Coach" if new_user.role == "wellness_coach" else new_user.role.title()

    # Welcome notification for the newly registered account.
    create_in_app_notification(
        db,
        new_user.id,
        "Welcome to Intelligent Cognitive Alarm",
        f"Your {role_name.lower()} account has been created successfully.",
        "account",
    )

    # Notify all existing admins about a new account.
    admin_users = db.query(User).filter(User.role == "admin").all()
    for admin in admin_users:
        if admin.id != new_user.id:
            create_in_app_notification(
                db,
                admin.id,
                f"New {role_name.lower()} registered",
                f"{new_user.name} ({new_user.email}) joined the platform.",
                "admin",
            )

    # Notify all existing wellness coaches when a new User account is registered.
    if new_user.role == "user":
        coach_users = db.query(User).filter(
            User.role == "wellness_coach"
        ).all()

        for coach in coach_users:
            create_in_app_notification(
                db,
                coach.id,
                "New user registered",
                f"{new_user.name} ({new_user.email}) joined the platform.",
                "account",
            )

    return {
        "message": f"{role_name} registered successfully",
        "user_id": new_user.id,
        "role": new_user.role
    }

@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user.email).first()
    if not existing_user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(user.password, existing_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access_token = create_access_token({"user_id": existing_user.id, "email": existing_user.email, "role": existing_user.role})
    return {"message": "Login successful", "access_token": access_token, "user_id": existing_user.id, "name": existing_user.name, "role": existing_user.role}

@app.get("/profile")
def profile(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    existing_profile = db.query(UserProfile).filter(
        UserProfile.user_id == current_user["user_id"]
    ).first()

    if not existing_profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    return {
        "user_id": existing_profile.user_id,
        "email": current_user["email"],
        "role": current_user["role"],
        "preferred_wake_up_time": (
            str(existing_profile.preferred_wake_up_time)
            if existing_profile.preferred_wake_up_time else None
        ),
        "sleep_duration": existing_profile.sleep_duration,
        "time_zone": existing_profile.time_zone,
        "productivity_goal": existing_profile.productivity_goal,
        "difficulty_preference": existing_profile.difficulty_preference,
        "habit_preferences": existing_profile.habit_preferences,
        "profile_completed": True,
    }

@app.get("/admin-test")
def admin_test(current_user: dict = Depends(require_admin)):
    return {"message": "Welcome Admin!", "user_id": current_user["user_id"], "email": current_user["email"], "role": current_user["role"]}

# =========================================================
# ADMIN - ACCOUNT MANAGEMENT
# =========================================================

@app.get("/admin/users")
def get_admin_users(
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Return all accounts for Admin account management."""
    users = db.query(User).order_by(User.created_at.desc()).all()

    return [
        {
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "created_at": (
                user.created_at.isoformat()
                if user.created_at
                else None
            ),
        }
        for user in users
    ]


@app.delete("/admin/users/{user_id}")
def delete_admin_user(
    user_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Permanently delete one account and its user-owned data."""
    if user_id == current_user["user_id"]:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete the currently logged-in Admin account.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    deleted_name = user.name
    deleted_email = user.email

    # Remove records that reference the account. These are deleted
    # explicitly so the operation remains safe even if PostgreSQL
    # foreign-key cascade behavior is not enabled on an existing DB.
    db.query(Recommendation).filter(
        (Recommendation.user_id == user_id)
        | (Recommendation.coach_id == user_id)
    ).delete(synchronize_session=False)

    db.query(ChallengeResult).filter(
        ChallengeResult.user_id == user_id
    ).delete(synchronize_session=False)

    db.query(Alarm).filter(
        Alarm.user_id == user_id
    ).delete(synchronize_session=False)

    db.query(UserProfile).filter(
        UserProfile.user_id == user_id
    ).delete(synchronize_session=False)

    # In-app notifications are stored in a table created by the
    # notification system, so remove notifications for this account.
    db.execute(
        text("DELETE FROM notifications WHERE user_id = :user_id"),
        {"user_id": user_id},
    )

    db.delete(user)
    db.commit()

    # Remove the account's behavioral history from MongoDB as well.
    try:
        from mongodb import behavior_events
        behavior_events.delete_many({"user_id": user_id})
    except Exception:
        # PostgreSQL account deletion has already succeeded; MongoDB
        # cleanup is best-effort if the MongoDB service is unavailable.
        pass

    return {
        "message": "User account deleted successfully",
        "user_id": user_id,
        "name": deleted_name,
        "email": deleted_email,
    }




# =========================================================
# MILESTONE 4 - EXECUTIVE DASHBOARD / PLATFORM ANALYTICS
# =========================================================

@app.get("/admin/executive-analytics")
def get_admin_executive_analytics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Return platform-wide metrics for the M4 executive/admin dashboard.

    If start_date/end_date are provided, all activity-based analytics are
    calculated only for that inclusive date range. Dates use YYYY-MM-DD.
    """
    from collections import defaultdict

    # -------------------------
    # Validate selected date range
    # -------------------------
    today = date.today()

    try:
        selected_start = date.fromisoformat(start_date) if start_date else today.replace(day=1)
        requested_end = date.fromisoformat(end_date) if end_date else today
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="start_date and end_date must use YYYY-MM-DD format",
        )

    if selected_start > today:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be in the future",
        )

    selected_end = min(requested_end, today)

    if selected_start > selected_end:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be after end_date",
        )

    def event_date(timestamp):
        if not timestamp:
            return None
        if isinstance(timestamp, datetime):
            return timestamp.date()
        if isinstance(timestamp, date):
            return timestamp
        try:
            return datetime.fromisoformat(str(timestamp).replace("Z", "+00:00")).date()
        except (TypeError, ValueError):
            return None

    def in_selected_range(value):
        value_date = event_date(value)
        return (
            value_date is not None
            and selected_start <= value_date <= selected_end
        )

    # -------------------------
    # Platform totals (always current platform totals)
    # -------------------------
    total_users = db.query(User).filter(User.role == "user").count()
    total_alarms = db.query(Alarm).count()
    total_recommendations = db.query(Recommendation).count()

    # -------------------------
    # Challenge activity for selected date range
    # -------------------------
    all_challenge_results = db.query(ChallengeResult).all()
    challenge_results = [
        result
        for result in all_challenge_results
        if in_selected_range(result.completed_at)
    ]

    total_challenges = len(challenge_results)
    correct_answers = sum(
        1 for result in challenge_results if result.is_correct
    )
    challenge_accuracy = (
        (correct_answers / total_challenges) * 100
        if total_challenges else 0
    )

    # -------------------------
    # Behavioral activity for selected date range
    # -------------------------
    all_behavior_documents = list(behavior_events.find({}, {"_id": 0}))
    behavior_documents = [
        event
        for event in all_behavior_documents
        if in_selected_range(event.get("timestamp"))
    ]

    alarm_triggered = sum(
        1 for event in behavior_documents
        if event.get("event_type") == "alarm_triggered"
    )
    wake_up_completed = sum(
        1 for event in behavior_documents
        if event.get("event_type") == "wake_up_completed"
    )
    snoozed = sum(
        1 for event in behavior_documents
        if event.get("event_type") == "alarm_snoozed"
    )

    wake_up_success_rate = (
        (wake_up_completed / alarm_triggered) * 100
        if alarm_triggered else 0
    )
    snooze_rate = (
        (snoozed / alarm_triggered) * 100
        if alarm_triggered else 0
    )

    # -------------------------
    # Platform habit score proxy
    # -------------------------
    wake_component = min(100, max(0, wake_up_success_rate))
    challenge_component = min(100, max(0, challenge_accuracy))
    snooze_component = max(0, min(100, 100 - snooze_rate))

    schedule_scores = []
    user_profiles = {
        profile.user_id: profile
        for profile in db.query(UserProfile).all()
    }

    for event in behavior_documents:
        if event.get("event_type") != "wake_up_completed":
            continue

        user_id = event.get("user_id")
        profile = user_profiles.get(user_id)
        timestamp = event.get("timestamp")
        preferred_time = profile.preferred_wake_up_time if profile else None

        if not timestamp or not preferred_time:
            continue

        preferred_minutes = preferred_time.hour * 60 + preferred_time.minute
        actual_minutes = timestamp.hour * 60 + timestamp.minute
        difference = abs(actual_minutes - preferred_minutes)
        difference = min(difference, 1440 - difference)

        if difference <= 15:
            score = 100
        elif difference <= 30:
            score = 90
        elif difference <= 60:
            score = 75
        elif difference <= 120:
            score = 50
        else:
            score = 25

        schedule_scores.append(score)

    sleep_schedule_component = (
        sum(schedule_scores) / len(schedule_scores)
        if schedule_scores else None
    )

    available_weight = 0.35 + 0.25 + 0.20
    if sleep_schedule_component is None:
        platform_habit_score = (
            wake_component * 0.35
            + challenge_component * 0.25
            + snooze_component * 0.20
        ) / available_weight
        habit_score_status = "provisional_missing_sleep_schedule_data"
    else:
        platform_habit_score = (
            wake_component * 0.35
            + challenge_component * 0.25
            + snooze_component * 0.20
            + sleep_schedule_component * 0.20
        )
        habit_score_status = "full_pdf_weighted_score"

    # -------------------------
    # Daily platform activity for selected date range
    # -------------------------
    daily = defaultdict(lambda: {
        "alarm_triggered": 0,
        "wake_up_completed": 0,
        "snoozed": 0,
        "challenge_answered": 0,
    })

    for event in behavior_documents:
        timestamp = event.get("timestamp")
        day_value = event_date(timestamp)
        if not day_value:
            continue

        key = day_value.isoformat()
        event_type = event.get("event_type")

        if event_type == "alarm_triggered":
            daily[key]["alarm_triggered"] += 1
        elif event_type == "wake_up_completed":
            daily[key]["wake_up_completed"] += 1
        elif event_type == "alarm_snoozed":
            daily[key]["snoozed"] += 1
        elif event_type == "challenge_answered":
            daily[key]["challenge_answered"] += 1

    daily_activity = []
    current_day = selected_start
    while current_day <= selected_end:
        key = current_day.isoformat()
        row = daily[key]
        daily_activity.append({
            "date": key,
            "alarm_triggered": row["alarm_triggered"],
            "wake_up_completed": row["wake_up_completed"],
            "snoozed": row["snoozed"],
            "challenge_answered": row["challenge_answered"],
        })
        current_day += timedelta(days=1)

    # -------------------------
    # Challenge performance by type and difficulty
    # -------------------------
    challenge_lookup = {
        challenge.id: challenge
        for challenge in db.query(Challenge).all()
    }

    challenge_type_order = [
        "math", "logic", "memory", "word", "pattern", "riddle", "quiz"
    ]
    difficulty_order = ["easy", "medium", "hard"]

    performance_by_type = {
        challenge_type: {"total": 0, "correct": 0, "accuracy": 0}
        for challenge_type in challenge_type_order
    }
    performance_by_difficulty = {
        difficulty: {"total": 0, "correct": 0, "accuracy": 0}
        for difficulty in difficulty_order
    }

    for result in challenge_results:
        challenge = challenge_lookup.get(result.challenge_id)
        if not challenge:
            continue

        challenge_type = challenge.challenge_type
        difficulty = challenge.difficulty

        type_stats = performance_by_type.setdefault(
            challenge_type, {"total": 0, "correct": 0, "accuracy": 0}
        )
        type_stats["total"] += 1
        if result.is_correct:
            type_stats["correct"] += 1

        difficulty_stats = performance_by_difficulty.setdefault(
            difficulty, {"total": 0, "correct": 0, "accuracy": 0}
        )
        difficulty_stats["total"] += 1
        if result.is_correct:
            difficulty_stats["correct"] += 1

    for stats in performance_by_type.values():
        stats["accuracy"] = (
            round((stats["correct"] / stats["total"]) * 100, 2)
            if stats["total"] else 0
        )

    for stats in performance_by_difficulty.values():
        stats["accuracy"] = (
            round((stats["correct"] / stats["total"]) * 100, 2)
            if stats["total"] else 0
        )

    return {
        "selected_start_date": selected_start.isoformat(),
        "selected_end_date": selected_end.isoformat(),
        "total_users": total_users,
        "total_alarms": total_alarms,
        "total_challenges": total_challenges,
        "challenge_accuracy_percentage": round(challenge_accuracy, 2),
        "alarm_trigger_count": alarm_triggered,
        "wake_up_completed_count": wake_up_completed,
        "wake_up_success_rate_percentage": round(wake_up_success_rate, 2),
        "snooze_count": snoozed,
        "snooze_rate_percentage": round(snooze_rate, 2),
        "platform_habit_score": round(platform_habit_score, 2),
        "habit_score_status": habit_score_status,
        "sleep_schedule_adherence_proxy": (
            round(sleep_schedule_component, 2)
            if sleep_schedule_component is not None else None
        ),
        "total_recommendations": total_recommendations,
        "daily_activity": daily_activity,
        "performance_by_type": performance_by_type,
        "performance_by_difficulty": performance_by_difficulty,
    }


# =========================================================
# ADMIN - RECOMMENDATION MONITORING
# =========================================================

@app.get("/admin/recommendations")
def get_admin_recommendations(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Return platform-wide recommendation monitoring data for Admin."""
    from collections import defaultdict

    today = date.today()
    try:
        selected_start = date.fromisoformat(start_date) if start_date else today.replace(day=1)
        requested_end = date.fromisoformat(end_date) if end_date else today
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="start_date and end_date must use YYYY-MM-DD format",
        )

    if selected_start > today:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be in the future",
        )

    selected_end = min(requested_end, today)

    if selected_start > selected_end:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be after end_date",
        )

    recommendations = (
        db.query(Recommendation)
        .order_by(Recommendation.created_at.desc())
        .all()
    )

    users = {user.id: user for user in db.query(User).all()}
    period_recommendations = []
    daily_counts = defaultdict(int)
    active_coaches = set()
    covered_users = set()

    for rec in recommendations:
        created_value = rec.created_at
        if not created_value:
            continue

        if hasattr(created_value, "date"):
            created_date = created_value.date()
        else:
            try:
                created_date = date.fromisoformat(str(created_value)[:10])
            except ValueError:
                continue

        if not (selected_start <= created_date <= selected_end):
            continue

        user = users.get(rec.user_id)
        coach = users.get(rec.coach_id)
        period_recommendations.append({
            "recommendation_id": rec.id,
            "user_id": rec.user_id,
            "user_name": user.name if user else None,
            "user_email": user.email if user else None,
            "coach_id": rec.coach_id,
            "coach_name": coach.name if coach else None,
            "coach_email": coach.email if coach else None,
            "recommendation": rec.recommendation,
            "created_at": str(rec.created_at),
        })
        daily_counts[created_date.isoformat()] += 1
        active_coaches.add(rec.coach_id)
        covered_users.add(rec.user_id)

    daily_activity = []
    current_day = selected_start
    while current_day <= selected_end:
        key = current_day.isoformat()
        daily_activity.append({
            "date": key,
            "count": daily_counts[key],
        })
        current_day += timedelta(days=1)

    return {
        "selected_start_date": selected_start.isoformat(),
        "selected_end_date": selected_end.isoformat(),
        "total_recommendations": len(recommendations),
        "period_recommendations": len(period_recommendations),
        "active_coaches": len(active_coaches),
        "users_covered": len(covered_users),
        "daily_activity": daily_activity,
        "recommendations": period_recommendations,
    }


# =========================================================
# MILESTONE 4 - REPORTS & EXPORT
# =========================================================

@app.get("/admin/reports/pdf")
def export_admin_report_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Generate a PDF executive analytics report from current database data."""
    analytics = get_admin_executive_analytics(
        start_date=start_date,
        end_date=end_date,
        current_user=current_user,
        db=db,
    )

    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"PDF report dependency is missing: {exc}. Install reportlab."
        )

    output = BytesIO()
    doc = SimpleDocTemplate(
        output, pagesize=A4, rightMargin=36, leftMargin=36,
        topMargin=36, bottomMargin=36,
        title="Intelligent Cognitive Alarm - Executive Analytics Report",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle", parent=styles["Title"],
        alignment=TA_CENTER, spaceAfter=12,
    )
    heading_style = ParagraphStyle(
        "ReportHeading", parent=styles["Heading2"],
        spaceBefore=12, spaceAfter=8,
    )

    story = [
        Paragraph("INTELLIGENT COGNITIVE ALARM PLATFORM", title_style),
        Paragraph("M4 Executive Analytics Report", styles["Heading2"]),
        Paragraph(
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            styles["Normal"],
        ),
        Spacer(1, 14),
    ]

    summary_rows = [
        ["Metric", "Value"],
        ["Total Users", str(analytics["total_users"])],
        ["Total Alarms", str(analytics["total_alarms"])],
        ["Alarm Triggers", str(analytics["alarm_trigger_count"])],
        ["Wake-Up Completed", str(analytics["wake_up_completed_count"])],
        ["Wake-Up Success", f'{analytics["wake_up_success_rate_percentage"]}%'],
        ["Snooze Count", str(analytics["snooze_count"])],
        ["Snooze Rate", f'{analytics["snooze_rate_percentage"]}%'],
        ["Challenge Attempts", str(analytics["total_challenges"])],
        ["Challenge Accuracy", f'{analytics["challenge_accuracy_percentage"]}%'],
        ["Platform Habit Score", str(analytics["platform_habit_score"])],
        ["Recommendation Records", str(analytics["total_recommendations"])],
    ]

    story.append(Paragraph("1. Executive Summary", heading_style))
    table = Table(summary_rows, colWidths=[260, 180])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("PADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(table)

    story.append(Paragraph("2. Challenge Performance by Type", heading_style))
    type_rows = [["Challenge Type", "Attempts", "Correct", "Accuracy"]]
    for challenge_type, stats in analytics["performance_by_type"].items():
        type_rows.append([
            challenge_type.title(), str(stats["total"]),
            str(stats["correct"]), f'{stats["accuracy"]}%',
        ])
    type_table = Table(type_rows, colWidths=[180, 100, 100, 100])
    type_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(type_table)

    story.append(Paragraph("3. Challenge Performance by Difficulty", heading_style))
    difficulty_rows = [["Difficulty", "Attempts", "Correct", "Accuracy"]]
    for difficulty in ["easy", "medium", "hard"]:
        stats = analytics["performance_by_difficulty"].get(
            difficulty, {"total": 0, "correct": 0, "accuracy": 0}
        )
        difficulty_rows.append([
            difficulty.title(), str(stats["total"]),
            str(stats["correct"]), f'{stats["accuracy"]}%',
        ])
    difficulty_table = Table(difficulty_rows, colWidths=[180, 100, 100, 100])
    difficulty_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(difficulty_table)

    story.append(PageBreak())
    story.append(
        Paragraph(
            f"4. Daily Activity - {analytics['selected_start_date']} to {analytics['selected_end_date']}",
            heading_style,
        )
    )
    daily_rows = [["Date", "Alarms", "Wake-Ups", "Snoozes", "Challenges"]]
    for row in analytics["daily_activity"]:
        daily_rows.append([
            row["date"], str(row["alarm_triggered"]),
            str(row["wake_up_completed"]), str(row["snoozed"]),
            str(row["challenge_answered"]),
        ])
    daily_table = Table(daily_rows, colWidths=[100, 85, 85, 85, 85])
    daily_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(daily_table)
    story.append(Spacer(1, 14))
    story.append(Paragraph(
        f'Habit score status: {analytics["habit_score_status"]}',
        styles["Normal"],
    ))

    doc.build(story)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="cognitive_alarm_executive_report_'
                f'{analytics["selected_start_date"]}_to_{analytics["selected_end_date"]}.pdf"'
            )
        },
    )


@app.get("/admin/reports/excel")
def export_admin_report_excel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Generate an Excel analytics workbook from current database data."""
    analytics = get_admin_executive_analytics(
        start_date=start_date,
        end_date=end_date,
        current_user=current_user,
        db=db,
    )

    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Excel report dependency is missing: {exc}. Install openpyxl."
        )

    output = BytesIO()
    workbook = Workbook()
    header_fill = PatternFill("solid", fgColor="6366F1")
    header_font = Font(color="FFFFFF", bold=True)

    sheet = workbook.active
    sheet.title = "Executive Summary"
    sheet.append(["Metric", "Value"])
    summary = [
        ("Total Users", analytics["total_users"]),
        ("Total Alarms", analytics["total_alarms"]),
        ("Alarm Triggers", analytics["alarm_trigger_count"]),
        ("Wake-Up Completed", analytics["wake_up_completed_count"]),
        ("Wake-Up Success (%)", analytics["wake_up_success_rate_percentage"]),
        ("Snooze Count", analytics["snooze_count"]),
        ("Snooze Rate (%)", analytics["snooze_rate_percentage"]),
        ("Challenge Attempts", analytics["total_challenges"]),
        ("Challenge Accuracy (%)", analytics["challenge_accuracy_percentage"]),
        ("Platform Habit Score", analytics["platform_habit_score"]),
        ("Recommendation Records", analytics["total_recommendations"]),
    ]
    for row in summary:
        sheet.append(list(row))

    daily_sheet = workbook.create_sheet("Daily Activity")
    daily_sheet.append(["Date", "Alarms", "Wake-Ups", "Snoozes", "Challenges"])
    for row in analytics["daily_activity"]:
        daily_sheet.append([
            row["date"], row["alarm_triggered"], row["wake_up_completed"],
            row["snoozed"], row["challenge_answered"],
        ])

    type_sheet = workbook.create_sheet("Challenge by Type")
    type_sheet.append(["Challenge Type", "Attempts", "Correct", "Accuracy (%)"])
    for challenge_type, stats in analytics["performance_by_type"].items():
        type_sheet.append([
            challenge_type.title(), stats["total"],
            stats["correct"], stats["accuracy"],
        ])

    difficulty_sheet = workbook.create_sheet("Challenge by Difficulty")
    difficulty_sheet.append(["Difficulty", "Attempts", "Correct", "Accuracy (%)"])
    for difficulty in ["easy", "medium", "hard"]:
        stats = analytics["performance_by_difficulty"].get(
            difficulty, {"total": 0, "correct": 0, "accuracy": 0}
        )
        difficulty_sheet.append([
            difficulty.title(), stats["total"],
            stats["correct"], stats["accuracy"],
        ])

    for ws in workbook.worksheets:
        ws.freeze_panes = "A2"
        for cell in ws[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")
        for column_cells in ws.columns:
            max_length = max(
                len(str(cell.value)) if cell.value is not None else 0
                for cell in column_cells
            )
            ws.column_dimensions[column_cells[0].column_letter].width = min(
                max(max_length + 2, 12), 32
            )

    workbook.save(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                f'attachment; filename="cognitive_alarm_executive_report_'
                f'{analytics["selected_start_date"]}_to_{analytics["selected_end_date"]}.xlsx"'
            )
        },
    )


def _coach_user_analytics(
    user_id: int,
    db: Session,
    period: str = "monthly",
    anchor_date: Optional[str] = None,
):
    """Build analytics for a specific user for a selected historical period."""
    today = date.today()
    try:
        anchor = date.fromisoformat(anchor_date) if anchor_date else today
    except ValueError:
        raise HTTPException(status_code=400, detail="anchor_date must be YYYY-MM-DD")

    if anchor > today:
        raise HTTPException(status_code=400, detail="anchor_date cannot be in the future")

    if period == "daily":
        range_start = anchor
        range_end = anchor
        period_label = anchor.strftime("%d %b %Y")
    elif period == "weekly":
        range_start = anchor - timedelta(days=anchor.weekday())
        range_end = min(range_start + timedelta(days=6), today)
        period_label = f"{range_start.strftime('%d %b %Y')} – {range_end.strftime('%d %b %Y')}"
    elif period == "monthly":
        range_start = anchor.replace(day=1)
        next_month = (
            date(range_start.year + 1, 1, 1)
            if range_start.month == 12
            else date(range_start.year, range_start.month + 1, 1)
        )
        range_end = min(next_month - timedelta(days=1), today)
        period_label = anchor.strftime("%B %Y")
    else:
        raise HTTPException(status_code=400, detail="Unsupported coach analytics period")

    all_results = (
        db.query(ChallengeResult)
        .filter(ChallengeResult.user_id == user_id)
        .order_by(ChallengeResult.completed_at.asc())
        .all()
    )
    results = []
    for result in all_results:
        if result.completed_at is None:
            continue
        try:
            result_date = result.completed_at.date()
        except AttributeError:
            result_date = date.fromisoformat(str(result.completed_at)[:10])
        if range_start <= result_date <= range_end:
            results.append(result)

    total = len(results)
    correct = sum(1 for result in results if result.is_correct)
    accuracy = round((correct / total) * 100, 2) if total else 0
    times = [r.time_taken for r in results if r.time_taken is not None]
    average_time = round(sum(times) / len(times), 2) if times else 0
    attempts = [r.attempts if r.attempts else 1 for r in results]
    average_attempts = round(sum(attempts) / len(attempts), 2) if attempts else 0

    performance_by_type = {}
    performance_by_difficulty = {}
    daily_challenges = {}
    challenge_cache = {}

    for result in results:
        challenge = challenge_cache.get(result.challenge_id)
        if challenge is None:
            challenge = db.query(Challenge).filter(
                Challenge.id == result.challenge_id
            ).first()
            challenge_cache[result.challenge_id] = challenge
        if not challenge:
            continue

        challenge_type = challenge.challenge_type or "unknown"
        type_stats = performance_by_type.setdefault(
            challenge_type, {"total": 0, "correct": 0, "accuracy": 0}
        )
        type_stats["total"] += 1
        if result.is_correct:
            type_stats["correct"] += 1

        difficulty = (challenge.difficulty or "unknown").lower()
        diff_stats = performance_by_difficulty.setdefault(
            difficulty, {"total": 0, "correct": 0, "accuracy": 0}
        )
        diff_stats["total"] += 1
        if result.is_correct:
            diff_stats["correct"] += 1

        day = result.completed_at.strftime("%Y-%m-%d")
        row = daily_challenges.setdefault(day, {"total": 0, "correct": 0})
        row["total"] += 1
        if result.is_correct:
            row["correct"] += 1

    for stats in performance_by_type.values():
        stats["accuracy"] = round(
            stats["correct"] / stats["total"] * 100, 2
        ) if stats["total"] else 0
    for stats in performance_by_difficulty.values():
        stats["accuracy"] = round(
            stats["correct"] / stats["total"] * 100, 2
        ) if stats["total"] else 0

    strongest = max(
        performance_by_type,
        key=lambda x: performance_by_type[x]["accuracy"],
        default=None,
    )
    weakest = min(
        performance_by_type,
        key=lambda x: performance_by_type[x]["accuracy"],
        default=None,
    )

    behavior_documents = list(
        behavior_events.find({"user_id": user_id}, {"_id": 0})
    )
    selected_behavior = []
    for event in behavior_documents:
        timestamp = event.get("timestamp")
        if not timestamp:
            continue
        try:
            event_date = (
                timestamp.date()
                if isinstance(timestamp, datetime)
                else datetime.fromisoformat(
                    str(timestamp).replace("Z", "+00:00")
                ).date()
            )
        except Exception:
            continue
        if range_start <= event_date <= range_end:
            selected_behavior.append(event)

    alarm_count = sum(
        1 for e in selected_behavior if e.get("event_type") == "alarm_triggered"
    )
    wake_count = sum(
        1 for e in selected_behavior if e.get("event_type") == "wake_up_completed"
    )
    snooze_count = sum(
        1 for e in selected_behavior if e.get("event_type") == "alarm_snoozed"
    )
    wake_consistency = round(
        wake_count / alarm_count * 100, 2
    ) if alarm_count else 0

    accuracy_score = accuracy
    speed_score = max(
        0, min(100, 100 - ((average_time - 10) * 2))
    ) if average_time else 50
    recent = results[-10:]
    recent_correct = sum(1 for r in recent if r.is_correct)
    consistency_score = recent_correct / len(recent) * 100 if recent else 0
    attempt_score = max(
        0, min(100, 100 - ((average_attempts - 1) * 30))
    ) if average_attempts else 50
    performance_score = accuracy_score * 0.7 + attempt_score * 0.3
    habit_score = round(
        accuracy_score * 0.40
        + speed_score * 0.20
        + consistency_score * 0.25
        + performance_score * 0.15,
        2,
    ) if total else 0

    behavior_by_day = {}
    for event in selected_behavior:
        timestamp = event.get("timestamp")
        try:
            event_date = (
                timestamp.date()
                if isinstance(timestamp, datetime)
                else datetime.fromisoformat(
                    str(timestamp).replace("Z", "+00:00")
                ).date()
            )
        except Exception:
            continue

        day = event_date.strftime("%Y-%m-%d")
        row = behavior_by_day.setdefault(
            day,
            {
                "alarm_triggered": 0,
                "wake_up_completed": 0,
                "snoozed": 0,
                "challenge_answered": 0,
            },
        )
        event_type = event.get("event_type")
        if event_type == "alarm_triggered":
            row["alarm_triggered"] += 1
        elif event_type == "wake_up_completed":
            row["wake_up_completed"] += 1
        elif event_type == "alarm_snoozed":
            row["snoozed"] += 1
        elif event_type == "challenge_answered":
            row["challenge_answered"] += 1

    daily_activity = []
    day_value = range_start
    while day_value <= range_end:
        day = day_value.strftime("%Y-%m-%d")
        behavior = behavior_by_day.get(
            day,
            {
                "alarm_triggered": 0,
                "wake_up_completed": 0,
                "snoozed": 0,
                "challenge_answered": 0,
            },
        )
        challenge_day = daily_challenges.get(
            day, {"total": 0, "correct": 0}
        )
        day_accuracy = round(
            challenge_day["correct"] / challenge_day["total"] * 100, 2
        ) if challenge_day["total"] else 0
        day_wake = round(
            behavior["wake_up_completed"] / behavior["alarm_triggered"] * 100, 2
        ) if behavior["alarm_triggered"] else 0
        daily_activity.append({
            "date": day,
            **behavior,
            "wake_up_consistency": day_wake,
            "challenge_accuracy": day_accuracy,
        })
        day_value += timedelta(days=1)

    # Sleep & wake trend based on real alarm/wake event timestamps.
    # This does not invent sleep-duration history; it only compares the
    # recorded alarm trigger time with the recorded wake-up completion time.
    sleep_wake_by_day = {}
    for event in selected_behavior:
        event_type = event.get("event_type")
        if event_type not in {"alarm_triggered", "wake_up_completed"}:
            continue

        timestamp = event.get("timestamp")
        try:
            if isinstance(timestamp, datetime):
                event_dt = timestamp
            else:
                event_dt = datetime.fromisoformat(
                    str(timestamp).replace("Z", "+00:00")
                )
        except Exception:
            continue

        day = event_dt.date().strftime("%Y-%m-%d")
        row = sleep_wake_by_day.setdefault(
            day, {"alarm_dt": None, "wake_dt": None}
        )
        if event_type == "alarm_triggered":
            if row["alarm_dt"] is None or event_dt < row["alarm_dt"]:
                row["alarm_dt"] = event_dt
        else:
            if row["wake_dt"] is None or event_dt < row["wake_dt"]:
                row["wake_dt"] = event_dt

    sleep_wake_trend = []
    for day_value in [
        range_start + timedelta(days=i)
        for i in range((range_end - range_start).days + 1)
    ]:
        day = day_value.strftime("%Y-%m-%d")
        row = sleep_wake_by_day.get(
            day, {"alarm_dt": None, "wake_dt": None}
        )
        alarm_dt = row["alarm_dt"]
        wake_dt = row["wake_dt"]
        delay_minutes = None
        if alarm_dt and wake_dt:
            delay = (wake_dt - alarm_dt).total_seconds() / 60
            if 0 <= delay <= 720:
                delay_minutes = round(delay, 2)

        sleep_wake_trend.append({
            "date": day,
            "alarm_time": alarm_dt.strftime("%H:%M") if alarm_dt else None,
            "wake_up_time": wake_dt.strftime("%H:%M") if wake_dt else None,
            "wake_up_delay_minutes": delay_minutes,
            "wake_up_consistency": next(
                (item["wake_up_consistency"] for item in daily_activity if item["date"] == day),
                0,
            ),
        })

    # Latest coach recommendation for this selected user.
    latest_recommendation = (
        db.query(Recommendation)
        .filter(Recommendation.user_id == user_id)
        .order_by(Recommendation.created_at.desc())
        .first()
    )

    return {
        "user_id": user_id,
        "period": period,
        "period_label": period_label,
        "range_start": range_start.isoformat(),
        "range_end": range_end.isoformat(),
        "habit_score": habit_score,
        "challenge_accuracy": accuracy,
        "average_time_seconds": average_time,
        "average_attempts": average_attempts,
        "wake_up_consistency": wake_consistency,
        "alarm_count": alarm_count,
        "wake_up_count": wake_count,
        "snooze_count": snooze_count,
        "strongest_challenge_type": strongest,
        "weakest_challenge_type": weakest,
        "performance_by_type": performance_by_type,
        "performance_by_difficulty": performance_by_difficulty,
        "daily_activity": daily_activity,
        "sleep_wake_trend": sleep_wake_trend,
        "progress_monitoring": {
            "current": {
                "habit_score": habit_score,
                "wake_up_consistency": wake_consistency,
                "challenge_accuracy": accuracy,
                "average_time_seconds": average_time,
                "average_attempts": average_attempts,
            },
            "daily": [
                {
                    "date": item["date"],
                    "wake_up_consistency": item["wake_up_consistency"],
                    "challenge_accuracy": item["challenge_accuracy"],
                    "activity_count": (
                        item["alarm_triggered"]
                        + item["wake_up_completed"]
                        + item["snoozed"]
                        + item["challenge_answered"]
                    ),
                }
                for item in daily_activity
            ],
        },
        "latest_recommendation": (
            {
                "recommendation": latest_recommendation.recommendation,
                "created_at": str(latest_recommendation.created_at)
                if latest_recommendation.created_at
                else None,
                "coach_id": latest_recommendation.coach_id,
            }
            if latest_recommendation
            else None
        ),
    }


@app.get("/coach/users/{user_id}/analytics")
def get_coach_user_analytics(
    user_id: int,
    period: Literal["daily", "weekly", "monthly"] = "monthly",
    anchor_date: Optional[str] = None,
    current_user: dict = Depends(require_coach),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(
        User.id == user_id, User.role == "user"
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _coach_user_analytics(
        user_id, db, period=period, anchor_date=anchor_date
    )


@app.get("/coach/analytics/overview")
def get_coach_analytics_overview(
    current_user: dict = Depends(require_coach),
    db: Session = Depends(get_db),
):
    users = db.query(User).filter(User.role == "user").all()
    summaries = []
    for user in users:
        analytics = _coach_user_analytics(user.id, db)
        summaries.append({
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "habit_score": analytics["habit_score"],
            "wake_up_consistency": analytics["wake_up_consistency"],
            "challenge_accuracy": analytics["challenge_accuracy"],
        })

    average = lambda key: round(
        sum(float(item[key]) for item in summaries) / len(summaries), 2
    ) if summaries else 0

    attention = [
        item for item in summaries
        if item["habit_score"] < 60
        or item["wake_up_consistency"] < 60
        or item["challenge_accuracy"] < 60
    ]

    return {
        "total_users": len(summaries),
        "average_habit_score": average("habit_score"),
        "average_wake_up_consistency": average("wake_up_consistency"),
        "average_challenge_accuracy": average("challenge_accuracy"),
        "users_needing_attention": attention,
        "users": summaries,
    }

@app.get("/coach-test")
def coach_test(current_user: dict = Depends(require_coach)):
    return {"message": "Welcome Wellness Coach!", "user_id": current_user["user_id"], "email": current_user["email"], "role": current_user["role"]}

@app.get("/coach/users")
def get_users_for_coach(current_user: dict = Depends(require_coach), db: Session = Depends(get_db)):
    users = db.query(User).filter(User.role == "user").all()
    return [{"user_id": user.id, "name": user.name, "email": user.email} for user in users]

@app.get("/coach/users/{user_id}/profile")
def get_user_profile_for_coach(
    user_id: int,
    current_user: dict = Depends(require_coach),
    db: Session = Depends(get_db)
):
    # The user account must exist, but a profile is optional.
    # This allows Coaches to view analytics for users who have not
    # completed their profile yet.
    user = db.query(User).filter(
        User.id == user_id,
        User.role == "user"
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile = db.query(UserProfile).filter(
        UserProfile.user_id == user_id
    ).first()

    if not profile:
        return {
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "preferred_wake_up_time": None,
            "sleep_duration": None,
            "time_zone": None,
            "productivity_goal": None,
            "difficulty_preference": "Medium",
            "habit_preferences": None,
            "profile_completed": False,
        }

    return {
        "user_id": profile.user_id,
        "name": user.name,
        "email": user.email,
        "preferred_wake_up_time": (
            str(profile.preferred_wake_up_time)
            if profile.preferred_wake_up_time else None
        ),
        "sleep_duration": profile.sleep_duration,
        "time_zone": profile.time_zone,
        "productivity_goal": profile.productivity_goal,
        "difficulty_preference": profile.difficulty_preference,
        "habit_preferences": profile.habit_preferences,
        "profile_completed": True,
    }

@app.post("/coach/users/{user_id}/recommendation")
def add_recommendation(user_id: int, recommendation: str, current_user: dict = Depends(require_coach), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id, User.role == "user").first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_recommendation = Recommendation(user_id=user_id, coach_id=current_user["user_id"], recommendation=recommendation)
    db.add(new_recommendation)
    db.commit()
    db.refresh(new_recommendation)

    coach = db.query(User).filter(
        User.id == current_user["user_id"]
    ).first()

    # Notify the user who received the recommendation.
    create_in_app_notification(
        db,
        user.id,
        "New recommendation",
        f"{coach.name if coach else 'Your coach'} sent you a new recommendation.",
        "recommendation",
    )

    # Notify admins so Recommendation Monitoring has a real-time activity signal.
    admin_users = db.query(User).filter(User.role == "admin").all()
    for admin in admin_users:
        create_in_app_notification(
            db,
            admin.id,
            "New recommendation created",
            f"A coach sent a recommendation to {user.name}.",
            "recommendation",
        )

    return {
        "message": "Recommendation saved successfully",
        "recommendation_id": new_recommendation.id,
        "user_id": user_id,
        "coach_id": current_user["user_id"],
        "recommendation": new_recommendation.recommendation,
    }

@app.get("/recommendations")
def get_my_recommendations(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    recommendations = db.query(Recommendation).filter(Recommendation.user_id == current_user["user_id"]).order_by(Recommendation.created_at.desc()).all()
    return [{"recommendation_id": rec.id, "coach_id": rec.coach_id, "recommendation": rec.recommendation, "created_at": str(rec.created_at)} for rec in recommendations]


@app.get("/coach/users/{user_id}/recommendations")
def get_coach_user_recommendations(
    user_id: int,
    current_user: dict = Depends(require_coach),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id, User.role == "user").first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    recommendations = (
        db.query(Recommendation)
        .filter(Recommendation.user_id == user_id)
        .order_by(Recommendation.created_at.desc())
        .all()
    )
    return [
        {
            "recommendation_id": rec.id,
            "coach_id": rec.coach_id,
            "recommendation": rec.recommendation,
            "created_at": str(rec.created_at),
        }
        for rec in recommendations
    ]


@app.delete("/coach/users/{user_id}/recommendations/{recommendation_id}")
def delete_coach_user_recommendation(
    user_id: int,
    recommendation_id: int,
    current_user: dict = Depends(require_coach),
    db: Session = Depends(get_db),
):
    recommendation = db.query(Recommendation).filter(
        Recommendation.id == recommendation_id,
        Recommendation.user_id == user_id,
    ).first()

    if not recommendation:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    db.delete(recommendation)
    db.commit()
    return {"message": "Recommendation deleted successfully", "recommendation_id": recommendation_id}


@app.post("/profile")
def create_profile(profile: UserProfileCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    existing_profile = db.query(UserProfile).filter(
        UserProfile.user_id == current_user["user_id"]
    ).first()
    if existing_profile:
        raise HTTPException(status_code=400, detail="Profile already exists")

    new_profile = UserProfile(
        user_id=current_user["user_id"],
        preferred_wake_up_time=profile.preferred_wake_up_time,
        sleep_duration=profile.sleep_duration,
        time_zone=profile.time_zone,
        productivity_goal=profile.productivity_goal,
        difficulty_preference=profile.difficulty_preference,
        habit_preferences=profile.habit_preferences,
    )
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)
    return {
        "message": "Profile created successfully",
        "profile_id": new_profile.id,
        "user_id": new_profile.user_id,
    }


@app.put("/profile")
def update_profile(
    profile: UserProfileCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing_profile = db.query(UserProfile).filter(
        UserProfile.user_id == current_user["user_id"]
    ).first()

    if not existing_profile:
        existing_profile = UserProfile(user_id=current_user["user_id"])
        db.add(existing_profile)

    existing_profile.preferred_wake_up_time = profile.preferred_wake_up_time
    existing_profile.sleep_duration = profile.sleep_duration
    existing_profile.time_zone = profile.time_zone
    existing_profile.productivity_goal = profile.productivity_goal
    existing_profile.difficulty_preference = profile.difficulty_preference
    existing_profile.habit_preferences = profile.habit_preferences

    db.commit()
    db.refresh(existing_profile)

    return {
        "message": "Profile saved successfully",
        "profile_id": existing_profile.id,
        "user_id": existing_profile.user_id,
    }

@app.post("/alarms")
def create_alarm(
    alarm: AlarmCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Custom repetition requires at least one selected day
    if alarm.repeat_type == "custom" and not alarm.repeat_days:
        raise HTTPException(
            status_code=400,
            detail="Select at least one day for custom repetition"
        )

    new_alarm = Alarm(
        user_id=current_user["user_id"],
        alarm_time=alarm.alarm_time,
        alarm_name=alarm.alarm_name,
        is_active=alarm.is_active,
        repeat_type=alarm.repeat_type,
        repeat_days=json.dumps(alarm.repeat_days)
    )

    db.add(new_alarm)
    db.commit()
    db.refresh(new_alarm)

    log_behavior_event(
        user_id=current_user["user_id"],
        event_type="alarm_created",
        event_data={
            "alarm_id": new_alarm.id,
            "alarm_name": new_alarm.alarm_name,
            "alarm_time": str(new_alarm.alarm_time),
            "is_active": new_alarm.is_active,
            "repeat_type": new_alarm.repeat_type,
            "repeat_days": alarm.repeat_days
        }
    )

    return {
        "message": "Alarm created successfully",
        "alarm_id": new_alarm.id,
        "user_id": new_alarm.user_id,
        "alarm_time": str(new_alarm.alarm_time),
        "alarm_name": new_alarm.alarm_name,
        "is_active": new_alarm.is_active,
        "repeat_type": new_alarm.repeat_type,
        "repeat_days": alarm.repeat_days
    }


@app.get("/alarms")
def get_alarms(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    alarms = db.query(Alarm).filter(
        Alarm.user_id == current_user["user_id"]
    ).all()

    result = []

    for alarm in alarms:
        try:
            repeat_days = json.loads(alarm.repeat_days or "[]")
        except Exception:
            repeat_days = []

        result.append({
            "alarm_id": alarm.id,
            "alarm_time": str(alarm.alarm_time),
            "alarm_name": alarm.alarm_name,
            "is_active": alarm.is_active,
            "repeat_type": alarm.repeat_type or "daily",
            "repeat_days": repeat_days
        })

    return result


@app.delete("/alarms/{alarm_id}")
def delete_alarm(alarm_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    alarm = db.query(Alarm).filter(Alarm.id == alarm_id, Alarm.user_id == current_user["user_id"]).first()
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")
    db.delete(alarm)
    db.commit()

    log_behavior_event(
        user_id=current_user["user_id"],
        event_type="alarm_deleted",
        event_data={"alarm_id": alarm_id}
    )

    return {"message": "Alarm deleted successfully", "alarm_id": alarm_id}

@app.put("/alarms/{alarm_id}")
def update_alarm(
    alarm_id: int,
    alarm: AlarmCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing_alarm = db.query(Alarm).filter(
        Alarm.id == alarm_id,
        Alarm.user_id == current_user["user_id"]
    ).first()

    if not existing_alarm:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found"
        )

    # Custom repetition requires at least one selected day
    if alarm.repeat_type == "custom" and not alarm.repeat_days:
        raise HTTPException(
            status_code=400,
            detail="Select at least one day for custom repetition"
        )

    existing_alarm.alarm_time = alarm.alarm_time
    existing_alarm.alarm_name = alarm.alarm_name
    existing_alarm.is_active = alarm.is_active
    existing_alarm.repeat_type = alarm.repeat_type
    existing_alarm.repeat_days = json.dumps(alarm.repeat_days)

    db.commit()
    db.refresh(existing_alarm)

    log_behavior_event(
        user_id=current_user["user_id"],
        event_type="alarm_updated",
        event_data={
            "alarm_id": existing_alarm.id,
            "alarm_name": existing_alarm.alarm_name,
            "alarm_time": str(existing_alarm.alarm_time),
            "is_active": existing_alarm.is_active,
            "repeat_type": existing_alarm.repeat_type,
            "repeat_days": alarm.repeat_days
        }
    )

    return {
        "message": "Alarm updated successfully",
        "alarm_id": existing_alarm.id,
        "alarm_time": str(existing_alarm.alarm_time),
        "alarm_name": existing_alarm.alarm_name,
        "is_active": existing_alarm.is_active,
        "repeat_type": existing_alarm.repeat_type,
        "repeat_days": alarm.repeat_days
    }


# =========================================================
# MILESTONE 2 - COGNITIVE CHALLENGE ENGINE
# =========================================================

import random


# =========================================================
# MILESTONE 2 - PUZZLE GENERATION WORKFLOWS
# Difficulty-aware challenge generators
# =========================================================

def generate_math_challenge(difficulty: str):
    difficulty = difficulty.lower()

    # EASY: multi-step arithmetic with simple parentheses
    if difficulty == "easy":
        choice = random.choice([
            "multiply_add", "multiply_subtract",
            "add_multiply", "subtract_multiply"
        ])

        if choice == "multiply_add":
            a = random.randint(10, 20)
            b = random.randint(6, 12)
            c = random.randint(15, 40)
            answer = (a * b) + c
            question = f"Solve: ({a} × {b}) + {c}"

        elif choice == "multiply_subtract":
            a = random.randint(12, 20)
            b = random.randint(6, 12)
            c = random.randint(10, 40)
            answer = (a * b) - c
            question = f"Solve: ({a} × {b}) - {c}"

        elif choice == "add_multiply":
            a = random.randint(8, 20)
            b = random.randint(5, 15)
            c = random.randint(4, 9)
            answer = (a + b) * c
            question = f"Solve: ({a} + {b}) × {c}"

        else:
            a = random.randint(30, 70)
            b = random.randint(10, 25)
            c = random.randint(3, 8)
            answer = (a - b) * c
            question = f"Solve: ({a} - {b}) × {c}"

    # MEDIUM: nested parentheses and multiple operations
    elif difficulty == "medium":
        choice = random.choice([
            "nested_multiply", "nested_add",
            "nested_division", "double_group"
        ])

        if choice == "nested_multiply":
            a = random.randint(12, 20)
            b = random.randint(2, 6)
            c = random.randint(1, 4)
            d = random.randint(5, 9)
            e = random.randint(4, 8)
            answer = (a * (b + c)) - (d * e)
            question = f"Solve: ({a} × ({b} + {c})) - ({d} × {e})"

        elif choice == "nested_add":
            a = random.randint(10, 20)
            b = random.randint(2, 6)
            c = random.randint(3, 8)
            d = random.randint(5, 12)
            e = random.randint(2, 6)
            answer = (a + (b * c)) - (d + e)
            question = f"Solve: ({a} + ({b} × {c})) - ({d} + {e})"

        elif choice == "nested_division":
            divisor = random.randint(3, 8)
            quotient = random.randint(8, 18)
            a = divisor * quotient
            b = random.randint(4, 9)
            c = random.randint(2, 6)
            d = random.randint(10, 25)
            answer = (a // divisor) + (b * c) - d
            question = f"Solve: ({a} ÷ {divisor}) + ({b} × {c}) - {d}"

        else:
            a = random.randint(10, 20)
            b = random.randint(2, 6)
            c = random.randint(3, 8)
            d = random.randint(5, 12)
            e = random.randint(2, 7)
            f = random.randint(3, 8)
            answer = ((a + b) * c) - (d * e) + f
            question = f"Solve: (({a} + {b}) × {c}) - ({d} × {e}) + {f}"

    # HARD: several operations and multiple nested groups
    else:
        choice = random.choice([
            "complex_one", "complex_two", "complex_three"
        ])

        if choice == "complex_one":
            a = random.randint(12, 25)
            b = random.randint(3, 8)
            c = random.randint(2, 6)
            d = random.randint(8, 15)
            e = random.randint(4, 9)
            f = random.randint(2, 6)
            g = random.randint(10, 25)
            answer = ((a + b) * c) - (d * e) + (f * g)
            question = (
                f"Solve: (({a} + {b}) × {c}) - "
                f"({d} × {e}) + ({f} × {g})"
            )

        elif choice == "complex_two":
            divisor = random.randint(4, 9)
            quotient = random.randint(10, 20)
            a = divisor * quotient
            b = random.randint(8, 16)
            c = random.randint(2, 6)
            d = random.randint(5, 12)
            e = random.randint(3, 8)
            f = random.randint(2, 7)
            answer = (a // divisor) + ((b + c) * d) - (e * f)
            question = (
                f"Solve: ({a} ÷ {divisor}) + "
                f"(({b} + {c}) × {d}) - ({e} × {f})"
            )

        else:
            a = random.randint(10, 20)
            b = random.randint(3, 8)
            c = random.randint(2, 6)
            d = random.randint(4, 10)
            e = random.randint(5, 12)
            f = random.randint(2, 7)
            g = random.randint(3, 8)
            h = random.randint(5, 15)
            answer = ((a * b) + (c * d)) - ((e + f) * g) + h
            question = (
                f"Solve: (({a} × {b}) + ({c} × {d})) "
                f"- (({e} + {f}) × {g}) + {h}"
            )

    return question, str(answer)


def generate_logic_challenge(difficulty: str):
    difficulty = difficulty.lower()

    if difficulty == "easy":
        start = random.randint(1, 15)
        difference = random.randint(2, 6)
        sequence = [start + difference * i for i in range(4)]
        answer = sequence[-1] + difference
        question = "Find the next number in the sequence: " + ", ".join(map(str, sequence))

    elif difficulty == "medium":
        start = random.randint(2, 10)
        difference1 = random.randint(2, 5)
        difference2 = random.randint(6, 10)
        sequence = [
            start,
            start + difference1,
            start + difference1 + difference2,
            start + difference1 + difference2 + difference1
        ]
        answer = sequence[-1] + difference2
        question = "Find the next number in the sequence: " + ", ".join(map(str, sequence))

    else:
        start = random.randint(2, 8)
        multiplier = random.randint(2, 4)
        addition = random.randint(2, 8)
        sequence = [start]
        for _ in range(3):
            sequence.append(sequence[-1] * multiplier + addition)
        answer = sequence[-1] * multiplier + addition
        question = "Find the next number using the same rule: " + ", ".join(map(str, sequence))

    return question, str(answer)


def generate_memory_challenge(difficulty):
    if difficulty == "easy":
        length = 4
    elif difficulty == "medium":
        length = 6
    else:
        length = 8

    sequence = [random.randint(1, 9) for _ in range(length)]
    position = random.randint(1, length)

    question = (
        f"Remember this sequence: {' '.join(map(str, sequence))}. "
        f"What is the number at position {position}?"
    )
    return question, str(sequence[position - 1])


def generate_word_challenge(difficulty):
    word_data = {
        "easy": [
            ("TAC", "CAT"),
            ("GOD", "DOG"),
            ("RAT", "ART")
        ],
        "medium": [
            ("RTEAW", "WATER"),
            ("RAEHT", "HEART"),
            ("ELPPA", "APPLE"),
            ("NEPOH", "PHONE")
        ],
        "hard": [
            ("RETUCOMP", "COMPUTER"),
            ("GNINRAEL", "LEARNING"),
            ("NOITACILPPA", "APPLICATION"),
            ("NOITAVONNI", "INNOVATION"),
            ("ECNEICSATAD", "DATASCIENCE")
        ]
    }

    scrambled, answer = random.choice(word_data[difficulty])
    return f"Unscramble this word: {scrambled}", answer


def generate_pattern_challenge(difficulty):
    if difficulty == "easy":
        start = random.randint(1, 10)
        difference = random.randint(2, 6)
        numbers = [start + difference * i for i in range(4)]
        answer = numbers[-1] + difference

    elif difficulty == "medium":
        start = random.randint(2, 6)
        multiplier = random.randint(2, 4)
        numbers = [start * (multiplier ** i) for i in range(4)]
        answer = numbers[-1] * multiplier

    else:
        start = random.randint(2, 8)
        difference = random.randint(2, 5)
        numbers = [start + difference * (i ** 2) for i in range(4)]
        answer = start + difference * (4 ** 2)

    question = f"Find the next number: {', '.join(map(str, numbers))}, ?"
    return question, str(answer)


def generate_riddle_challenge(difficulty):
    riddles = {
        "easy": [
            ("I have hands but cannot clap. What am I?", "clock"),
            ("I have four legs but cannot walk. What am I?", "table"),
            ("I have a face and two hands but no arms. What am I?", "clock")
        ],
        "medium": [
            ("What gets wetter the more it dries?", "towel"),
            ("What has many keys but cannot open a single lock?", "piano"),
            ("What has a neck but no head?", "bottle")
        ],
        "hard": [
            ("The more you take, the more you leave behind. What am I?", "footsteps"),
            ("What can travel around the world while staying in one corner?", "stamp"),
            (
                "I speak without a mouth and hear without ears. "
                "I have no body, but I come alive with wind. What am I?",
                "echo"
            )
        ]
    }

    return random.choice(riddles[difficulty])


def generate_quiz_challenge(difficulty):
    quizzes = {
        "easy": [
            ("What is the capital of France?", "Paris", "Paris|London|Berlin|Madrid"),
            ("How many days are there in a week?", "7", "5|6|7|8"),
            ("Which planet is known as the Red Planet?", "Mars", "Earth|Mars|Venus|Jupiter")
        ],
        "medium": [
            (
                "Which programming language was created by Guido van Rossum?",
                "Python",
                "Java|Python|C++|Ruby"
            ),
            (
                "What is the largest ocean on Earth?",
                "Pacific Ocean",
                "Atlantic Ocean|Indian Ocean|Pacific Ocean|Arctic Ocean"
            ),
            (
                "Which data structure follows FIFO?",
                "Queue",
                "Stack|Queue|Tree|Graph"
            )
        ],
        "hard": [
            (
                "Which algorithm has average-case time complexity O(n log n) for sorting?",
                "Merge Sort",
                "Linear Search|Merge Sort|Bubble Sort|Selection Sort"
            ),
            (
                "What does ACID stand for in database systems?",
                "Atomicity, Consistency, Isolation, Durability",
                "Atomicity, Consistency, Isolation, Durability|Accuracy, Control, Integrity, Data|Access, Consistency, Index, Data|Atomic Control, Isolation, Database"
            ),
            (
                "Which machine learning technique is commonly used for dimensionality reduction?",
                "PCA",
                "PCA|KNN|Naive Bayes|Decision Tree"
            )
        ]
    }

    return random.choice(quizzes[difficulty])


# ---------------------------------------------------------
# Generate Challenge
# ---------------------------------------------------------

@app.post("/challenges/generate")
def generate_challenge(
    request: ChallengeRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    challenge_type = request.challenge_type.lower()
    difficulty = request.difficulty.lower()

    # Validate difficulty
    if difficulty not in ["easy", "medium", "hard"]:
        raise HTTPException(
            status_code=400,
            detail="Difficulty must be easy, medium, or hard"
        )

    # =====================================================
    # PUZZLE GENERATION WORKFLOW
    # =====================================================

    options = None

    if challenge_type == "math":
        question, correct_answer = generate_math_challenge(difficulty)

    elif challenge_type == "logic":
        question, correct_answer = generate_logic_challenge(difficulty)

    elif challenge_type == "memory":
        question, correct_answer = generate_memory_challenge(difficulty)

    elif challenge_type == "word":
        question, correct_answer = generate_word_challenge(difficulty)

    elif challenge_type == "pattern":
        question, correct_answer = generate_pattern_challenge(difficulty)

    elif challenge_type == "riddle":
        question, correct_answer = generate_riddle_challenge(difficulty)

    elif challenge_type == "quiz":
        question, correct_answer, options = generate_quiz_challenge(
            difficulty
        )

    else:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported challenge type. "
                "Use math, logic, memory, word, pattern, "
                "riddle, or quiz."
            )
        )

    # =====================================================
    # SAVE GENERATED CHALLENGE
    # =====================================================

    challenge = Challenge(
        challenge_type=challenge_type,
        difficulty=difficulty,
        question=question,
        correct_answer=str(correct_answer),
        options=options
    )

    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    # Store challenge-generation behavior in MongoDB for AI/ML analytics.
    log_behavior_event(
        user_id=current_user["user_id"],
        event_type="challenge_generated",
        event_data={
            "challenge_id": challenge.id,
            "challenge_type": challenge.challenge_type,
            "difficulty": challenge.difficulty
        }
    )

    return {
        "id": challenge.id,
        "challenge_type": challenge.challenge_type,
        "difficulty": challenge.difficulty,
        "question": challenge.question,
        "options": challenge.options
    }

# ---------------------------------------------------------
# Submit Challenge Answer
# ---------------------------------------------------------

@app.post("/challenges/{challenge_id}/answer")
def submit_challenge_answer(
    challenge_id: int,
    request: ChallengeAnswer,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    challenge = db.query(Challenge).filter(
        Challenge.id == challenge_id
    ).first()

    if not challenge:

        raise HTTPException(
            status_code=404,
            detail="Challenge not found"
        )

    user_answer = request.answer.strip()

    is_correct = (
        user_answer.lower()
        == challenge.correct_answer.lower()
    )

    # Count previous attempts for this user and this challenge
    previous_result = db.query(ChallengeResult).filter(
        ChallengeResult.user_id == current_user["user_id"],
        ChallengeResult.challenge_id == challenge.id
    ).order_by(
        ChallengeResult.id.desc()
    ).first()

    attempts = previous_result.attempts + 1 if previous_result else 1

    result = ChallengeResult(
        user_id=current_user["user_id"],
        challenge_id=challenge.id,
        user_answer=user_answer,
        is_correct=is_correct,
        attempts=attempts,
        time_taken=request.time_taken
    )

    db.add(result)
    db.commit()
    db.refresh(result)

    # Store challenge-answer behavior in MongoDB for AI/ML analytics.
    log_behavior_event(
        user_id=current_user["user_id"],
        event_type="challenge_answered",
        event_data={
            "challenge_id": challenge.id,
            "challenge_type": challenge.challenge_type,
            "difficulty": challenge.difficulty,
            "is_correct": is_correct,
            "attempts": result.attempts,
            "time_taken": result.time_taken
        }
    )

    return {
        "challenge_id": challenge.id,
        "user_answer": user_answer,
        "is_correct": is_correct,
        "correct_answer": challenge.correct_answer,
        "attempts": result.attempts,
        "time_taken": result.time_taken
    }


# ---------------------------------------------------------
# Challenge History
# ---------------------------------------------------------

@app.get("/challenges/history")
def get_challenge_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    results = db.query(ChallengeResult).filter(
    ChallengeResult.user_id == current_user["user_id"]
).order_by(
    ChallengeResult.completed_at.desc()
).all()

    history = []

    for result in results:

        challenge = db.query(Challenge).filter(
            Challenge.id == result.challenge_id
        ).first()

        history.append({
            "challenge_id": result.challenge_id,
            "challenge_type": challenge.challenge_type
            if challenge else None,
            "difficulty": challenge.difficulty
            if challenge else None,
            "question": challenge.question
            if challenge else None,
            "user_answer": result.user_answer,
            "is_correct": result.is_correct,
            "attempts": result.attempts,
            "time_taken": result.time_taken,
            "completed_at": result.completed_at
        })

    return history


# ---------------------------------------------------------
# Challenge Analytics
# ---------------------------------------------------------

@app.get("/challenges/analytics")
def get_challenge_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user["user_id"]

    results = db.query(ChallengeResult).filter(
        ChallengeResult.user_id == user_id
    ).all()

    total_challenges = len(results)
    correct_answers = sum(1 for result in results if result.is_correct)
    incorrect_answers = total_challenges - correct_answers

    accuracy = (
        round((correct_answers / total_challenges) * 100, 2)
        if total_challenges > 0
        else 0
    )

    times = [
        result.time_taken
        for result in results
        if result.time_taken is not None
    ]

    average_time = (
        round(sum(times) / len(times), 2)
        if times
        else 0
    )

    total_attempts = sum(
        result.attempts if result.attempts else 1
        for result in results
    )

    # Performance by challenge type
    type_stats = {}

    for result in results:
        challenge = db.query(Challenge).filter(
            Challenge.id == result.challenge_id
        ).first()

        if not challenge:
            continue

        challenge_type = challenge.challenge_type

        if challenge_type not in type_stats:
            type_stats[challenge_type] = {
                "total": 0,
                "correct": 0,
                "incorrect": 0,
                "accuracy": 0
            }

        type_stats[challenge_type]["total"] += 1

        if result.is_correct:
            type_stats[challenge_type]["correct"] += 1
        else:
            type_stats[challenge_type]["incorrect"] += 1

    for challenge_type, stats in type_stats.items():
        stats["accuracy"] = round(
            (stats["correct"] / stats["total"]) * 100,
            2
        )

    # Performance by difficulty
    difficulty_stats = {}

    for result in results:
        challenge = db.query(Challenge).filter(
            Challenge.id == result.challenge_id
        ).first()

        if not challenge:
            continue

        difficulty = challenge.difficulty

        if difficulty not in difficulty_stats:
            difficulty_stats[difficulty] = {
                "total": 0,
                "correct": 0,
                "incorrect": 0,
                "accuracy": 0
            }

        difficulty_stats[difficulty]["total"] += 1

        if result.is_correct:
            difficulty_stats[difficulty]["correct"] += 1
        else:
            difficulty_stats[difficulty]["incorrect"] += 1

    for difficulty, stats in difficulty_stats.items():
        stats["accuracy"] = round(
            (stats["correct"] / stats["total"]) * 100,
            2
        )

    return {
        "total_challenges": total_challenges,
        "correct_answers": correct_answers,
        "incorrect_answers": incorrect_answers,
        "accuracy_percentage": accuracy,
        "average_time_seconds": average_time,
        "total_attempts": total_attempts,
        "performance_by_type": type_stats,
        "performance_by_difficulty": difficulty_stats
    }

# ---------------------------------------------------------
# AI VERSION - PANDAS + NUMPY BEHAVIOR ANALYSIS
# ---------------------------------------------------------

@app.get("/ai/behavior-analysis")
def get_ai_behavior_analysis(
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze user behavioral data using Pandas and NumPy.
    """

    user_id = current_user["user_id"]

    return analyze_challenge_behavior(user_id)


# ---------------------------------------------------------
# MILESTONE 4 - PYTORCH BEHAVIOR PREDICTION
# ---------------------------------------------------------

@app.get("/ai/pytorch-behavior")
def get_pytorch_behavior_prediction(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Predict the user's performance on the next challenge
    using the trained PyTorch behavior model.

    This endpoint uses the user's three most recent completed
    challenges as the behavior history.
    """

    user_id = current_user["user_id"]

    recent_results = (
        db.query(ChallengeResult)
        .filter(
            ChallengeResult.user_id == user_id
        )
        .order_by(
            ChallengeResult.completed_at.desc()
        )
        .limit(3)
        .all()
    )

    if len(recent_results) < 3:
        return {
            "message": "Not enough challenge history for PyTorch prediction.",
            "required_records": 3,
            "available_records": len(recent_results),
            "model": "PyTorch"
        }

    # Previous accuracy from the latest three completed challenges.
    previous_accuracy = (
        sum(
            1 for result in recent_results
            if result.is_correct
        )
        / len(recent_results)
    )

    # Average number of attempts.
    previous_attempts = (
        sum(
            result.attempts if result.attempts else 1
            for result in recent_results
        )
        / len(recent_results)
    )

    # Average response time.
    previous_times = [
        result.time_taken
        for result in recent_results
        if result.time_taken is not None
    ]

    previous_time = (
        sum(previous_times) / len(previous_times)
        if previous_times
        else 30.0
    )

    # Calculate the recent performance trend in chronological order.
    chronological_results = list(reversed(recent_results))

    first_performance = (
        1 if chronological_results[0].is_correct else 0
    )

    last_performance = (
        1 if chronological_results[-1].is_correct else 0
    )

    raw_trend = last_performance - first_performance

    # The PyTorch training pipeline uses a 0-1 representation:
    # -1 trend -> 0.0
    #  0 trend -> 0.5
    # +1 trend -> 1.0
    performance_trend = (raw_trend + 1) / 2.0

    prediction = predict_user_behavior(
        previous_accuracy=previous_accuracy,
        previous_attempts=previous_attempts,
        previous_time=previous_time,
        performance_trend=performance_trend
    )

    return {
        "user_id": user_id,
        "model": "PyTorch",
        "input_records": len(recent_results),
        "previous_accuracy_percentage": round(
            previous_accuracy * 100,
            2
        ),
        "previous_average_attempts": round(
            previous_attempts,
            2
        ),
        "previous_average_response_time_seconds": round(
            previous_time,
            2
        ),
        "performance_trend": round(
            performance_trend,
            2
        ),
        **prediction
    }


# ---------------------------------------------------------
# MILESTONE 4 - REINFORCEMENT LEARNING ADAPTIVE DIFFICULTY
# ---------------------------------------------------------

@app.get("/ai/rl-adaptive-difficulty")
def get_rl_adaptive_difficulty(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Select the next challenge difficulty using the M4
    Reinforcement Learning adaptive-difficulty agent.

    The existing M3 adaptive-difficulty endpoint is kept unchanged
    in this phase. This endpoint exposes the RL decision separately
    so it can be tested safely before connecting it to challenge
    generation.
    """

    user_id = current_user["user_id"]

    recent_results = (
        db.query(ChallengeResult)
        .filter(ChallengeResult.user_id == user_id)
        .order_by(ChallengeResult.completed_at.desc())
        .limit(5)
        .all()
    )

    if not recent_results:
        return {
            "user_id": user_id,
            "model": "Reinforcement Learning",
            "message": "No challenge history available for RL difficulty selection.",
            "required_action": "Complete a challenge first.",
            "performance_percentage": None,
            "state": None,
            "selected_difficulty": None
        }

    correct_count = sum(
        1 for result in recent_results
        if result.is_correct
    )

    performance_percentage = (
        correct_count / len(recent_results)
    ) * 100

    rl_agent = AdaptiveDifficultyRL()

    rl_result = rl_agent.adapt_difficulty(
        performance_percentage
    )

    return {
        "user_id": user_id,
        "model": "Reinforcement Learning",
        "input_records": len(recent_results),
        "performance_percentage": round(performance_percentage, 2),
        "state": rl_result["state"],
        "selected_difficulty": rl_result["selected_difficulty"],
        "reward": rl_result["reward"],
        "q_values": rl_result["q_values"]
    }


# ---------------------------------------------------------
# MILESTONE 3 - TASK 1: ADAPTIVE DIFFICULTY ENGINE
# ---------------------------------------------------------

@app.get("/challenges/adaptive")
def get_adaptive_challenge(
    challenge_type: str = "math",
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user["user_id"]

    profile = db.query(UserProfile).filter(
        UserProfile.user_id == user_id
    ).first()

    current_difficulty = (
        profile.difficulty_preference.lower()
        if profile and profile.difficulty_preference
        else "easy"
    )

    if current_difficulty not in ["easy", "medium", "hard"]:
        current_difficulty = "easy"

    recent_results = db.query(ChallengeResult).filter(
        ChallengeResult.user_id == user_id
    ).order_by(
        ChallengeResult.completed_at.desc()
    ).limit(5).all()

    if not recent_results:
        selected_difficulty = current_difficulty
        reason = "No previous challenge history. Using the user's preferred difficulty."
        rl_result = None
    else:
        correct_count = sum(
            1 for result in recent_results if result.is_correct
        )
        accuracy = (correct_count / len(recent_results)) * 100

        times = [
            result.time_taken
            for result in recent_results
            if result.time_taken is not None
        ]
        average_time = sum(times) / len(times) if times else None

        average_attempts = sum(
            result.attempts if result.attempts else 1
            for result in recent_results
        ) / len(recent_results)

        if (
            accuracy >= 80
            and average_attempts <= 1.5
            and (average_time is None or average_time <= 15)
        ):
            if current_difficulty == "easy":
                selected_difficulty = "medium"
            elif current_difficulty == "medium":
                selected_difficulty = "hard"
            else:
                selected_difficulty = "hard"

            reason = "Recent performance is strong, so difficulty was increased."

        elif (
            accuracy <= 50
            or average_attempts >= 2.5
            or (average_time is not None and average_time > 30)
        ):
            if current_difficulty == "hard":
                selected_difficulty = "medium"
            elif current_difficulty == "medium":
                selected_difficulty = "easy"
            else:
                selected_difficulty = "easy"

            reason = "Recent performance shows difficulty, so difficulty was decreased."

        else:
            selected_difficulty = current_difficulty
            reason = "Recent performance is stable, so the current difficulty was kept."

        # =====================================================
        # M4 - Reinforcement Learning adaptive layer
        # Keep the existing M3 adaptive logic above as the
        # baseline, then let the RL agent make the final
        # difficulty decision using the same recent performance.
        # =====================================================
        rl_agent = AdaptiveDifficultyRL()
        rl_result = rl_agent.adapt_difficulty(accuracy)

        m3_selected_difficulty = selected_difficulty
        selected_difficulty = rl_result["selected_difficulty"]

        reason = (
            f"M3 baseline selected {m3_selected_difficulty}; "
            f"M4 Reinforcement Learning selected {selected_difficulty} "
            f"from the user's recent performance."
        )

    challenge_type = challenge_type.lower()

    supported_types = [
        "math", "logic", "memory", "word",
        "pattern", "riddle", "quiz"
    ]

    if challenge_type not in supported_types:
        raise HTTPException(
            status_code=400,
            detail="Unsupported challenge type. Use math, logic, memory, word, pattern, riddle, or quiz."
        )

    options = None

    if challenge_type == "math":
        question, correct_answer = generate_math_challenge(selected_difficulty)
    elif challenge_type == "logic":
        question, correct_answer = generate_logic_challenge(selected_difficulty)
    elif challenge_type == "memory":
        question, correct_answer = generate_memory_challenge(selected_difficulty)
    elif challenge_type == "word":
        question, correct_answer = generate_word_challenge(selected_difficulty)
    elif challenge_type == "pattern":
        question, correct_answer = generate_pattern_challenge(selected_difficulty)
    elif challenge_type == "riddle":
        question, correct_answer = generate_riddle_challenge(selected_difficulty)
    else:
        question, correct_answer, options = generate_quiz_challenge(selected_difficulty)

    challenge = Challenge(
        challenge_type=challenge_type,
        difficulty=selected_difficulty,
        question=question,
        correct_answer=str(correct_answer),
        options=options
    )

    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    log_behavior_event(
        user_id=user_id,
        event_type="adaptive_challenge_generated",
        event_data={
            "challenge_id": challenge.id,
            "challenge_type": challenge.challenge_type,
            "difficulty": challenge.difficulty,
            "reason": reason,
            "rl_state": rl_result["state"] if rl_result else None,
            "rl_reward": rl_result["reward"] if rl_result else None
        }
    )

    return {
        "challenge_id": challenge.id,
        "challenge_type": challenge.challenge_type,
        "difficulty": challenge.difficulty,
        "question": challenge.question,
        "options": challenge.options,
        "reason": reason,
        "adaptive_ai": "M3 baseline + M4 Reinforcement Learning",
        "rl_state": rl_result["state"] if rl_result else None,
        "rl_reward": rl_result["reward"] if rl_result else None,
        "rl_q_values": rl_result["q_values"] if rl_result else None
    }

# ---------------------------------------------------------
# MILESTONE 3 - TASK 2: BEHAVIORAL ANALYTICS
# ---------------------------------------------------------

@app.get("/challenges/behavioral-analytics")
def get_behavioral_analytics(
    period: Literal["daily", "weekly", "monthly", "custom"] = "weekly",
    anchor_date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    M3 Behavioral Analytics with historical period selection.

    Supported periods:
    - daily: one calendar day
    - weekly: Monday-Sunday containing anchor_date
    - monthly: complete calendar month containing anchor_date
    - custom: start_date through end_date, inclusive

    The response is filtered to the selected period and includes:
    - wake-up behavior
    - snooze behavior
    - challenge performance
    - daily activity records
    - historical period label
    """

    user_id = current_user["user_id"]

    # =====================================================
    # 1. RESOLVE SELECTED DATE RANGE
    # =====================================================

    today = date.today()
    try:
        anchor = date.fromisoformat(anchor_date) if anchor_date else today
    except ValueError:
        raise HTTPException(status_code=400, detail="anchor_date must be YYYY-MM-DD")

    if anchor > today:
        raise HTTPException(status_code=400, detail="anchor_date cannot be in the future")

    if period == "daily":
        range_start = anchor
        range_end = anchor
        period_label = anchor.strftime("%d %b %Y")

    elif period == "weekly":
        range_start = anchor - timedelta(days=anchor.weekday())
        range_end = min(range_start + timedelta(days=6), today)
        period_label = f"{range_start.strftime('%d %b %Y')} – {range_end.strftime('%d %b %Y')}"

    elif period == "monthly":
        range_start = anchor.replace(day=1)
        if range_start.month == 12:
            next_month = date(range_start.year + 1, 1, 1)
        else:
            next_month = date(range_start.year, range_start.month + 1, 1)
        range_end = min(next_month - timedelta(days=1), today)
        period_label = anchor.strftime("%B %Y")

    else:
        if not start_date or not end_date:
            raise HTTPException(
                status_code=400,
                detail="start_date and end_date are required for custom period"
            )
        try:
            range_start = date.fromisoformat(start_date)
            requested_end = date.fromisoformat(end_date)
            range_end = min(requested_end, today)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="start_date and end_date must be YYYY-MM-DD"
            )
        if range_start > range_end:
            raise HTTPException(
                status_code=400,
                detail="start_date cannot be after end_date"
            )
        period_label = f"{range_start.strftime('%d %b %Y')} – {range_end.strftime('%d %b %Y')}"

    # =====================================================
    # 2. CHALLENGE PERFORMANCE FOR SELECTED PERIOD
    # =====================================================

    results = db.query(ChallengeResult).filter(
        ChallengeResult.user_id == user_id
    ).all()

    selected_results = []
    for result in results:
        completed_at = result.completed_at
        if completed_at is None:
            continue
        try:
            result_date = completed_at.date()
        except AttributeError:
            result_date = date.fromisoformat(str(completed_at)[:10])
        if range_start <= result_date <= range_end:
            selected_results.append(result)

    total_challenges = len(selected_results)

    if total_challenges > 0:
        correct_answers = sum(
            1 for result in selected_results if result.is_correct
        )
        accuracy = (correct_answers / total_challenges) * 100

        times = [
            result.time_taken
            for result in selected_results
            if result.time_taken is not None
        ]
        average_time = sum(times) / len(times) if times else 0

        attempts = [
            result.attempts if result.attempts else 1
            for result in selected_results
        ]
        average_attempts = sum(attempts) / len(attempts) if attempts else 0
    else:
        correct_answers = 0
        accuracy = 0
        average_time = 0
        average_attempts = 0

    # =====================================================
    # 3. PERFORMANCE BY CHALLENGE TYPE
    # =====================================================

    performance = {}

    for result in selected_results:
        challenge = db.query(Challenge).filter(
            Challenge.id == result.challenge_id
        ).first()
        if not challenge:
            continue

        challenge_type = challenge.challenge_type
        if challenge_type not in performance:
            performance[challenge_type] = {
                "total": 0,
                "correct": 0,
                "incorrect": 0,
                "accuracy": 0
            }

        performance[challenge_type]["total"] += 1
        if result.is_correct:
            performance[challenge_type]["correct"] += 1
        else:
            performance[challenge_type]["incorrect"] += 1

    for challenge_type, stats in performance.items():
        stats["accuracy"] = round(
            (stats["correct"] / stats["total"]) * 100,
            2
        )

    strongest_type = None
    weakest_type = None
    if performance:
        strongest_type = max(
            performance,
            key=lambda x: performance[x]["accuracy"]
        )
        weakest_type = min(
            performance,
            key=lambda x: performance[x]["accuracy"]
        )

    # =====================================================
    # 4. BEHAVIOR EVENTS FROM MONGODB FOR SELECTED PERIOD
    # =====================================================

    try:
        from mongodb import behavior_events

        behavior_documents = list(
            behavior_events.find(
                {"user_id": user_id},
                {"_id": 0}
            ).sort("timestamp", 1)
        )
    except Exception:
        behavior_documents = []

    # Create every calendar day in the selected period so the graph
    # displays zero-activity days as well as active days.
    daily_activity = {}
    cursor = range_start
    while cursor <= range_end:
        key = cursor.isoformat()
        daily_activity[key] = {
            "events": 0,
            "alarm_triggered": 0,
            "snoozed": 0,
            "wake_up_completed": 0,
            "challenge_answered": 0
        }
        cursor += timedelta(days=1)

    alarm_trigger_count = 0
    snooze_count = 0
    resumed_after_snooze_count = 0
    wake_up_count = 0
    selected_behavior_event_count = 0
    challenge_event_count = 0

    for event in behavior_documents:
        timestamp = event.get("timestamp")
        if not timestamp:
            continue

        try:
            event_date = timestamp.date()
        except AttributeError:
            try:
                event_date = date.fromisoformat(str(timestamp)[:10])
            except ValueError:
                continue

        if not (range_start <= event_date <= range_end):
            continue

        selected_behavior_event_count += 1
        event_type = event.get("event_type")
        activity = daily_activity[event_date.isoformat()]
        activity["events"] += 1

        if event_type == "alarm_triggered":
            alarm_trigger_count += 1
            activity["alarm_triggered"] += 1
        elif event_type == "alarm_snoozed":
            snooze_count += 1
            activity["snoozed"] += 1
        elif event_type == "alarm_resumed_after_snooze":
            resumed_after_snooze_count += 1
        elif event_type == "wake_up_completed":
            wake_up_count += 1
            activity["wake_up_completed"] += 1
        elif event_type == "challenge_answered":
            challenge_event_count += 1
            activity["challenge_answered"] += 1

    # =====================================================
    # 5. WAKE-UP CONSISTENCY AND SNOOZE RATE
    # =====================================================

    wake_up_consistency = (
        (wake_up_count / alarm_trigger_count) * 100
        if alarm_trigger_count > 0
        else 0
    )

    snooze_rate = (
        (snooze_count / alarm_trigger_count) * 100
        if alarm_trigger_count > 0
        else 0
    )

    if wake_up_count == 0 and alarm_trigger_count == 0:
        wake_up_status = "No wake-up activity recorded in this period."
    elif wake_up_consistency >= 80:
        wake_up_status = "Consistent wake-up behavior"
    elif wake_up_consistency >= 60:
        wake_up_status = "Moderately consistent wake-up behavior"
    else:
        wake_up_status = "Wake-up consistency needs improvement"

    if snooze_count == 0:
        snooze_status = "No snooze activity recorded in this period."
    elif snooze_rate <= 20:
        snooze_status = "Low snooze frequency"
    elif snooze_rate <= 50:
        snooze_status = "Moderate snooze frequency"
    else:
        snooze_status = "High snooze frequency"

    # =====================================================
    # 6. RETURN ALL DAYS IN SELECTED RANGE
    # =====================================================

    recent_daily_activity = [
        {
            "date": activity_date,
            **activity
        }
        for activity_date, activity in sorted(daily_activity.items())
    ]

    # =====================================================
    # 7. RETURN M3 BEHAVIORAL ANALYTICS
    # =====================================================

    return {
        "period": period,
        "period_label": period_label,
        "start_date": range_start.isoformat(),
        "end_date": range_end.isoformat(),

        "total_attempts": total_challenges,
        "accuracy": round(accuracy, 2),
        "average_time": round(average_time, 2),
        "average_attempts": round(average_attempts, 2),

        "strongest_challenge_type": strongest_type,
        "weakest_challenge_type": weakest_type,
        "performance": performance,

        "wake_up_behavior": {
            "alarm_trigger_count": alarm_trigger_count,
            "wake_up_completed_count": wake_up_count,
            "wake_up_consistency_percentage": round(wake_up_consistency, 2),
            "status": wake_up_status
        },

        "snooze_behavior": {
            "snooze_count": snooze_count,
            "resumed_after_snooze_count": resumed_after_snooze_count,
            "snooze_rate_percentage": round(snooze_rate, 2),
            "status": snooze_status
        },

        "daily_activity": recent_daily_activity,

        "behavior_summary": {
            "total_behavior_events": selected_behavior_event_count,
            "challenge_events": challenge_event_count,
            "alarm_events": alarm_trigger_count,
            "snooze_events": snooze_count,
            "wake_up_events": wake_up_count
        }
    }


# ---------------------------------------------------------
# MILESTONE 3 - TASK 3: HABIT SCORING MODEL
# ---------------------------------------------------------

@app.get("/habit-score")
def get_habit_score(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """M3 habit score using the four PDF-weighted components."""
    user_id = current_user["user_id"]

    # Challenge activity
    results = db.query(ChallengeResult).filter(
        ChallengeResult.user_id == user_id
    ).all()

    total_challenges = len(results)
    correct_count = sum(1 for result in results if result.is_correct)
    challenge_completion_success = (
        (correct_count / total_challenges) * 100
        if total_challenges else 0
    )

    times = [
        result.time_taken
        for result in results
        if result.time_taken is not None
    ]
    average_time = sum(times) / len(times) if times else 0
    average_attempts = (
        sum(result.attempts if result.attempts else 1 for result in results)
        / total_challenges
        if total_challenges else 0
    )

    # Behavioral activity
    behavior_documents = list(
        behavior_events.find({"user_id": user_id}, {"_id": 0})
    )

    alarm_trigger_count = sum(
        1 for event in behavior_documents
        if event.get("event_type") == "alarm_triggered"
    )
    wake_up_count = sum(
        1 for event in behavior_documents
        if event.get("event_type") == "wake_up_completed"
    )
    snooze_count = sum(
        1 for event in behavior_documents
        if event.get("event_type") == "alarm_snoozed"
    )

    wake_up_consistency = (
        (wake_up_count / alarm_trigger_count) * 100
        if alarm_trigger_count else 0
    )

    snooze_rate = (
        (snooze_count / alarm_trigger_count) * 100
        if alarm_trigger_count else 0
    )
    # With no historical baseline, 100 - current snooze rate is used as a
    # transparent current-behavior proxy for the PDF's snooze-reduction term.
    snooze_reduction_proxy = max(0, min(100, 100 - snooze_rate))

    # Sleep schedule adherence cannot be measured directly because the app
    # does not record actual bedtime/sleep-start time. We therefore use the
    # user's preferred wake-up time and completed wake-up events as a
    # wake-up-schedule proxy and label it explicitly.
    profile = db.query(UserProfile).filter(
        UserProfile.user_id == user_id
    ).first()

    schedule_scores = []
    preferred_time = profile.preferred_wake_up_time if profile else None

    if preferred_time:
        preferred_minutes = (
            preferred_time.hour * 60 + preferred_time.minute
        )

        for event in behavior_documents:
            if event.get("event_type") != "wake_up_completed":
                continue

            timestamp = event.get("timestamp")
            if not timestamp:
                continue

            actual_minutes = timestamp.hour * 60 + timestamp.minute
            difference = abs(actual_minutes - preferred_minutes)
            difference = min(difference, 1440 - difference)

            if difference <= 15:
                score = 100
            elif difference <= 30:
                score = 90
            elif difference <= 60:
                score = 75
            elif difference <= 120:
                score = 50
            else:
                score = 25

            schedule_scores.append(score)

    sleep_schedule_adherence_proxy = (
        sum(schedule_scores) / len(schedule_scores)
        if schedule_scores else None
    )

    # Exact PDF weights:
    # Wake-Up Consistency 35%
    # Challenge Completion Success 25%
    # Snooze Reduction 20%
    # Sleep Schedule Adherence 20%
    components = {
        "wake_up_consistency": wake_up_consistency,
        "challenge_completion_success": challenge_completion_success,
        "snooze_reduction": snooze_reduction_proxy,
        "sleep_schedule_adherence": sleep_schedule_adherence_proxy,
    }

    if sleep_schedule_adherence_proxy is None:
        # Do not silently pretend the missing sleep component exists.
        # The returned score is marked provisional and uses only measured
        # components, renormalized across their available PDF weights.
        available_weight = 0.35 + 0.25 + 0.20
        habit_score = (
            wake_up_consistency * 0.35
            + challenge_completion_success * 0.25
            + snooze_reduction_proxy * 0.20
        ) / available_weight
        scoring_status = "provisional_missing_sleep_schedule_data"
    else:
        habit_score = (
            wake_up_consistency * 0.35
            + challenge_completion_success * 0.25
            + snooze_reduction_proxy * 0.20
            + sleep_schedule_adherence_proxy * 0.20
        )
        scoring_status = "full_pdf_weighted_score"

    return {
        "habit_score": round(habit_score, 2),
        "wake_up_consistency_score": round(wake_up_consistency, 2),
        "challenge_completion_success_score": round(challenge_completion_success, 2),
        "snooze_reduction_score": round(snooze_reduction_proxy, 2),
        "sleep_schedule_adherence_score": (
            round(sleep_schedule_adherence_proxy, 2)
            if sleep_schedule_adherence_proxy is not None else None
        ),
        "accuracy_score": round(challenge_completion_success, 2),
        "average_time_seconds": round(average_time, 2),
        "average_attempts": round(average_attempts, 2),
        "snooze_rate_percentage": round(snooze_rate, 2),
        "alarm_trigger_count": alarm_trigger_count,
        "wake_up_completed_count": wake_up_count,
        "snooze_count": snooze_count,
        "total_challenges": total_challenges,
        "scoring_status": scoring_status,
        "sleep_schedule_note": (
            "Wake-up time adherence is used as a proxy because actual bedtime "
            "and sleep-start time are not currently recorded."
        ),
        "components": components,
    }

@app.delete("/recommendations/auto/{recommendation_id}")
def delete_automatic_recommendation(
    recommendation_id: str,
    current_user: dict = Depends(get_current_user),
):
    try:
        object_id = ObjectId(recommendation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid recommendation id")

    event = behavior_events.find_one({
        "_id": object_id,
        "user_id": current_user["user_id"],
        "event_type": "automatic_recommendation",
    })

    if not event:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    recommendation_text = (event.get("event_data") or {}).get("recommendation", "")
    behavior_events.delete_one({"_id": object_id})

    # Record the deletion so the same automatically generated recommendation
    # is not immediately recreated on the next refresh.
    behavior_events.insert_one({
        "user_id": current_user["user_id"],
        "event_type": "automatic_recommendation_deleted",
        "event_data": {
            "recommendation": recommendation_text,
            "deleted_recommendation_id": recommendation_id,
        },
        "timestamp": datetime.now(timezone.utc),
    })

    return {"message": "Recommendation deleted successfully", "recommendation_id": recommendation_id}


@app.get("/recommendations/auto")
def generate_automatic_recommendations(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate ONE recommendation from the user's OVERALL behavior.

    The recommendation is not based only on the latest challenge.
    It considers cumulative:
      - wake-up consistency
      - snooze behavior
      - challenge accuracy
      - average attempts
      - average response time
      - weakest challenge type

    Recommendation history is stored only when the recommendation
    actually changes. Repeated/duplicate old records are removed from
    the response so the UI does not show the same recommendation again.
    """
    user_id = current_user["user_id"]

    # =========================================================
    # 1. OVERALL CHALLENGE ANALYTICS
    # =========================================================
    results = db.query(ChallengeResult).filter(
        ChallengeResult.user_id == user_id
    ).all()

    total_challenges = len(results)

    correct_count = sum(
        1 for result in results if result.is_correct
    )

    accuracy = (
        (correct_count / total_challenges) * 100
        if total_challenges
        else 0
    )

    times = [
        result.time_taken
        for result in results
        if result.time_taken is not None
    ]

    average_time = (
        sum(times) / len(times)
        if times
        else 0
    )

    average_attempts = (
        sum(
            result.attempts if result.attempts else 1
            for result in results
        ) / total_challenges
        if total_challenges
        else 0
    )

    # =========================================================
    # 2. OVERALL BEHAVIOR ANALYTICS
    # =========================================================
    behavior_documents = list(
        behavior_events.find(
            {
                "user_id": user_id,
                "event_type": {
                    "$in": [
                        "alarm_triggered",
                        "alarm_snoozed",
                        "alarm_resumed_after_snooze",
                        "wake_up_completed",
                        "challenge_answered",
                    ]
                },
            },
            {"_id": 0}
        ).sort("timestamp", 1)
    )

    alarm_trigger_count = sum(
        1 for event in behavior_documents
        if event.get("event_type") == "alarm_triggered"
    )

    wake_up_count = sum(
        1 for event in behavior_documents
        if event.get("event_type") == "wake_up_completed"
    )

    snooze_count = sum(
        1 for event in behavior_documents
        if event.get("event_type") == "alarm_snoozed"
    )

    wake_up_consistency = (
        (wake_up_count / alarm_trigger_count) * 100
        if alarm_trigger_count
        else 0
    )

    snooze_rate = (
        (snooze_count / alarm_trigger_count) * 100
        if alarm_trigger_count
        else 0
    )

    # =========================================================
    # 3. OVERALL PERFORMANCE BY CHALLENGE TYPE
    # =========================================================
    performance = {}

    for result in results:
        challenge = db.query(Challenge).filter(
            Challenge.id == result.challenge_id
        ).first()

        if not challenge:
            continue

        challenge_type = challenge.challenge_type

        performance.setdefault(
            challenge_type,
            {
                "total": 0,
                "correct": 0,
                "accuracy": 0,
            }
        )

        performance[challenge_type]["total"] += 1

        if result.is_correct:
            performance[challenge_type]["correct"] += 1

    for challenge_type, stats in performance.items():
        stats["accuracy"] = round(
            (stats["correct"] / stats["total"]) * 100,
            2
        )

    weakest_type = (
        min(
            performance,
            key=lambda item: performance[item]["accuracy"]
        )
        if performance
        else None
    )

    # =========================================================
    # 4. OVERALL RECOMMENDATION
    #
    # Priority is based on the user's overall behavior, not the
    # latest single challenge.
    #
    # The first condition that is currently the most important
    # measurable issue becomes the current recommendation.
    # =========================================================
    if total_challenges == 0 and alarm_trigger_count == 0:
        recommendation = (
            "Start using your alarms and complete cognitive challenges "
            "regularly so the system can learn your overall behavior."
        )
        area = "Getting Started"

    elif alarm_trigger_count > 0 and snooze_rate > 50:
        recommendation = (
            f"Your overall snooze rate is {snooze_rate:.2f}% "
            f"({snooze_count} snooze(s) across {alarm_trigger_count} "
            "alarm trigger(s)). Focus on reducing repeated snoozing "
            "to improve your wake-up routine."
        )
        area = "Snooze Behavior"

    elif alarm_trigger_count > 0 and wake_up_consistency < 60:
        recommendation = (
            f"Your overall wake-up consistency is {wake_up_consistency:.2f}%. "
            "Try to complete the wake-up challenge each time your alarm "
            "rings to build a more consistent routine."
        )
        area = "Wake-Up Consistency"

    elif total_challenges > 0 and accuracy < 40:
        recommendation = (
            f"Your overall challenge accuracy is {accuracy:.2f}%. "
            "Focus on reading each question carefully and improving "
            "accuracy before increasing speed."
        )
        area = "Challenge Accuracy"

    elif total_challenges > 0 and accuracy < 60:
        recommendation = (
            f"Your overall challenge accuracy has reached {accuracy:.2f}%. "
            "Continue practicing carefully and aim to consistently "
            "answer more challenges correctly."
        )
        area = "Challenge Accuracy"

    elif total_challenges > 0 and average_attempts >= 2.5:
        recommendation = (
            f"Your overall average is {average_attempts:.2f} attempts "
            "per challenge. Work toward solving more challenges correctly "
            "on the first attempt."
        )
        area = "Attempts"

    elif total_challenges > 0 and average_time > 30:
        recommendation = (
            f"Your overall average response time is {average_time:.2f} "
            "seconds. Practice improving speed while maintaining accuracy."
        )
        area = "Response Speed"

    elif (
        weakest_type
        and performance[weakest_type]["accuracy"] < 50
    ):
        recommendation = (
            f"{weakest_type} is currently your weakest challenge type "
            f"at {performance[weakest_type]['accuracy']}% overall accuracy. "
            f"Practice {weakest_type} challenges to strengthen this area."
        )
        area = "Weakest Challenge Type"

    elif alarm_trigger_count > 0 and snooze_rate > 20:
        recommendation = (
            f"Your overall snooze rate is {snooze_rate:.2f}%. "
            "Try reducing snoozes over the next few days while keeping "
            "your wake-up routine consistent."
        )
        area = "Snooze Behavior"

    elif alarm_trigger_count > 0 and wake_up_consistency < 80:
        recommendation = (
            f"Your overall wake-up consistency is {wake_up_consistency:.2f}%. "
            "Aim to complete your wake-up challenge every time the alarm rings."
        )
        area = "Wake-Up Consistency"

    elif weakest_type:
        recommendation = (
            f"Your overall performance is stable. Keep practicing "
            f"{weakest_type} and the other challenge types to maintain "
            "your progress."
        )
        area = "Maintain Progress"

    else:
        recommendation = (
            "Your overall behavior is stable. Keep your current routine "
            "and continue regular challenges to maintain your progress."
        )
        area = "Maintain Progress"

    # =========================================================
    # 5. RECOMMENDATION HISTORY
    #
    # Only save a new recommendation when the recommendation text
    # actually changes. This prevents a refresh from creating a
    # new record.
    # =========================================================
    recommendation_history_query = {
        "user_id": user_id,
        "event_type": "automatic_recommendation",
    }

    latest_recommendation_event = behavior_events.find_one(
        recommendation_history_query,
        sort=[("timestamp", -1)]
    )

    latest_saved_recommendation = (
        latest_recommendation_event.get(
            "event_data",
            {}
        ).get("recommendation")
        if latest_recommendation_event
        else None
    )

    latest_deleted_event = behavior_events.find_one(
        {
            "user_id": user_id,
            "event_type": "automatic_recommendation_deleted",
            "event_data.recommendation": recommendation,
        },
        sort=[("timestamp", -1)],
    )

    deleted_same_recommendation = bool(
        latest_deleted_event
        and (
            not latest_recommendation_event
            or latest_deleted_event.get("timestamp")
            >= latest_recommendation_event.get("timestamp")
        )
    )

    if latest_saved_recommendation != recommendation and not deleted_same_recommendation:
        behavior_events.insert_one({
            "user_id": user_id,
            "event_type": "automatic_recommendation",
            "event_data": {
                "recommendation": recommendation,
                "recommendation_area": area,
            },
            # Store an explicit UTC-aware timestamp.
            "timestamp": datetime.now(timezone.utc),
        })

    # =========================================================
    # 6. KEEP ONLY THE 3 MOST RECENT RECOMMENDATIONS
    # =========================================================
    # The database should retain only the latest three recommendation
    # records for each user. This means a new recommendation shifts the
    # list naturally, e.g. 1,2,3 -> new -> new,1,2.
    all_recommendation_events = list(
        behavior_events.find(
            recommendation_history_query,
            {"_id": 1}
        ).sort("timestamp", -1)
    )

    if len(all_recommendation_events) > 3:
        keep_ids = [
            event["_id"]
            for event in all_recommendation_events[:3]
        ]
        behavior_events.delete_many({
            **recommendation_history_query,
            "_id": {"$nin": keep_ids},
        })

    # =========================================================
    # 7. RETURN HISTORY WITHOUT DUPLICATE RECOMMENDATIONS
    #
    # Old duplicate records from previous versions are filtered
    # here so they do not continue appearing in the UI.
    # =========================================================
    recommendation_events = list(
        behavior_events.find(
            recommendation_history_query,
            {"_id": 1, "event_data": 1, "timestamp": 1}
        ).sort("timestamp", -1)
    )

    recommendation_history = []
    seen_recommendations = set()

    for event in recommendation_events:
        event_data = event.get("event_data") or {}
        recommendation_text = event_data.get("recommendation", "")

        if not recommendation_text:
            continue

        # Keep only the newest occurrence of each exact recommendation.
        if recommendation_text in seen_recommendations:
            continue

        seen_recommendations.add(recommendation_text)

        timestamp = event.get("timestamp")

        if timestamp:
            # Older records may be naive UTC datetimes.
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)

            created_at = timestamp.isoformat().replace(
                "+00:00",
                "Z"
            )
        else:
            created_at = None

        recommendation_history.append({
            "recommendation_id": str(event.get("_id")) if event.get("_id") else None,
            "recommendation": recommendation_text,
            "recommendation_area": event_data.get(
                "recommendation_area",
                ""
            ),
            "created_at": created_at,
        })

    # =========================================================
    # 8. MAKE SURE CURRENT RECOMMENDATION IS THE FIRST RECORD
    # =========================================================
    current_history_index = next(
        (
            index
            for index, item in enumerate(recommendation_history)
            if item["recommendation"] == recommendation
        ),
        None
    )

    if current_history_index is not None:
        current_record = recommendation_history.pop(
            current_history_index
        )
        recommendation_history.insert(0, current_record)
    else:
        current_record = None
        if not deleted_same_recommendation:
            current_record = {
                "recommendation_id": str(latest_recommendation_event.get("_id")) if latest_recommendation_event and latest_recommendation_event.get("_id") else None,
                "recommendation": recommendation,
                "recommendation_area": area,
                "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
            recommendation_history.insert(0, current_record)

    return {
        "accuracy": round(accuracy, 2),
        "average_time_seconds": round(average_time, 2),
        "average_attempts": round(average_attempts, 2),
        "wake_up_consistency_percentage": round(
            wake_up_consistency,
            2
        ),
        "snooze_rate_percentage": round(
            snooze_rate,
            2
        ),
        "weakest_challenge_type": weakest_type,
        "recommendation_area": area,
        "current_recommendation": current_record["recommendation"] if current_record else "",
        "current_recommendation_created_at": current_record["created_at"] if current_record else None,
        "recommendations": [current_record["recommendation"]] if current_record else [],
        "recommendation_history": recommendation_history,
    }
