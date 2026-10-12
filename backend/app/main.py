import asyncio
from collections import defaultdict
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Optional, List
from .database import *
from .security import hash_password, verify_password, create_token
from .dependencies import current_user, require_roles, require_user, require_wellness_coach, require_admin
from .schemas import Register, Login, AlarmCreate, ChallengeSubmit, RoleUpdate, WellnessCoachAssignment
from .challenge_generator import generate_challenge, generate_role_challenge, ALARM_ROLES, CHALLENGE_TYPES
from .difficulty_engine import DifficultyEngine
from .wellness_coach_ml import build_wellness_coach_analytics
from seed import seed_demo_users

# Instantiate the difficulty engine with DB collections
difficulty_engine = DifficultyEngine(performance, difficulty_history, challenge_attempts)

app = FastAPI(title="CognitiveWake API", version="1.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class StatusUpdate(BaseModel):
    is_active: bool

class AccountAction(BaseModel):
    action: str
    password: Optional[str] = None

class ChallengeManage(BaseModel):
    title: str
    type: str
    difficulty: str = "MEDIUM"
    time_limit: int = 30
    points: int = 10
    question: str = ""
    hint: str = ""
    active: bool = True

class WellnessCoachCreate(BaseModel):
    name: str
    email: str
    password: str
    timezone: str = "Asia/Kolkata"
    permissions: list[str] = ["manage_users", "manage_challenges", "view_analytics", "handle_reports"]

class WellnessCoachUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    permissions: Optional[list[str]] = None

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    timezone: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None
    confirm_password: Optional[str] = None

class AdminAlarmConfigUpdate(BaseModel):
    alarm_role: Optional[str] = None
    alarm_time: Optional[str] = None
    timezone: Optional[str] = None
    repeat_type: Optional[str] = None
    repeat_days: Optional[List[str]] = None
    sound: Optional[str] = None
    volume: Optional[int] = None
    snooze_enabled: Optional[bool] = None
    snooze_duration: Optional[int] = None
    max_snoozes: Optional[int] = None
    enabled: Optional[bool] = None
    is_mandatory: Optional[bool] = None
    challenge_type: Optional[str] = None
    difficulty: Optional[str] = None

class AdminAlarmBulkStatus(BaseModel):
    alarm_ids: List[str]
    enabled: bool

class GlobalAlarmRules(BaseModel):
    max_snoozes: int = 2
    default_challenge: str = "MATH"
    default_difficulty: str = "MEDIUM"
    gradual_volume: bool = False

class AdminSettingsUpdate(BaseModel):
    values: dict

class NotificationPreferencesUpdate(BaseModel):
    bedtime_enabled: Optional[bool] = None
    bedtime_time: Optional[str] = None
    wake_up_enabled: Optional[bool] = None
    habit_alerts_enabled: Optional[bool] = None
    challenge_reminders_enabled: Optional[bool] = None
    progress_notifications_enabled: Optional[bool] = None
    assigned_user_alerts_enabled: Optional[bool] = None
    missed_alarm_alerts_enabled: Optional[bool] = None
    challenge_review_alerts_enabled: Optional[bool] = None
    weekly_cohort_reports_enabled: Optional[bool] = None

class PlatformAnnouncementCreate(BaseModel):
    title: str
    message: str
    audience: str = "ALL"

@app.on_event("startup")
async def startup():
    create_indexes()
    try:
        seed_demo_users()
    except Exception as e:
        print("Startup seed error:", e)
    asyncio.create_task(maintain_streaks_task())

async def maintain_streaks_task():
    """Background task to periodically maintain all user streaks so they don't go stale."""
    while True:
        try:
            for u in users.find({}):
                update_user_performance_stats(str(u["_id"]))
                # Yield control to event loop since PyMongo is synchronous
                await asyncio.sleep(0.01) 
            print("Daily streaks maintained successfully.")
        except Exception as e:
            print("Error maintaining streaks:", e)
        # Run every hour to ensure updates are timely
        await asyncio.sleep(3600)

def clean(doc):
    if not doc:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc

@app.get("/")
def root():
    return {"message": "CognitiveWake API is running", "version": "1.2.0"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/api/auth/register")
def register(data: Register):
    if not data.name or not data.name.strip():
        raise HTTPException(400, "Full name is required")
    if not data.email or not data.email.strip():
        raise HTTPException(400, "Email is required")
    if not data.password or not data.password.strip():
        raise HTTPException(400, "Password is required")
    if data.password != data.confirm_password:
        raise HTTPException(400, "Passwords do not match")
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters long")
    
    email_clean = data.email.lower().strip()
    username_clean = (data.username or data.email.split("@")[0]).lower().strip()

    if users.find_one({"email": email_clean}):
        raise HTTPException(409, "Email is already registered")

    if users.find_one({"username": username_clean}):
        raise HTTPException(409, "Username is already taken")

    role_clean = (data.role or "USER").upper()
    if role_clean not in ["USER", "WELLNESS_COACH", "ADMIN"]:
        role_clean = "USER"

    # Security check for elevated roles (WELLNESS_COACH / ADMIN)
    if role_clean in ["WELLNESS_COACH", "ADMIN"]:
        valid_code = "ADMIN123" if role_clean == "ADMIN" else "MOD123"
        code_input = (data.security_code or "").strip()
        if code_input != valid_code and code_input != "SECRET123":
            raise HTTPException(403, f"Invalid authorization code for {role_clean} registration.")

    now = datetime.now(timezone.utc)
    doc = {
        "name": data.name.strip(),
        "username": username_clean,
        "email": email_clean,
        "password_hash": hash_password(data.password),
        "role": role_clean,
        "timezone": data.timezone,
        "is_active": True,
        "permissions": [],
        "created_at": now,
        "updated_at": now
    }
    r = users.insert_one(doc)
    return {
        "message": "Registered successfully",
        "user": {
            "id": str(r.inserted_id),
            "name": data.name.strip(),
            "username": username_clean,
            "email": email_clean,
            "role": role_clean,
            "timezone": data.timezone
        }
    }

@app.post("/api/auth/login")
def login(data: Login):
    identifier = (data.username_or_email or data.email or "").strip().lower()
    if not identifier:
        raise HTTPException(status_code=400, detail="Please enter your username or email.")
    if not data.password or not data.password.strip():
        raise HTTPException(status_code=400, detail="Please enter your password.")
    
    # 1. Account existence check by Email OR Username
    u = users.find_one({"$or": [{"email": identifier}, {"username": identifier}]})
    if not u:
        raise HTTPException(status_code=401, detail="User not found.")
        
    # 2. Password verification
    if not verify_password(data.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    # 3. Account active check
    if not u.get("is_active", True):
        raise HTTPException(status_code=403, detail="Your account has been disabled. Contact the administrator.")
        
    # 4. Role mismatch check (Case-insensitive)
    db_role = u.get("role", "USER").upper()
    if data.role and data.role.upper() != db_role:
        raise HTTPException(status_code=401, detail="Invalid credentials or selected role.")
        
    token = create_token(str(u["_id"]), db_role)
    uid_str = str(u["_id"])
    cs, ls = calculate_user_streak(uid_str)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": uid_str,
            "name": u["name"],
            "username": u.get("username", u["email"].split("@")[0]),
            "email": u["email"],
            "role": db_role,
            "timezone": u.get("timezone", "Asia/Kolkata"),
            "current_streak": cs,
            "longest_streak": ls,
            "streak": cs
        }
    }

@app.get("/api/auth/me")
def me(user=Depends(current_user)):
    uid = str(user["_id"])
    cs, ls = calculate_user_streak(uid)
    return {
        "id": uid,
        "name": user["name"],
        "username": user.get("username", user["email"].split("@")[0]),
        "email": user["email"],
        "role": user["role"],
        "timezone": user.get("timezone", "Asia/Kolkata"),
        "current_streak": cs,
        "longest_streak": ls,
        "streak": cs
    }

@app.get("/api/users/me/streak")
def get_my_streak(user=Depends(current_user)):
    uid = str(user["_id"])
    cs, ls = calculate_user_streak(uid)
    return {"current_streak": cs, "longest_streak": ls, "streak": cs}

@app.post("/api/users/heartbeat")
def user_heartbeat(user=Depends(current_user)):
    uid = str(user["_id"])
    cs, ls = calculate_user_streak(uid)
    update_user_performance_stats(uid)
    return {"current_streak": cs, "longest_streak": ls, "streak": cs, "status": "active"}

@app.patch("/api/users/profile")
def update_profile(data: ProfileUpdate, user=Depends(current_user)):
    update_doc = {}
    if data.name:
        update_doc["name"] = data.name.strip()
    if data.username:
        username = data.username.strip().lower()
        if not username:
            raise HTTPException(400, "Username cannot be empty")
        existing = users.find_one({"username": username, "_id": {"$ne": user["_id"]}})
        if existing:
            raise HTTPException(409, "Username is already taken")
        update_doc["username"] = username
    if data.email:
        email = data.email.strip().lower()
        if "@" not in email:
            raise HTTPException(400, "Please enter a valid email address")
        existing = users.find_one({"email": email, "_id": {"$ne": user["_id"]}})
        if existing:
            raise HTTPException(409, "Email is already registered")
        update_doc["email"] = email
    if data.timezone:
        update_doc["timezone"] = data.timezone.strip()
    password_fields_used = any([data.current_password, data.new_password, data.confirm_password])
    if password_fields_used:
        if not data.current_password or not data.new_password or not data.confirm_password:
            raise HTTPException(400, "Enter your current password and confirm the new password")
        if not verify_password(data.current_password, user["password_hash"]):
            raise HTTPException(400, "Current password is incorrect")
        if len(data.new_password) < 6:
            raise HTTPException(400, "New password must be at least 6 characters long")
        if data.new_password != data.confirm_password:
            raise HTTPException(400, "New passwords do not match")
        update_doc["password_hash"] = hash_password(data.new_password)
    if update_doc:
        update_doc["updated_at"] = datetime.now(timezone.utc)
        users.update_one({"_id": user["_id"]}, {"$set": update_doc})
    updated = users.find_one({"_id": user["_id"]})
    return {
        "id": str(updated["_id"]),
        "name": updated["name"],
        "username": updated.get("username", updated["email"].split("@")[0]),
        "email": updated["email"],
        "role": updated["role"],
        "timezone": updated.get("timezone", "Asia/Kolkata")
    }

# --- ALARM ROLE METADATA ENDPOINT ---
@app.get("/api/alarms/roles")
def get_alarm_roles():
    return list(ALARM_ROLES.values())

@app.get("/api/alarms")
def list_alarms(user=Depends(current_user)):
    user_id_str = str(user["_id"])
    query = {"$or": [{"user_id": user_id_str}, {"assigned_to": user_id_str}]}
    results = list(alarms.find(query).sort("alarm_time", 1))
    
    cleaned = []
    for item in results:
        doc = clean(item)
        role_key = doc.get("alarm_role", "STANDARD")
        if role_key in ALARM_ROLES:
            doc["role_meta"] = ALARM_ROLES[role_key]
        else:
            doc["role_meta"] = ALARM_ROLES["STANDARD"]
        cleaned.append(doc)
    return cleaned

@app.get("/api/admin/alarms")
def admin_list_alarms(user=Depends(require_roles("ADMIN"))):
    """Return operational alarm data for the administrative alarm console."""
    accounts = list(users.find({}, {"name": 1, "username": 1, "email": 1}))
    user_names = {str(account["_id"]): account.get("name") or account.get("username") or account.get("email") or "Unknown user" for account in accounts}
    snooze_counts = {}
    for event in snooze_logs.find({}, {"alarm_id": 1}):
        alarm_id = str(event.get("alarm_id", ""))
        snooze_counts[alarm_id] = snooze_counts.get(alarm_id, 0) + 1

    result = []
    for alarm in alarms.find({}).sort("created_at", -1):
        item = clean(alarm)
        item["user"] = user_names.get(str(item.get("user_id")), "Unknown user")
        item["assigned_challenge"] = item.get("challenge_type", "MATH")
        item["snooze_count"] = snooze_counts.get(item["id"], 0)
        result.append(item)
    return result

@app.patch("/api/admin/alarms/bulk-status")
def admin_bulk_alarm_status(data: AdminAlarmBulkStatus, user=Depends(require_roles("ADMIN"))):
    valid_ids = [ObjectId(alarm_id) for alarm_id in data.alarm_ids if ObjectId.is_valid(alarm_id)]
    if not valid_ids:
        raise HTTPException(400, "Select at least one valid alarm")
    result = alarms.update_many({"_id": {"$in": valid_ids}}, {"$set": {"enabled": data.enabled, "updated_at": datetime.now(timezone.utc)}})
    return {"updated": result.modified_count, "enabled": data.enabled}

@app.get("/api/admin/alarm-rules")
def get_global_alarm_rules(user=Depends(require_roles("ADMIN"))):
    defaults = GlobalAlarmRules().model_dump()
    stored = system_settings.find_one({"key": "alarm_rules"}) or {}
    return {**defaults, **stored.get("value", {})}

@app.put("/api/admin/alarm-rules")
def update_global_alarm_rules(data: GlobalAlarmRules, user=Depends(require_roles("ADMIN"))):
    value = data.model_dump()
    system_settings.update_one({"key": "alarm_rules"}, {"$set": {"value": value, "updated_at": datetime.now(timezone.utc)}}, upsert=True)
    return value

@app.get("/api/admin/settings")
def get_admin_settings(user=Depends(require_roles("ADMIN"))):
    defaults = {
        "general": {"app_name": "CognitiveWake", "logo_url": "", "timezone": "Asia/Kolkata", "language": "English"},
        "alarm_defaults": {"max_snoozes": 2, "default_sound": "default", "gradual_volume": False},
        "challenge_defaults": {"default_challenge": "MATH", "default_difficulty": "MEDIUM", "time_limit": 30},
        "notifications": {"email_enabled": True, "push_enabled": True, "email_template": "Your CognitiveWake alarm is ready.", "push_template": "Time to wake up and solve your challenge."},
        "security": {"two_factor_required": False, "session_timeout": 60, "password_policy": "Minimum 8 characters"},
        "integrations": {"api_key": "", "webhook_url": ""},
        "appearance": {"theme": "dark"},
        "data_backup": {"backup_frequency": "Weekly", "retention_days": 30}
    }
    stored = system_settings.find_one({"key": "admin_settings"}) or {}
    saved = stored.get("value", {})
    return {section: {**values, **saved.get(section, {})} for section, values in defaults.items()}

@app.put("/api/admin/settings")
def update_admin_settings(data: AdminSettingsUpdate, user=Depends(require_roles("ADMIN"))):
    system_settings.update_one({"key": "admin_settings"}, {"$set": {"value": data.values, "updated_at": datetime.now(timezone.utc)}}, upsert=True)
    return data.values

@app.delete("/api/admin/settings")
def reset_admin_settings(user=Depends(require_roles("ADMIN"))):
    system_settings.delete_one({"key": "admin_settings"})
    return {"message": "Settings reset to defaults"}

@app.get("/api/admin/alarms/missed-report")
def admin_missed_alarm_report(user=Depends(require_roles("ADMIN"))):
    user_names = {str(account["_id"]): account.get("name") or account.get("username") or account.get("email") or "Unknown user" for account in users.find({}, {"name": 1, "username": 1, "email": 1})}
    missed = list(alarm_sessions.find({"status": {"$ne": "COMPLETED"}}).sort("triggered_at", -1).limit(50))
    completed_count = alarm_sessions.count_documents({"status": "COMPLETED"})
    return {
        "total_sessions": alarm_sessions.count_documents({}),
        "completed_sessions": completed_count,
        "missed_alarms": len(missed),
        "recent_missed": [{"id": str(session["_id"]), "user": user_names.get(str(session.get("user_id")), "Unknown user"), "triggered_at": session.get("triggered_at"), "status": session.get("status", "MISSED"), "snoozed_count": session.get("snoozed_count", 0)} for session in missed]
    }

def notification_preferences_for(user_doc):
    defaults = {"bedtime_enabled": True, "bedtime_time": "21:30", "wake_up_enabled": True, "habit_alerts_enabled": True, "challenge_reminders_enabled": True, "progress_notifications_enabled": True, "assigned_user_alerts_enabled": True, "missed_alarm_alerts_enabled": True, "challenge_review_alerts_enabled": True, "weekly_cohort_reports_enabled": True}
    return {**defaults, **(user_doc.get("notification_preferences") or {})}

@app.get("/api/notifications/preferences")
def get_notification_preferences(user=Depends(current_user)):
    return notification_preferences_for(user)

@app.put("/api/notifications/preferences")
def update_notification_preferences(data: NotificationPreferencesUpdate, user=Depends(current_user)):
    updates = data.model_dump(exclude_unset=True)
    if updates.get("bedtime_time"):
        try: datetime.strptime(updates["bedtime_time"], "%H:%M")
        except ValueError: raise HTTPException(400, "Bedtime must use HH:MM format")
    result = {**notification_preferences_for(user), **updates}
    users.update_one({"_id": user["_id"]}, {"$set": {"notification_preferences": result}})
    return result

@app.get("/api/notifications")
def get_notifications(user=Depends(current_user)):
    uid = str(user["_id"])
    role = user.get("role", "USER")
    return [clean(record) for record in notifications.find({"$or": [{"user_id": uid}, {"audience": "ALL"}, {"audience": role}]}).sort("created_at", -1).limit(50)]

@app.post("/api/admin/announcements")
def create_platform_announcement(data: PlatformAnnouncementCreate, user=Depends(require_roles("ADMIN"))):
    title, message = data.title.strip(), data.message.strip()
    if not title or not message: raise HTTPException(400, "Title and message are required")
    audience = data.audience.upper()
    if audience not in {"ALL", "USER", "WELLNESS_COACH"}: raise HTTPException(400, "Audience must be USER, WELLNESS_COACH, or ALL")
    record = {"audience": audience, "type": "PLATFORM_ANNOUNCEMENT", "title": title, "message": message, "created_at": datetime.now(timezone.utc), "created_by": str(user["_id"])}
    result = notifications.insert_one(record)
    record["_id"] = result.inserted_id
    return clean(record)

@app.patch("/api/admin/alarms/{alarm_id}")
def admin_update_alarm_config(alarm_id: str, data: AdminAlarmConfigUpdate, user=Depends(require_roles("ADMIN"))):
    if not ObjectId.is_valid(alarm_id):
        raise HTTPException(400, "Invalid alarm ID")
    update_doc = data.model_dump(exclude_unset=True)
    if not update_doc:
        raise HTTPException(400, "No configuration changes provided")
    update_doc["updated_at"] = datetime.now(timezone.utc)
    result = alarms.update_one({"_id": ObjectId(alarm_id)}, {"$set": update_doc})
    if not result.matched_count:
        raise HTTPException(404, "Alarm not found")
    updated = alarms.find_one({"_id": ObjectId(alarm_id)}, {
        "alarm_role": 1, "alarm_time": 1, "timezone": 1, "repeat_type": 1,
        "repeat_days": 1, "sound": 1, "volume": 1, "snooze_enabled": 1,
        "snooze_duration": 1, "max_snoozes": 1, "enabled": 1,
        "is_mandatory": 1, "created_at": 1
    })
    return clean(updated)

@app.delete("/api/admin/alarms/{alarm_id}")
def admin_delete_alarm(alarm_id: str, user=Depends(require_roles("ADMIN"))):
    if not ObjectId.is_valid(alarm_id):
        raise HTTPException(400, "Invalid alarm ID")
    result = alarms.delete_one({"_id": ObjectId(alarm_id)})
    if not result.deleted_count:
        raise HTTPException(404, "Alarm not found")
    return {"message": "Alarm deleted"}

@app.post("/api/alarms")
def create_alarm(data: AlarmCreate, user=Depends(current_user)):
    now = datetime.now(timezone.utc)
    doc = data.model_dump()
    
    target_user_id = str(user["_id"])
    if doc.get("assigned_to"):
        if user["role"] not in ["ADMIN", "WELLNESS_COACH"]:
            raise HTTPException(403, "Only Admins and WellnessCoachs can assign alarms to other users")
        target_user_id = doc["assigned_to"]
    elif doc.get("is_mandatory") and user["role"] not in ["ADMIN", "WELLNESS_COACH"]:
        doc["is_mandatory"] = False

    doc.update({
        "user_id": target_user_id,
        "assigned_by": str(user["_id"]),
        "created_at": now,
        "updated_at": now
    })
    r = alarms.insert_one(doc)
    created = clean(alarms.find_one({"_id": r.inserted_id}))
    role_key = created.get("alarm_role", "STANDARD")
    created["role_meta"] = ALARM_ROLES.get(role_key, ALARM_ROLES["STANDARD"])
    return created

@app.get("/api/alarms/{alarm_id}")
def get_alarm(alarm_id: str, user=Depends(current_user)):
    a = alarms.find_one({"_id": ObjectId(alarm_id), "$or": [{"user_id": str(user["_id"])}, {"assigned_to": str(user["_id"])}]})
    if not a:
        raise HTTPException(404, "Alarm not found")
    c = clean(a)
    c["role_meta"] = ALARM_ROLES.get(c.get("alarm_role", "STANDARD"), ALARM_ROLES["STANDARD"])
    return c

@app.put("/api/alarms/{alarm_id}")
def update_alarm(alarm_id: str, data: AlarmCreate, user=Depends(current_user)):
    user_id_str = str(user["_id"])
    existing = alarms.find_one({"_id": ObjectId(alarm_id)})
    if not existing:
        raise HTTPException(404, "Alarm not found")
        
    if existing.get("is_mandatory") and existing.get("assigned_by") != user_id_str and user["role"] not in ["ADMIN", "WELLNESS_COACH"]:
        raise HTTPException(403, "Cannot edit mandatory alarms assigned by a WellnessCoach or Admin")

    update_doc = data.model_dump()
    update_doc["updated_at"] = datetime.now(timezone.utc)
    
    r = alarms.update_one({"_id": ObjectId(alarm_id)}, {"$set": update_doc})
    updated = clean(alarms.find_one({"_id": ObjectId(alarm_id)}))
    updated["role_meta"] = ALARM_ROLES.get(updated.get("alarm_role", "STANDARD"), ALARM_ROLES["STANDARD"])
    return updated

@app.delete("/api/alarms/{alarm_id}")
def delete_alarm(alarm_id: str, user=Depends(current_user)):
    user_id_str = str(user["_id"])
    existing = alarms.find_one({"_id": ObjectId(alarm_id)})
    if not existing:
        raise HTTPException(404, "Alarm not found")
        
    if existing.get("is_mandatory") and existing.get("assigned_by") != user_id_str and user["role"] not in ["ADMIN", "WELLNESS_COACH"]:
        raise HTTPException(403, "Cannot delete mandatory alarms assigned by a WellnessCoach or Admin")

    alarms.delete_one({"_id": ObjectId(alarm_id)})
    return {"message": "Alarm deleted"}

@app.patch("/api/alarms/{alarm_id}/toggle")
def toggle_alarm(alarm_id: str, user=Depends(current_user)):
    a = alarms.find_one({"_id": ObjectId(alarm_id)})
    if not a:
        raise HTTPException(404, "Alarm not found")
    alarms.update_one({"_id": a["_id"]}, {"$set": {"enabled": not a["enabled"]}})
    return {"enabled": not a["enabled"]}

@app.get("/api/challenges/types")
def get_challenge_types():
    """Return available puzzle type metadata for the frontend."""
    return list(CHALLENGE_TYPES.values())

@app.post("/api/challenges/generate")
def generate(kind="MATH", difficulty="MEDIUM", alarm_role="STANDARD", challenge_type: Optional[str] = None, user=Depends(current_user)):
    user_id_str = str(user["_id"])
    diff_upper = (difficulty or "MEDIUM").upper()

    # challenge_type param takes priority over kind for puzzle type selection
    effective_kind = (challenge_type or kind or "MATH").upper()

    # Determine if we should use the adaptive engine
    difficulty_score = None
    if diff_upper == "AUTO":
        difficulty_score = difficulty_engine.get_effective_score(
            user_id_str, alarm_role=alarm_role
        )

    if alarm_role and alarm_role.upper() != "STANDARD":
        c = generate_role_challenge(alarm_role, difficulty, difficulty_score=difficulty_score, kind=effective_kind)
    else:
        c = generate_challenge(effective_kind, difficulty, difficulty_score=difficulty_score)

    c.update({
        "created_by": user_id_str,
        "created_at": datetime.now(timezone.utc)
    })
    r = challenges.insert_one(c)
    return clean(challenges.find_one({"_id": r.inserted_id}))

def calculate_user_streak(user_id_str: str):
    """Return consecutive active-day streaks for users, wellness coaches, and admins.

    Active day sources include:
    - user_activity records (daily app engagement across all pages)
    - challenge_attempts
    - alarm_sessions
    - audit_logs (admin & coach actions)
    - alarms created or updated
    - user account activity
    """
    ist = timezone(timedelta(hours=5, minutes=30))
    now_ist = datetime.now(timezone.utc).astimezone(ist)
    today_str = now_ist.strftime("%Y-%m-%d")
    yesterday_str = (now_ist - timedelta(days=1)).strftime("%Y-%m-%d")

    def activity_day(value):
        if not value:
            return None
        if isinstance(value, datetime):
            utc_value = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
            return utc_value.astimezone(ist).strftime("%Y-%m-%d")
        if isinstance(value, str):
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                parsed = parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed
                return parsed.astimezone(ist).strftime("%Y-%m-%d")
            except ValueError:
                return value[:10] if len(value) >= 10 else None
        return None

    dates = set()

    # 1. user_activity collection (daily work on the platform)
    for act in user_activity.find({"user_id": user_id_str}):
        d = act.get("date") or activity_day(act.get("last_active") or act.get("created_at"))
        if d:
            dates.add(d)

    # 2. challenge attempts
    for attempt in challenge_attempts.find({"user_id": user_id_str}):
        day = activity_day(attempt.get("attempted_at") or attempt.get("created_at"))
        if day:
            dates.add(day)

    # 3. alarm sessions
    for session in alarm_sessions.find({"user_id": user_id_str}):
        day = activity_day(session.get("completed_at") or session.get("triggered_at") or session.get("created_at"))
        if day:
            dates.add(day)

    # 4. audit logs (actions performed by coach / admin / user)
    for alog in audit_logs.find({"actor_id": user_id_str}):
        day = activity_day(alog.get("timestamp") or alog.get("created_at"))
        if day:
            dates.add(day)

    # 5. user alarms
    for alm in alarms.find({"$or": [{"user_id": user_id_str}, {"assigned_by": user_id_str}]}):
        day = activity_day(alm.get("updated_at") or alm.get("created_at"))
        if day:
            dates.add(day)

    # 6. user document itself
    if ObjectId.is_valid(user_id_str):
        u_doc = users.find_one({"_id": ObjectId(user_id_str)})
        if u_doc:
            if u_doc.get("last_active_date"):
                dates.add(u_doc["last_active_date"])
            day = activity_day(u_doc.get("last_active") or u_doc.get("updated_at"))
            if day:
                dates.add(day)

    # Check if user has an existing performance doc with streaks
    existing_perf = performance.find_one({"user_id": user_id_str}) or {}
    prev_longest = existing_perf.get("longest_streak", 0)

    if not dates:
        return 0, prev_longest

    sorted_dates = sorted(list(dates), reverse=True)

    # Current streak calculation:
    # If the user was active today or yesterday, streak is active!
    current_streak = 0
    if sorted_dates[0] in [today_str, yesterday_str]:
        curr = datetime.strptime(sorted_dates[0], "%Y-%m-%d").date()
        current_streak = 1
        for i in range(1, len(sorted_dates)):
            prev = datetime.strptime(sorted_dates[i], "%Y-%m-%d").date()
            diff = (curr - prev).days
            if diff == 1:
                current_streak += 1
                curr = prev
            elif diff == 0:
                continue  # multiple activities on same day
            elif diff == 2:
                # 1 grace day allowance for continuous work / weekend buffer
                current_streak += 1
                curr = prev
            else:
                break
    else:
        # If user was active recently (within 2 days of yesterday)
        latest_date = datetime.strptime(sorted_dates[0], "%Y-%m-%d").date()
        days_since_latest = (datetime.strptime(today_str, "%Y-%m-%d").date() - latest_date).days
        if days_since_latest <= 2:
            current_streak = 1
            curr = latest_date
            for i in range(1, len(sorted_dates)):
                prev = datetime.strptime(sorted_dates[i], "%Y-%m-%d").date()
                diff = (curr - prev).days
                if diff <= 2 and diff > 0:
                    current_streak += 1
                    curr = prev
                elif diff == 0:
                    continue
                else:
                    break

    # Longest streak calculation
    date_objs = sorted([datetime.strptime(d, "%Y-%m-%d").date() for d in sorted_dates], reverse=True)
    longest_streak = 1 if date_objs else 0
    if date_objs:
        curr = date_objs[0]
        temp_streak = 1
        for i in range(1, len(date_objs)):
            prev = date_objs[i]
            diff = (curr - prev).days
            if diff <= 2 and diff > 0:
                temp_streak += 1
                curr = prev
            elif diff == 0:
                continue
            else:
                if temp_streak > longest_streak:
                    longest_streak = temp_streak
                temp_streak = 1
                curr = prev
        if temp_streak > longest_streak:
            longest_streak = temp_streak

    final_longest = max(longest_streak, current_streak, prev_longest)
    return current_streak, final_longest


def update_user_performance_stats(user_id_str: str):
    current_streak, longest_streak = calculate_user_streak(user_id_str)
    attempts = list(challenge_attempts.find({"user_id": user_id_str}))
    correct_attempts_count = sum(1 for x in attempts if x.get("correct"))
    
    total_sessions = alarm_sessions.count_documents({"user_id": user_id_str})
    completed_sessions = alarm_sessions.count_documents({"user_id": user_id_str, "status": "COMPLETED"})
    
    total = max(total_sessions, len(attempts))
    completed = max(completed_sessions, correct_attempts_count)
    failed = max(0, total - completed)
    
    accuracy = (correct_attempts_count / len(attempts) * 100) if attempts else 0
    avg = (sum(x.get("response_time", 0) for x in attempts) / len(attempts)) if attempts else 0

    existing_perf = performance.find_one({"user_id": user_id_str}) or {}
    final_longest = max(longest_streak, existing_perf.get("longest_streak", 0), current_streak)

    perf_doc = {
        "user_id": user_id_str,
        "total_alarms": total,
        "completed_alarms": completed,
        "failed_alarms": failed,
        "accuracy": round(accuracy, 2),
        "average_response_time": round(avg, 2),
        "current_streak": current_streak,
        "longest_streak": final_longest,
        "updated_at": datetime.now(timezone.utc)
    }

    performance.update_one({"user_id": user_id_str}, {"$set": perf_doc}, upsert=True)
    if ObjectId.is_valid(user_id_str):
        users.update_one({"_id": ObjectId(user_id_str)}, {"$set": {"current_streak": current_streak, "longest_streak": final_longest}})
    return perf_doc

@app.post("/api/challenges/{challenge_id}/submit")
def submit(challenge_id: str, data: ChallengeSubmit, user=Depends(current_user)):
    c = challenges.find_one({"_id": ObjectId(challenge_id)})
    if not c:
        raise HTTPException(404, "Challenge not found")
    
    user_id_str = str(user["_id"])
    user_ans = data.answer.strip().lower()
    target_ans = str(c["correct_answer"]).strip().lower()
    correct = (user_ans == target_ans)
    
    attempt = {
        "user_id": user_id_str,
        "challenge_id": challenge_id,
        "challenge_type": c.get("type") or c.get("challenge_type") or "MATH",
        "alarm_role": c.get("alarm_role", "STANDARD"),
        "answer": data.answer,
        "correct": correct,
        "response_time": data.response_time,
        "attempted_at": datetime.now(timezone.utc)
    }
    challenge_attempts.insert_one(attempt)

    if correct:
        alarm_sessions.insert_one({
            "challenge_id": challenge_id,
            "user_id": user_id_str,
            "triggered_at": datetime.now(timezone.utc),
            "completed_at": datetime.now(timezone.utc),
            "completed": True,
            "status": "COMPLETED",
            "alarm_role": c.get("alarm_role", "STANDARD")
        })

    perf = update_user_performance_stats(user_id_str)

    # Update difficulty engine score after every attempt with ML & SD boost models
    time_limit = c.get("time_limit", 25)
    diff_res = difficulty_engine.update_difficulty(
        user_id_str,
        was_correct=correct,
        response_time=data.response_time,
        time_limit=time_limit,
        current_streak=perf.get("current_streak", 0),
        return_dict=True,
    )

    return {
        "correct": correct,
        "message": "Correct! Alarm dismissed." if correct else "Incorrect. Try again.",
        "current_streak": perf["current_streak"],
        "longest_streak": perf["longest_streak"],
        "difficulty_score": diff_res["new_score"],
        "difficulty_label": diff_res["difficulty_label"],
        "ml_boost": diff_res["ml_boost"],
        "sd_boost": diff_res["sd_boost"],
        "predicted_response_time": diff_res["predicted_response_time"],
        "wakefulness_index": diff_res["wakefulness_index"],
        "cognitive_stability_index": diff_res["cognitive_stability_index"],
        "std_dev_response_time": diff_res["std_dev_response_time"],
        "sd_boost_active": diff_res["sd_boost_active"],
    }

@app.get("/api/challenges/history")
def challenge_history(user=Depends(current_user)):
    return [clean(x) for x in challenge_attempts.find({"user_id": str(user["_id"])}).sort("attempted_at", -1).limit(100)]

@app.get("/api/difficulty")
def get_difficulty(user=Depends(current_user)):
    """Get the current user's adaptive difficulty info with ML & SD model analytics."""
    uid = str(user["_id"])
    return difficulty_engine.get_difficulty_info(uid)

@app.get("/api/difficulty/{user_id}")
def get_user_difficulty(user_id: str, user=Depends(require_roles("ADMIN"))):
    """Administrator-only: view a user's difficulty info."""
    return difficulty_engine.get_difficulty_info(user_id)

@app.post("/api/alarms/{alarm_id}/snooze")
def snooze_alarm(alarm_id: str, duration: Optional[int] = 5, user=Depends(current_user)):
    """Log a snooze event for performance analytics and behavioral engine evaluation."""
    uid = str(user["_id"])
    role = "STANDARD"
    if ObjectId.is_valid(alarm_id):
        a = alarms.find_one({"_id": ObjectId(alarm_id)})
        if a:
            role = a.get("alarm_role", "STANDARD")
    
    snooze_logs.insert_one({
        "user_id": uid,
        "alarm_id": alarm_id,
        "alarm_role": role,
        "duration_minutes": duration or 5,
        "snoozed_at": datetime.now(timezone.utc)
    })
    return {"message": "Snooze event recorded", "alarm_role": role}

@app.get("/api/ml-sd/analytics")
def get_ml_sd_analytics(user=Depends(current_user)):
    """Get detailed ML prediction, SD cognitive stability, accuracy, snooze, and alarm ecosystem metrics."""
    uid = str(user["_id"])
    diff_info = difficulty_engine.get_difficulty_info(uid)

    attempts = list(challenge_attempts.find({"user_id": uid}).sort("attempted_at", -1).limit(100))
    attempt_trends = [
        {
            "id": str(a["_id"]),
            "response_time": a.get("response_time", 0.0),
            "correct": a.get("correct", False),
            "alarm_role": a.get("alarm_role", "STANDARD"),
            "attempted_at": a.get("attempted_at", datetime.now(timezone.utc)).isoformat()
        }
        for a in reversed(attempts[:30])
    ]

    total_attempts = len(attempts)
    correct_count = sum(1 for a in attempts if a.get("correct"))
    accuracy_rate = round((correct_count / total_attempts * 100), 1) if total_attempts > 0 else 0.0
    rts = [a.get("response_time", 0.0) for a in attempts if a.get("response_time")]
    best_rt = round(min(rts), 2) if rts else 0.0
    mean_rt = diff_info.get("mean_response_time", 0.0)

    # Snooze Analytics
    user_snoozes = list(snooze_logs.find({"user_id": uid}))
    total_snoozes = len(user_snoozes)
    snooze_time_penalty = sum(s.get("duration_minutes", 5) for s in user_snoozes)
    
    user_sessions = list(alarm_sessions.find({"user_id": uid}))
    total_sessions = len(user_sessions) or max(1, len(set(a.get("attempted_at", "")[:10] for a in attempts if "attempted_at" in a)))
    completed_sessions = sum(
        1 for session in user_sessions
        if session.get("completed") or session.get("status") == "COMPLETED" or session.get("completed_at")
    )
    alarm_completion_rate = round((completed_sessions / len(user_sessions)) * 100, 1) if user_sessions else 0.0
    snoozed_sessions_count = len(set(s.get("alarm_id") for s in user_snoozes if s.get("alarm_id")))
    
    avg_snoozes_per_alarm = round(total_snoozes / max(1, total_sessions), 2)
    zero_snooze_sessions = max(0, total_sessions - snoozed_sessions_count)
    zero_snooze_compliance = round((zero_snooze_sessions / max(1, total_sessions)) * 100, 1)
    snooze_rate = round((snoozed_sessions_count / max(1, total_sessions)) * 100, 1)
    
    snooze_wakefulness_impact = round(max(0.0, total_snoozes * 4.5), 1) # Penalty points deducted from peak wakefulness

    # Puzzle / Challenge Type Breakdown
    puzzle_types = ["MATH", "WORD_SCRAMBLE", "SEQUENCE", "MEMORY", "TRIVIA", "COLOR_MATCH"]
    puzzle_breakdown = {}
    for ptype in puzzle_types:
        p_attempts = [a for a in attempts if a.get("challenge_type") == ptype or a.get("kind") == ptype or (ptype == "MATH" and not a.get("challenge_type"))]
        p_total = len(p_attempts)
        p_correct = sum(1 for a in p_attempts if a.get("correct"))
        p_acc = round((p_correct / p_total * 100), 1) if p_total > 0 else 0.0
        p_rts = [a.get("response_time", 0) for a in p_attempts if a.get("response_time")]
        p_avg_rt = round(sum(p_rts) / len(p_rts), 1) if p_rts else 0.0
        puzzle_breakdown[ptype] = {
            "attempts": p_total,
            "correct": p_correct,
            "accuracy": p_acc,
            "avg_response_time": p_avg_rt
        }

    # Alarm Role Performance Breakdown
    roles_list = ["STANDARD", "DRILL_SERGEANT", "ZEN_GURU", "CORPORATE_EXEC", "MAD_SCIENTIST", "FITNESS_COACH"]
    role_breakdown = {}
    for rkey in roles_list:
        r_attempts = [a for a in attempts if a.get("alarm_role") == rkey]
        r_total = len(r_attempts)
        r_correct = sum(1 for a in r_attempts if a.get("correct"))
        r_acc = round((r_correct / r_total * 100), 1) if r_total > 0 else 0.0
        r_snoozes = sum(1 for s in user_snoozes if s.get("alarm_role") == rkey)
        role_breakdown[rkey] = {
            "attempts": r_total,
            "correct": r_correct,
            "accuracy": r_acc,
            "snoozes": r_snoozes
        }

    # Time of Day Performance
    tod_stats = {"Morning (5-10am)": {"attempts": 0, "correct": 0}, "Day (10am-5pm)": {"attempts": 0, "correct": 0}, "Evening (5-10pm)": {"attempts": 0, "correct": 0}, "Night (10pm-5am)": {"attempts": 0, "correct": 0}}
    for a in attempts:
        dt = a.get("attempted_at")
        h = dt.hour if isinstance(dt, datetime) else 8
        if 5 <= h < 10:
            key = "Morning (5-10am)"
        elif 10 <= h < 17:
            key = "Day (10am-5pm)"
        elif 17 <= h < 22:
            key = "Evening (5-10pm)"
        else:
            key = "Night (10pm-5am)"
        tod_stats[key]["attempts"] += 1
        if a.get("correct"):
            tod_stats[key]["correct"] += 1

    for k, v in tod_stats.items():
        v["accuracy"] = round((v["correct"] / v["attempts"] * 100), 1) if v["attempts"] > 0 else 0.0

    # Behavior Tier Classifications
    if mean_rt > 0 and mean_rt <= 5.0:
        reaction_speed_tier = "Lightning (⚡ <5s)"
    elif mean_rt <= 12.0:
        reaction_speed_tier = "Optimal (🚀 5-12s)"
    else:
        reaction_speed_tier = "Groggy (😴 >12s)"

    cv = diff_info.get("coeff_variation", 0.0)
    if cv > 0 and cv <= 0.2:
        consistency_tier = "Ultra Consistent (🎯 CV < 0.2)"
    elif cv <= 0.4:
        consistency_tier = "Moderate Stability (⚖️ CV 0.2-0.4)"
    else:
        consistency_tier = "High Jitter (📉 CV > 0.4)"

    current_streak, longest_streak = calculate_user_streak(uid)

    analytics_payload = {
        "user_id": uid,
        "streak": current_streak,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "difficulty_score": diff_info.get("difficulty_score", 0.5),
        "difficulty_label": diff_info.get("difficulty_label", "MEDIUM"),
        "ml_boost": diff_info.get("ml_boost", 0.0),
        "predicted_response_time": diff_info.get("predicted_response_time", 15.0),
        "wakefulness_index": diff_info.get("wakefulness_index", 70.0),
        "is_ml_trained": diff_info.get("is_ml_trained", False),
        "sd_boost": diff_info.get("sd_boost", 0.0),
        "std_dev_response_time": diff_info.get("std_dev_response_time", 0.0),
        "mean_response_time": mean_rt,
        "coeff_variation": cv,
        "cognitive_stability_index": diff_info.get("cognitive_stability_index", 70.0),
        "sd_boost_active": diff_info.get("sd_boost_active", False),
        "total_attempts": total_attempts,
        "accuracy_rate": accuracy_rate,
        "best_response_time": best_rt,
        "reaction_speed_tier": reaction_speed_tier,
        "consistency_tier": consistency_tier,
        "habit_score": diff_info.get("habit_score", 75.0),
        "habit_tier": diff_info.get("habit_tier", "Building Habit 📈"),
        "habit_breakdown": diff_info.get("habit_breakdown", {}),
        "recommendations": diff_info.get("recommendations", {}),
        "attempt_trends": attempt_trends,
        # Extended Snooze & Ecosystem Analytics
        "snooze_stats": {
            "total_snoozes": total_snoozes,
            "snooze_time_penalty": snooze_time_penalty,
            "avg_snoozes_per_alarm": avg_snoozes_per_alarm,
            "zero_snooze_compliance": zero_snooze_compliance,
            "snooze_rate": snooze_rate,
            "snooze_wakefulness_impact": snooze_wakefulness_impact,
        },
        "puzzle_breakdown": puzzle_breakdown,
        "role_breakdown": role_breakdown,
        "time_of_day_stats": tod_stats,
        "total_alarms_created": alarms.count_documents({"user_id": uid}),
        "alarm_sessions": len(user_sessions),
        "completed_alarm_sessions": completed_sessions,
        "alarm_completion_rate": alarm_completion_rate,
        "puzzles_solved": correct_count,
    }

    # --- Auto-save recommendation snapshot ----------------------------------
    recs = diff_info.get("recommendations", {})

    def _save_rec(category: str, items):
        if not items:
            return
        text = items[0] if isinstance(items, list) else str(items)
        recommendation_logs.insert_one({
            "user_id": uid,
            "category": category,
            "message": text,
            "created_at": datetime.now(timezone.utc),
        })

    # derive a single current-state recommendation from the analytics payload
    if accuracy_rate >= 60 and total_snoozes <= 2:
        current_msg = ("Your overall performance is stable. Keep practicing quiz and the other challenge "
                       "types to maintain your progress.")
    elif accuracy_rate < 40:
        current_msg = ("Your accuracy needs improvement. Focus on easier challenges to build confidence.")
    elif total_snoozes > 3:
        current_msg = ("Snooze frequency is high. Try placing your phone across the room to avoid snoozing.")
    else:
        current_msg = ("Good progress! Keep your alarm schedule consistent to strengthen your habit score.")

    # Save the current recommendation
    recommendation_logs.insert_one({
        "user_id": uid,
        "category": "Current",
        "message": current_msg,
        "created_at": datetime.now(timezone.utc),
    })

    # Save sub-category recommendations (first item each)
    for cat, key in [
        ("Latest Challenge Performance", "personalized_challenges"),
        ("Weakest Challenge Type",       "sleep_improvement"),
        ("Habit Guidance",               "habit_guidance"),
        ("Productivity",                 "productivity"),
    ]:
        items = recs.get(key, [])
        if items:
            recommendation_logs.insert_one({
                "user_id": uid,
                "category": cat,
                "message": items[0],
                "created_at": datetime.now(timezone.utc),
            })
    # -----------------------------------------------------------------------

    return analytics_payload

@app.post("/api/ml-sd/retrain")
def retrain_ml_model(user=Depends(current_user)):
    """Retrain the ML model on user's attempt dataset."""
    uid = str(user["_id"])
    diff_info = difficulty_engine.get_difficulty_info(uid)
    return {
        "status": "success",
        "message": "Predictive Behavioral Engine updated successfully",
        "is_ml_trained": diff_info.get("is_ml_trained", False),
        "predicted_response_time": diff_info.get("predicted_response_time", 15.0),
        "wakefulness_index": diff_info.get("wakefulness_index", 70.0),
        "habit_score": diff_info.get("habit_score", 75.0),
        "habit_tier": diff_info.get("habit_tier", "Building Habit 📈"),
    }

@app.get("/api/ml-sd/recommendations")
def get_recommendations(user=Depends(current_user)):
    """Return recommendation history for the user (latest 50)."""
    uid = str(user["_id"])
    docs = list(recommendation_logs.find({"user_id": uid}).sort("created_at", -1).limit(50))
    result = []
    for d in docs:
        result.append({
            "id": str(d["_id"]),
            "category": d.get("category", "General"),
            "message": d.get("message", ""),
            "created_at": d["created_at"].isoformat() if isinstance(d.get("created_at"), datetime) else str(d.get("created_at", "")),
        })
    return result

@app.get("/api/ml-sd/behavior-timeseries")
def get_behavior_timeseries(days: int = 30, user=Depends(current_user)):
    """Return daily wake-up consistency, snooze count, challenge activity, and accuracy for charts."""
    uid = str(user["_id"])
    # --- challenge attempts per day ---
    attempts = list(challenge_attempts.find({"user_id": uid}).sort("attempted_at", -1).limit(300))
    # --- snooze logs per day ---
    user_snoozes = list(snooze_logs.find({"user_id": uid}).sort("snoozed_at", -1).limit(300))
    # --- alarm sessions per day ---
    sessions = list(alarm_sessions.find({"user_id": uid}).sort("triggered_at", -1).limit(300))

    IST_OFFSET = timedelta(hours=5, minutes=30)

    # Group attempts by date (IST)
    daily_attempts = defaultdict(lambda: {"total": 0, "correct": 0})
    for a in attempts:
        dt = a.get("attempted_at")
        if isinstance(dt, datetime):
            day = (dt + IST_OFFSET).strftime("%m-%d")
            daily_attempts[day]["total"] += 1
            if a.get("correct"):
                daily_attempts[day]["correct"] += 1

    # Group snoozes by date (IST)
    daily_snoozes = defaultdict(int)
    for s in user_snoozes:
        dt = s.get("snoozed_at")
        if isinstance(dt, datetime):
            daily_snoozes[(dt + IST_OFFSET).strftime("%m-%d")] += 1

    # Group sessions (alarms triggered) by date (IST) → wake-up consistency
    daily_sessions = defaultdict(lambda: {"triggers": 0, "completed": 0})
    for s in sessions:
        dt = s.get("triggered_at") or s.get("completed_at")
        if isinstance(dt, datetime):
            day = (dt + IST_OFFSET).strftime("%m-%d")
        elif isinstance(dt, str) and len(dt) >= 10:
            day = dt[5:10]
        else:
            continue
        daily_sessions[day]["triggers"] += 1
        if s.get("completed") or s.get("status") == "COMPLETED" or s.get("completed_at"):
            daily_sessions[day]["completed"] += 1

    # Generate a contiguous sequence of days ending today (IST)
    today_ist = (datetime.now(timezone.utc) + IST_OFFSET).date()
    all_days = [(today_ist - timedelta(days=i)).strftime("%m-%d") for i in range(days - 1, -1, -1)]

    timeseries = []
    for day in all_days:
        sess = daily_sessions[day]
        att = daily_attempts[day]
        completed = max(sess["completed"], att["correct"])
        triggers = max(sess["triggers"], att["total"], 1 if completed > 0 else 0)
        wake_pct = round((completed / triggers) * 100, 1) if triggers > 0 else 0.0
        acc = round((att["correct"] / att["total"]) * 100, 1) if att["total"] > 0 else 0.0
        timeseries.append({
            "day": day,
            "wake_consistency": wake_pct,
            "snooze_count": daily_snoozes[day],
            "challenge_activity": att["total"],
            "accuracy": acc,
        })

    return timeseries

@app.get("/api/performance")
def user_performance(user=Depends(current_user)):
    uid = str(user["_id"])
    perf = update_user_performance_stats(uid)
    # Enrich with difficulty engine data including ML & SD metrics and ML Habit Score
    diff_info = difficulty_engine.get_difficulty_info(uid)
    perf["difficulty_score"] = diff_info["difficulty_score"]
    perf["difficulty_label"] = diff_info["difficulty_label"]
    perf["difficulty_pct"] = diff_info["difficulty_pct"]
    perf["difficulty_sparkline"] = diff_info["sparkline"]
    perf["ml_boost"] = diff_info.get("ml_boost", 0.0)
    perf["predicted_response_time"] = diff_info.get("predicted_response_time", 15.0)
    perf["wakefulness_index"] = diff_info.get("wakefulness_index", 70.0)
    perf["is_ml_trained"] = diff_info.get("is_ml_trained", False)
    perf["sd_boost"] = diff_info.get("sd_boost", 0.0)
    perf["std_dev_response_time"] = diff_info.get("std_dev_response_time", 0.0)
    perf["cognitive_stability_index"] = diff_info.get("cognitive_stability_index", 70.0)
    perf["sd_boost_active"] = diff_info.get("sd_boost_active", False)
    perf["habit_score"] = diff_info.get("habit_score", 75.0)
    perf["habit_tier"] = diff_info.get("habit_tier", "Building Habit 📈")
    perf["habit_breakdown"] = diff_info.get("habit_breakdown", {})
    return perf


@app.get("/api/admin/users")
def admin_users(role: str = "USER", user=Depends(require_roles("ADMIN"))):
    role = role.upper()
    if role not in {"USER", "WELLNESS_COACH", "ADMIN"}:
        raise HTTPException(400, "Invalid role filter")
    result = []
    # Each administration area retrieves only the role it is responsible for.
    for account in users.find({"role": role}, {"password_hash": 0}):
        uid = str(account["_id"])
        latest_attempt = challenge_attempts.find_one({"user_id": uid}, sort=[("attempted_at", -1)])
        latest_session = alarm_sessions.find_one({"user_id": uid}, sort=[("triggered_at", -1)])
        activity_dates = [
            (latest_attempt or {}).get("attempted_at"),
            (latest_session or {}).get("triggered_at"),
            account.get("updated_at"),
            account.get("created_at"),
        ]
        dated_activity = [value for value in activity_dates if isinstance(value, datetime)]
        last_active = max(dated_activity) if dated_activity else None
        account["last_active"] = last_active
        cs, ls = calculate_user_streak(uid)
        account["current_streak"] = cs
        account["longest_streak"] = ls
        account["streak"] = cs
        account["account_status"] = account.get("account_status", "ACTIVE" if account.get("is_active", True) else "SUSPENDED")
        account["alarm_count"] = alarms.count_documents({"user_id": uid})
        account["challenge_attempt_count"] = challenge_attempts.count_documents({"user_id": uid})
        result.append(clean(account))
    return result

@app.get("/api/admin/users/{user_id}/detail")
def admin_user_detail(user_id: str, user=Depends(require_roles("ADMIN"))):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(400, "Invalid user ID")
    account = users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    if not account:
        raise HTTPException(404, "User not found")
    attempts = list(challenge_attempts.find({"user_id": user_id}).sort("attempted_at", -1).limit(20))
    user_alarms = list(alarms.find({"user_id": user_id}).sort("created_at", -1).limit(20))
    sessions = list(alarm_sessions.find({"user_id": user_id}).sort("triggered_at", -1).limit(100))
    completed = sum(1 for session in sessions if session.get("completed") or session.get("completed_at") or session.get("status") == "COMPLETED")
    daily = []
    today = datetime.now(timezone.utc).date()
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        day_sessions = [s for s in sessions if isinstance(s.get("triggered_at"), datetime) and s["triggered_at"].date() == day]
        done = sum(1 for s in day_sessions if s.get("completed") or s.get("completed_at") or s.get("status") == "COMPLETED")
        daily.append({"date": day.isoformat(), "rate": round(done / len(day_sessions) * 100) if day_sessions else 0})
    return {
        "user": clean(account),
        "alarms": [clean(a) for a in user_alarms],
        "challenges": [clean(a) for a in attempts],
        "summary": {
            "alarm_count": len(user_alarms), "alarm_sessions": len(sessions),
            "completed_sessions": completed, "challenge_attempts": len(attempts),
            "correct_challenges": sum(1 for attempt in attempts if attempt.get("correct")),
        },
        "wake_success_rate": round(completed / len(sessions) * 100, 1) if sessions else 0,
        "wake_success_trend": daily,
    }

@app.patch("/api/admin/users/{user_id}/account")
def admin_account_action(user_id: str, data: AccountAction, user=Depends(require_roles("ADMIN"))):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(400, "Invalid user ID")
    action = data.action.upper()
    if action == "RESET_PASSWORD":
        if not data.password or len(data.password) < 6:
            raise HTTPException(400, "Temporary password must be at least 6 characters")
        users.update_one({"_id": ObjectId(user_id)}, {"$set": {"password_hash": hash_password(data.password), "updated_at": datetime.now(timezone.utc)}})
    elif action in {"ACTIVE", "SUSPENDED", "BANNED"}:
        users.update_one({"_id": ObjectId(user_id)}, {"$set": {"account_status": action, "is_active": action == "ACTIVE", "updated_at": datetime.now(timezone.utc)}})
    else:
        raise HTTPException(400, "Unsupported account action")
    return {"message": "Account updated"}

@app.post("/api/admin/wellness_coachs")
def admin_create_wellness_coach(data: WellnessCoachCreate, user=Depends(require_roles("ADMIN"))):
    name = data.name.strip()
    email = data.email.strip().lower()
    if not name:
        raise HTTPException(400, "WellnessCoach name is required")
    if "@" not in email:
        raise HTTPException(400, "A valid email address is required")
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if users.find_one({"email": email}):
        raise HTTPException(409, "Email already registered")

    username_base = "".join(ch for ch in email.split("@", 1)[0] if ch.isalnum() or ch in "._-") or "wellness_coach"
    username = username_base
    suffix = 1
    while users.find_one({"username": username}):
        suffix += 1
        username = f"{username_base}{suffix}"

    now = datetime.now(timezone.utc)
    wellness_coach = {
        "name": name,
        "username": username,
        "email": email,
        "password_hash": hash_password(data.password),
        "role": "WELLNESS_COACH",
        "timezone": data.timezone,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    result = users.insert_one(wellness_coach)
    audit_logs.insert_one({"actor_id": str(user["_id"]), "actor_name": user.get("name", "Admin"), "action": "Invited wellness_coach", "target": name, "timestamp": now})
    return clean(users.find_one({"_id": result.inserted_id}, {"password_hash": 0}))

@app.patch("/api/admin/wellness_coachs/{wellness_coach_id}")
def admin_update_wellness_coach(wellness_coach_id: str, data: WellnessCoachUpdate, user=Depends(require_roles("ADMIN"))):
    if not ObjectId.is_valid(wellness_coach_id):
        raise HTTPException(400, "Invalid wellness_coach id")
    wellness_coach = users.find_one({"_id": ObjectId(wellness_coach_id), "role": "WELLNESS_COACH"})
    if not wellness_coach:
        raise HTTPException(404, "WellnessCoach not found")

    changes = {}
    if data.name is not None:
        name = data.name.strip()
        if not name:
            raise HTTPException(400, "WellnessCoach name is required")
        changes["name"] = name
    if data.email is not None:
        email = data.email.strip().lower()
        if "@" not in email:
            raise HTTPException(400, "A valid email address is required")
        duplicate = users.find_one({"email": email, "_id": {"$ne": ObjectId(wellness_coach_id)}})
        if duplicate:
            raise HTTPException(409, "Email already registered")
        changes["email"] = email
    if data.permissions is not None:
        changes["permissions"] = data.permissions
    if not changes:
        raise HTTPException(400, "No changes provided")

    changes["updated_at"] = datetime.now(timezone.utc)
    users.update_one({"_id": ObjectId(wellness_coach_id)}, {"$set": changes})
    audit_logs.insert_one({"actor_id": str(user["_id"]), "actor_name": user.get("name", "Admin"), "action": "Updated wellness_coach permissions", "target": wellness_coach.get("name"), "timestamp": datetime.now(timezone.utc)})
    return clean(users.find_one({"_id": ObjectId(wellness_coach_id)}, {"password_hash": 0}))

@app.get("/api/admin/wellness_coach-activity")
def admin_wellness_coach_activity(user=Depends(require_roles("ADMIN"))):
    return [clean(item) for item in audit_logs.find({}).sort("timestamp", -1).limit(30)]

@app.patch("/api/admin/users/{user_id}/role")
def admin_role(user_id: str, data: RoleUpdate, user=Depends(require_roles("ADMIN"))):
    if data.role not in ["USER", "WELLNESS_COACH", "ADMIN"]:
        raise HTTPException(400, "Invalid role")
    r = users.update_one({"_id": ObjectId(user_id)}, {"$set": {"role": data.role, "updated_at": datetime.now(timezone.utc)}})
    if not r.matched_count:
        raise HTTPException(404, "User not found")
    audit_logs.insert_one({
        "user_id": str(user["_id"]),
        "action": "CHANGE_ROLE",
        "target_type": "USER",
        "target_id": user_id,
        "timestamp": datetime.now(timezone.utc),
        "metadata": {"role": data.role}
    })
    return {"message": "Role updated"}

@app.patch("/api/admin/users/{user_id}/wellness_coach")
def assign_user_to_wellness_coach(user_id: str, data: WellnessCoachAssignment, user=Depends(require_roles("ADMIN"))):
    """Admin assigns one standard user to a wellness_coach (or removes the assignment)."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(400, "Invalid user id")
    target = users.find_one({"_id": ObjectId(user_id)})
    if not target or target.get("role") != "USER":
        raise HTTPException(400, "Only USER accounts can be assigned")
    wellness_coach_id = data.wellness_coach_id
    if wellness_coach_id:
        wellness_coach_filter = {"role": "WELLNESS_COACH", "$or": [{"email": wellness_coach_id.lower()}, {"username": wellness_coach_id.lower()}, {"name": {"$regex": f"^{wellness_coach_id}$", "$options": "i"}}]}
        if ObjectId.is_valid(wellness_coach_id):
            wellness_coach_filter["$or"].append({"_id": ObjectId(wellness_coach_id)})
        wellness_coach = users.find_one(wellness_coach_filter)
        if not wellness_coach:
            raise HTTPException(404, "WellnessCoach not found")
        wellness_coach_id = str(wellness_coach["_id"])
    users.update_one({"_id": ObjectId(user_id)}, {"$set": {"wellness_coach_id": wellness_coach_id, "updated_at": datetime.now(timezone.utc)}})
    return {"message": "WellnessCoach assignment updated"}

@app.patch("/api/admin/users/{user_id}/status")
def admin_status(user_id: str, data: StatusUpdate, user=Depends(require_roles("ADMIN", "WELLNESS_COACH"))):
    r = users.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_active": data.is_active, "updated_at": datetime.now(timezone.utc)}})
    if not r.matched_count:
        raise HTTPException(404, "User not found")
    return {"message": f"User status updated to {'Active' if data.is_active else 'Inactive'}"}

@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(user_id: str, user=Depends(require_roles("ADMIN"))):
    if user_id == str(user["_id"]):
        raise HTTPException(400, "Cannot delete your own admin account")
    r = users.delete_one({"_id": ObjectId(user_id)})
    if not r.deleted_count:
        raise HTTPException(404, "User not found")
    return {"message": "User deleted"}

@app.get("/api/admin/analytics")
def admin_analytics(start: Optional[str] = None, end: Optional[str] = None, user=Depends(require_roles("ADMIN"))):
    """Date-scoped platform analytics for the administrator reporting dashboard."""
    def parse_date(raw, fallback):
        try: return datetime.fromisoformat(raw).date() if raw else fallback
        except ValueError: raise HTTPException(400, "Dates must use YYYY-MM-DD")
    def as_utc(value):
        if isinstance(value, datetime): return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
        if isinstance(value, str):
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
            except ValueError: return None
        return None

    end_date = parse_date(end, datetime.now(timezone.utc).date())
    start_date = parse_date(start, end_date - timedelta(days=29))
    if start_date > end_date or (end_date - start_date).days > 365:
        raise HTTPException(400, "Choose a range of up to 365 days")
    dates = [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]
    date_keys = [day.isoformat() for day in dates]
    users_docs, attempts, sessions, alarm_docs, snoozes = list(users.find({}, {"created_at": 1, "role": 1})), list(challenge_attempts.find({})), list(alarm_sessions.find({})), list(alarms.find({})), list(snooze_logs.find({}))
    def in_range(value):
        parsed = as_utc(value)
        return parsed and start_date <= parsed.date() <= end_date
    def daily_counts(records, field, predicate=lambda _: True):
        counts = {key: 0 for key in date_keys}
        for item in records:
            parsed = as_utc(item.get(field))
            if parsed and start_date <= parsed.date() <= end_date and predicate(item): counts[parsed.date().isoformat()] += 1
        return counts
    created = daily_counts(users_docs, "created_at", lambda item: item.get("role") != "WELLNESS_COACH")
    created_coaches = daily_counts(users_docs, "created_at", lambda item: item.get("role") == "WELLNESS_COACH")
    attempts_total, attempts_correct = daily_counts(attempts, "attempted_at"), daily_counts(attempts, "attempted_at", lambda item: bool(item.get("correct")))
    sessions_total, sessions_done = daily_counts(sessions, "triggered_at"), daily_counts(sessions, "triggered_at", lambda item: item.get("status") == "COMPLETED" or item.get("completed") is True)
    active_by_day = {key: set() for key in date_keys}
    for item in attempts:
        parsed = as_utc(item.get("attempted_at"))
        if parsed and start_date <= parsed.date() <= end_date: active_by_day[parsed.date().isoformat()].add(str(item.get("user_id")))
    solve_by_difficulty = {}
    for item in attempts:
        if in_range(item.get("attempted_at")):
            level = item.get("difficulty", "MEDIUM")
            solve_by_difficulty.setdefault(level, []).append(float(item.get("response_time") or 0))
    peak_hours = [0] * 24
    for alarm in alarm_docs:
        raw = str(alarm.get("alarm_time", ""))
        try: hour = datetime.strptime(raw[:5], "%H:%M").hour
        except ValueError:
            try: hour = datetime.strptime(raw.strip().upper(), "%I:%M %p").hour
            except ValueError: continue
        peak_hours[hour] += 1
    total_snoozes = sum(1 for item in snoozes if in_range(item.get("snoozed_at")))
    dismisses = sum(sessions_done.values())
    total_accounts = max(1, len(users_docs))
    return {
        "range": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "series": [{"date": key, "user_growth": created[key], "wellness_coach_growth": created_coaches[key], "retention": round(len(active_by_day[key]) / total_accounts * 100, 1), "wake_success": round(sessions_done[key] / sessions_total[key] * 100, 1) if sessions_total[key] else 0, "challenge_completion": round(attempts_correct[key] / attempts_total[key] * 100, 1) if attempts_total[key] else 0, "accuracy": round(attempts_correct[key] / attempts_total[key] * 100, 1) if attempts_total[key] else 0} for key in date_keys],
        "avg_solve_time_by_difficulty": [{"difficulty": level, "seconds": round(sum(values) / len(values), 1) if values else 0} for level, values in sorted(solve_by_difficulty.items())],
        "peak_alarm_hours": [{"hour": hour, "count": count} for hour, count in enumerate(peak_hours)],
        "snooze_vs_dismiss": {"snoozes": total_snoozes, "dismisses": dismisses}
    }

@app.get("/api/admin/statistics")
def admin_stats(user=Depends(require_roles("ADMIN"))):
    all_attempts = list(challenge_attempts.find({}))
    all_alarms = list(alarms.find({}))
    all_users = list(users.find({}, {"password_hash": 0}))
    now = datetime.now(timezone.utc)
    today = now.date()

    def as_utc(value):
        """Return an aware UTC datetime for legacy documents as well."""
        if isinstance(value, datetime):
            return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
        if isinstance(value, str):
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
            except ValueError:
                return None
        return None

    def is_today(value):
        parsed = as_utc(value)
        return bool(parsed and parsed.date() == today)

    total_attempts_count = len(all_attempts)
    correct_attempts_count = sum(1 for a in all_attempts if a.get("correct"))
    
    system_adherence_rate = round((correct_attempts_count / total_attempts_count * 100), 1) if total_attempts_count > 0 else 98.6
    global_avg_response_time = round(sum(a.get("response_time", 0.0) for a in all_attempts) / total_attempts_count, 1) if total_attempts_count > 0 else 12.4
    
    all_perf = list(performance.find({}))
    avg_wakefulness = round(sum(p.get("wakefulness_index", 70.0) for p in all_perf) / len(all_perf), 1) if all_perf else 78.5
    avg_csi = round(sum(p.get("cognitive_stability_index", 70.0) for p in all_perf) / len(all_perf), 1) if all_perf else 82.0
    
    easy_count = sum(1 for p in all_perf if p.get("difficulty_score", 0.5) <= 0.33)
    medium_count = sum(1 for p in all_perf if 0.33 < p.get("difficulty_score", 0.5) <= 0.66)
    hard_count = sum(1 for p in all_perf if p.get("difficulty_score", 0.5) > 0.66)
    total_perf_count = max(1, len(all_perf))
    
    difficulty_distribution = {
        "easy_pct": round(easy_count / total_perf_count * 100, 1),
        "medium_pct": round(medium_count / total_perf_count * 100, 1),
        "hard_pct": round(hard_count / total_perf_count * 100, 1),
        "easy_count": easy_count,
        "medium_count": medium_count,
        "hard_count": hard_count
    }

    daily_activity = []
    for offset in range(29, -1, -1):
        day = today - timedelta(days=offset)
        active_ids = {
            str(a.get("user_id")) for a in all_attempts
            if (as_utc(a.get("attempted_at")) or as_utc(a.get("created_at")))
            and (as_utc(a.get("attempted_at")) or as_utc(a.get("created_at"))).date() == day
        }
        daily_activity.append({"date": day.isoformat(), "count": len(active_ids)})

    challenge_type_counts = {}
    for attempt in all_attempts:
        challenge_type = (attempt.get("challenge_type") or attempt.get("type") or attempt.get("kind") or "MATH").replace("_", " ").title()
        challenge_type_counts[challenge_type] = challenge_type_counts.get(challenge_type, 0) + 1
    challenge_types = [
        {"type": name, "count": count}
        for name, count in sorted(challenge_type_counts.items(), key=lambda item: item[1], reverse=True)[:6]
    ]

    wake_times = []
    for alarm in all_alarms:
        raw_time = str(alarm.get("alarm_time", ""))
        try:
            wake_times.append(datetime.strptime(raw_time.strip().upper(), "%I:%M %p"))
        except ValueError:
            try:
                wake_times.append(datetime.strptime(raw_time[:5], "%H:%M"))
            except ValueError:
                pass
    avg_wake_time = "—"
    if wake_times:
        avg_minutes = round(sum(item.hour * 60 + item.minute for item in wake_times) / len(wake_times)) % (24 * 60)
        wake_hour = avg_minutes // 60
        avg_wake_time = f"{(wake_hour % 12) or 12}:{avg_minutes % 60:02d} {'AM' if wake_hour < 12 else 'PM'}"

    name_by_id = {str(account.get("_id")): account.get("name") or account.get("username") or "A user" for account in all_users}
    activity = []
    for attempt in all_attempts:
        activity.append({
            "at": as_utc(attempt.get("attempted_at")) or as_utc(attempt.get("created_at")),
            "text": f"{name_by_id.get(str(attempt.get('user_id')), 'A user')} {('solved' if attempt.get('correct') else 'attempted')} a {(attempt.get('challenge_type') or 'challenge').replace('_', ' ').lower()} challenge",
            "kind": "challenge"
        })
    for alarm in all_alarms:
        activity.append({
            "at": as_utc(alarm.get("created_at")),
            "text": f"{name_by_id.get(str(alarm.get('user_id')), 'A user')} set an alarm for {alarm.get('alarm_time', 'a scheduled time')}",
            "kind": "alarm"
        })
    for account in all_users:
        activity.append({
            "at": as_utc(account.get("created_at")),
            "text": f"{account.get('name') or account.get('username') or 'A user'} joined CognitiveWake",
            "kind": "user"
        })
    recent_activity = [
        {"text": item["text"], "kind": item["kind"], "at": item["at"].isoformat()}
        for item in sorted((item for item in activity if item["at"]), key=lambda item: item["at"], reverse=True)[:6]
    ]
    pending_actions = [
        {"label": f"Review inactive account: {account.get('name') or account.get('email')}", "detail": "Account is currently deactivated", "id": str(account.get("_id"))}
        for account in all_users if account.get("is_active") is False
    ][:5]
    pending_actions += [
        {"label": f"Assign wellness_coach: {account.get('name') or account.get('email')}", "detail": "No wellness_coach assigned", "id": str(account.get("_id"))}
        for account in all_users if account.get("role") == "USER" and not account.get("wellness_coach_id")
    ][:max(0, 5 - len(pending_actions))]

    return {
        "total_users": users.count_documents({}),
        "active_users": users.count_documents({"is_active": True}),
        "total_alarms": alarms.count_documents({}),
        "challenge_attempts": total_attempts_count,
        "system_adherence_rate": system_adherence_rate,
        "global_avg_response_time": global_avg_response_time,
        "avg_wakefulness": avg_wakefulness,
        "avg_csi": avg_csi,
        "difficulty_distribution": difficulty_distribution,
        "ml_models_active": True,
        "ml_boost_evaluations": difficulty_history.count_documents({"ml_boost": {"$ne": 0}}),
        "sd_boost_evaluations": difficulty_history.count_documents({"sd_boost": {"$gt": 0}}),
        "dashboard": {
            "active_users_today": len({str(a.get("user_id")) for a in all_attempts if is_today(a.get("attempted_at"))}),
            "alarms_set_today": sum(1 for alarm in all_alarms if is_today(alarm.get("created_at"))),
            "challenges_solved": correct_attempts_count,
            "avg_wake_time": avg_wake_time,
            "success_rate": system_adherence_rate,
            "daily_active_users": daily_activity,
            "challenge_types": challenge_types,
            "recent_activity": recent_activity,
            "pending_actions": pending_actions
        }
    }


@app.get("/api/wellness_coach/users")
def wellness_coach_users(user=Depends(require_roles("WELLNESS_COACH", "ADMIN"))):
    """Return users with real activity metrics for the WellnessCoach Users page.
    - WELLNESS_COACH: only sees USER accounts assigned to them (or all USERs if none assigned).
    - ADMIN: sees all accounts.
    """
    caller_role = user.get("role", "WELLNESS_COACH")
    if caller_role == "ADMIN":
        # Admin sees every account
        user_docs = list(users.find({}, {"password_hash": 0}).sort("created_at", -1))
    else:
        # WellnessCoach sees only standard USER accounts assigned to them
        mid = str(user["_id"])
        user_docs = list(users.find({"wellness_coach_id": mid, "role": "USER"}, {"password_hash": 0}).sort("created_at", -1))
        if not user_docs:
            # Fall back to all USER accounts if no explicit assignments exist
            user_docs = list(users.find({"role": "USER"}, {"password_hash": 0}).sort("created_at", -1))

    user_ids = [str(u["_id"]) for u in user_docs]
    
    all_alarms = list(alarms.find({"user_id": {"$in": user_ids}}))
    all_sessions = list(alarm_sessions.find({"user_id": {"$in": user_ids}}))
    all_attempts = list(challenge_attempts.find({"user_id": {"$in": user_ids}}))
    all_snoozes = list(snooze_logs.find({"user_id": {"$in": user_ids}}))
    
    mod_map = {str(u["_id"]): u.get("name", u.get("email")) for u in user_docs if u.get("role") in ["WELLNESS_COACH", "ADMIN"]}

    from collections import defaultdict
    user_alarms_map = defaultdict(list)
    for a in all_alarms:
        user_alarms_map[str(a.get("user_id"))].append(a)
    
    user_sessions_map = defaultdict(list)
    for s in all_sessions:
        user_sessions_map[str(s.get("user_id"))].append(s)
    
    user_attempts_map = defaultdict(list)
    for att in all_attempts:
        user_attempts_map[str(att.get("user_id"))].append(att)
    
    user_snoozes_map = defaultdict(list)
    for sn in all_snoozes:
        user_snoozes_map[str(sn.get("user_id"))].append(sn)

    results = []
    for u in user_docs:
        uid = str(u["_id"])
        u_alarms = user_alarms_map[uid]
        u_sessions = user_sessions_map[uid]
        u_attempts = user_attempts_map[uid]
        u_snoozes = user_snoozes_map[uid]
        
        # Alarm metrics
        total_alarms = len(u_alarms)
        total_sessions = len(u_sessions)
        completed_sessions = sum(
            1 for s in u_sessions
            if s.get("completed") or s.get("completed_at") or s.get("status") == "COMPLETED"
        )
        wake_success = round(completed_sessions / total_sessions * 100, 1) if total_sessions > 0 else 0.0
        snooze_count = len(u_snoozes)
        
        # Challenge metrics
        total_attempts = len(u_attempts)
        completed_challenges = sum(1 for a in u_attempts if a.get("correct"))
        challenge_accuracy = round(completed_challenges / total_attempts * 100, 1) if total_attempts > 0 else 0.0
        rts = [a.get("response_time", 0.0) for a in u_attempts if a.get("response_time")]
        avg_rt = round(sum(rts) / len(rts), 1) if rts else 0.0
        
        # Streak
        current_streak, longest_streak = calculate_user_streak(uid)
        
        # Habit score calculation
        snooze_score = max(0.0, 100.0 - (snooze_count / max(total_sessions, 1)) * 25.0)
        streak_score = min(100.0, current_streak * 10.0)
        habit_score = round(0.35 * wake_success + 0.25 * challenge_accuracy + 0.20 * snooze_score + 0.20 * streak_score, 1) if (total_sessions or total_attempts) else 0.0
        
        if habit_score >= 80:
            habit_tier = "High Performer 🌟"
        elif habit_score >= 50:
            habit_tier = "Building Habit 📈"
        elif (total_sessions or total_attempts):
            habit_tier = "Needs Support ⚠️"
        else:
            habit_tier = "New Account 🌱"
            
        perf_score = round((wake_success + challenge_accuracy) / 2.0, 1) if (total_sessions or total_attempts) else 0.0
        is_active = bool(u.get("is_active", True))
        
        mod_assigned_id = u.get("wellness_coach_id")
        mod_assigned_name = mod_map.get(str(mod_assigned_id), "None") if mod_assigned_id else "Unassigned"
        
        cleaned_user = clean(u)
        cleaned_user.update({
            "status": "Active" if is_active else "Inactive",
            "is_active": is_active,
            "wellness_coach_name": mod_assigned_name,
            "alarm_activity": {
                "total_alarms": total_alarms,
                "total_sessions": total_sessions,
                "completed_alarms": completed_sessions,
                "wake_success": wake_success,
                "snooze_count": snooze_count
            },
            "challenge_performance": {
                "total_attempts": total_attempts,
                "completed_challenges": completed_challenges,
                "accuracy": challenge_accuracy,
                "avg_response_time": avg_rt
            },
            "habit_score": habit_score,
            "habit_tier": habit_tier,
            "streak": current_streak,
            "longest_streak": longest_streak,
            "performance": perf_score
        })
        results.append(cleaned_user)
        
    return results

@app.get("/api/wellness_coach/users/{user_id}/details")
def wellness_coach_user_details(user_id: str, user=Depends(require_roles("WELLNESS_COACH", "ADMIN"))):
    """Complete real-data monitoring view for any user in the wellness_coach view.
    - WELLNESS_COACH: can only access USER-role accounts.
    - ADMIN: can access any account.
    """
    if not ObjectId.is_valid(user_id):
        raise HTTPException(400, "Invalid user id")
    target = users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    if not target:
        raise HTTPException(404, "User not found")
    # Restrict wellness_coachs from viewing admin/wellness_coach accounts
    caller_role = user.get("role", "WELLNESS_COACH")
    if caller_role != "ADMIN" and target.get("role") not in ("USER",):
        raise HTTPException(403, "WellnessCoachs can only view standard USER accounts")
    uid = str(target["_id"])
    user_alarms = list(alarms.find({"user_id": uid}).sort("created_at", -1).limit(50))
    user_attempts = list(challenge_attempts.find({"user_id": uid}).sort("attempted_at", -1).limit(100))
    user_sessions = list(alarm_sessions.find({"user_id": uid}).sort("triggered_at", -1).limit(50))
    user_snoozes = list(snooze_logs.find({"user_id": uid}).sort("snoozed_at", -1).limit(50))
    
    completed_sessions = sum(1 for item in user_sessions if item.get("completed") or item.get("completed_at") or item.get("status") == "COMPLETED")
    correct_attempts = sum(1 for item in user_attempts if item.get("correct"))
    wake_rate = completed_sessions / len(user_sessions) * 100 if user_sessions else 0.0
    challenge_score = correct_attempts / len(user_attempts) * 100 if user_attempts else 0.0
    current_streak, longest_streak = calculate_user_streak(uid)
    snooze_score = max(0.0, 100 - len(user_snoozes) / max(len(user_sessions), 1) * 25)
    streak_score = min(100.0, current_streak * 10)
    habit_score = round(.35 * wake_rate + .25 * challenge_score + .20 * snooze_score + .20 * streak_score, 1) if (user_sessions or user_attempts) else 0.0
    
    return {
        "profile": clean(target),
        "metrics": {
            "alarm_activity": len(user_sessions),
            "total_alarms": len(user_alarms),
            "completed_alarms": completed_sessions,
            "wake_success": round(wake_rate, 1),
            "challenge_activity": len(user_attempts),
            "challenge_completed": correct_attempts,
            "challenge_score": round(challenge_score, 1),
            "habit_score": habit_score,
            "streak": current_streak,
            "longest_streak": longest_streak,
            "snoozes": len(user_snoozes),
            "performance": round((wake_rate + challenge_score) / 2, 1) if (user_sessions or user_attempts) else 0.0
        },
        "alarms": [clean(item) for item in user_alarms],
        "challenges": [clean(item) for item in user_attempts],
        "sessions": [clean(item) for item in user_sessions],
        "snoozes": [clean(item) for item in user_snoozes]
    }

@app.get("/api/wellness_coach/assigned-users")
def wellness_coach_assigned_users(user=Depends(require_roles("WELLNESS_COACH", "ADMIN"))):
    """A wellness_coach can view users assigned to them, or all standard users if unassigned."""
    mid = str(user["_id"])
    user_docs = list(users.find({"wellness_coach_id": mid, "role": "USER"}, {"password_hash": 0}).sort("created_at", -1))
    if not user_docs:
        user_docs = list(users.find({"role": "USER"}, {"password_hash": 0}).sort("created_at", -1))
    
    user_ids = [str(u["_id"]) for u in user_docs]
    all_alarms = list(alarms.find({"user_id": {"$in": user_ids}}))
    all_sessions = list(alarm_sessions.find({"user_id": {"$in": user_ids}}))
    all_attempts = list(challenge_attempts.find({"user_id": {"$in": user_ids}}))
    all_snoozes = list(snooze_logs.find({"user_id": {"$in": user_ids}}))

    from collections import defaultdict
    user_alarms_map = defaultdict(list)
    for a in all_alarms: user_alarms_map[str(a.get("user_id"))].append(a)
    user_sessions_map = defaultdict(list)
    for s in all_sessions: user_sessions_map[str(s.get("user_id"))].append(s)
    user_attempts_map = defaultdict(list)
    for att in all_attempts: user_attempts_map[str(att.get("user_id"))].append(att)
    user_snoozes_map = defaultdict(list)
    for sn in all_snoozes: user_snoozes_map[str(sn.get("user_id"))].append(sn)

    results = []
    for u in user_docs:
        uid = str(u["_id"])
        u_alarms = user_alarms_map[uid]
        u_sessions = user_sessions_map[uid]
        u_attempts = user_attempts_map[uid]
        u_snoozes = user_snoozes_map[uid]

        total_alarms = len(u_alarms)
        total_sessions = len(u_sessions)
        completed_sessions = sum(1 for s in u_sessions if s.get("completed") or s.get("completed_at") or s.get("status") == "COMPLETED")
        wake_success = round(completed_sessions / total_sessions * 100, 1) if total_sessions > 0 else 0.0
        snooze_count = len(u_snoozes)

        total_attempts = len(u_attempts)
        completed_challenges = sum(1 for a in u_attempts if a.get("correct"))
        challenge_accuracy = round(completed_challenges / total_attempts * 100, 1) if total_attempts > 0 else 0.0
        rts = [a.get("response_time", 0.0) for a in u_attempts if a.get("response_time")]
        avg_rt = round(sum(rts) / len(rts), 1) if rts else 0.0

        current_streak, longest_streak = calculate_user_streak(uid)
        snooze_score = max(0.0, 100.0 - (snooze_count / max(total_sessions, 1)) * 25.0)
        streak_score = min(100.0, current_streak * 10.0)
        habit_score = round(0.35 * wake_success + 0.25 * challenge_accuracy + 0.20 * snooze_score + 0.20 * streak_score, 1) if (total_sessions or total_attempts) else 0.0
        
        perf_score = round((wake_success + challenge_accuracy) / 2.0, 1) if (total_sessions or total_attempts) else 0.0
        is_active = bool(u.get("is_active", True))

        cleaned_user = clean(u)
        cleaned_user.update({
            "status": "Active" if is_active else "Inactive",
            "is_active": is_active,
            "alarm_activity": {
                "total_alarms": total_alarms,
                "total_sessions": total_sessions,
                "completed_alarms": completed_sessions,
                "wake_success": wake_success,
                "snooze_count": snooze_count
            },
            "challenge_performance": {
                "total_attempts": total_attempts,
                "completed_challenges": completed_challenges,
                "accuracy": challenge_accuracy,
                "avg_response_time": avg_rt
            },
            "habit_score": habit_score,
            "streak": current_streak,
            "longest_streak": longest_streak,
            "performance": perf_score
        })
        results.append(cleaned_user)

    return results

@app.get("/api/wellness_coach/assigned-users/{user_id}/report")
def wellness_coach_assigned_user_report(user_id: str, user=Depends(require_roles("WELLNESS_COACH", "ADMIN"))):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(400, "Invalid user id")
    target = users.find_one({"_id": ObjectId(user_id), "role": "USER"})
    if not target:
        raise HTTPException(404, "User not found")
    uid = str(target["_id"])
    return build_wellness_coach_analytics(
        [target], list(alarm_sessions.find({"user_id": uid})),
        list(challenge_attempts.find({"user_id": uid})), list(snooze_logs.find({"user_id": uid})),
    )

@app.get("/api/wellness_coach/assigned-users/{user_id}/challenges")
def wellness_coach_assigned_user_challenges(user_id: str, user=Depends(require_roles("WELLNESS_COACH", "ADMIN"))):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(400, "Invalid user id")
    target = users.find_one({"_id": ObjectId(user_id), "role": "USER"})
    if not target:
        raise HTTPException(404, "User not found")
    return [clean(item) for item in challenge_attempts.find({"user_id": user_id}).sort("attempted_at", -1).limit(100)]

@app.get("/api/wellness_coach/assigned-users/{user_id}/details")
def wellness_coach_assigned_user_details(user_id: str, user=Depends(require_roles("WELLNESS_COACH", "ADMIN"))):
    """Complete real-data monitoring view for one user assigned to or managed by the wellness_coach."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(400, "Invalid user id")
    target = users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    if not target:
        raise HTTPException(404, "User not found")
    uid = str(target["_id"])
    user_alarms = list(alarms.find({"user_id": uid}).sort("created_at", -1).limit(50))
    user_attempts = list(challenge_attempts.find({"user_id": uid}).sort("attempted_at", -1).limit(100))
    user_sessions = list(alarm_sessions.find({"user_id": uid}))
    user_snoozes = list(snooze_logs.find({"user_id": uid}))
    completed_sessions = sum(1 for item in user_sessions if item.get("completed") or item.get("completed_at") or item.get("status") == "COMPLETED")
    correct_attempts = sum(1 for item in user_attempts if item.get("correct"))
    wake_rate = completed_sessions / len(user_sessions) * 100 if user_sessions else 0.0
    challenge_score = correct_attempts / len(user_attempts) * 100 if user_attempts else 0.0
    current_streak, longest_streak = calculate_user_streak(uid)
    snooze_score = max(0.0, 100 - len(user_snoozes) / max(len(user_sessions), 1) * 25)
    streak_score = min(100.0, current_streak * 10)
    habit_score = round(.35 * wake_rate + .25 * challenge_score + .20 * snooze_score + .20 * streak_score, 1) if (user_sessions or user_attempts) else 0.0
    profile = clean(target)
    return {
        "profile": profile,
        "metrics": {
            "alarm_activity": len(user_sessions),
            "total_alarms": len(user_alarms),
            "completed_alarms": completed_sessions,
            "wake_success": round(wake_rate, 1),
            "challenge_activity": len(user_attempts),
            "challenge_completed": correct_attempts,
            "challenge_score": round(challenge_score, 1),
            "habit_score": habit_score,
            "streak": current_streak,
            "longest_streak": longest_streak,
            "snoozes": len(user_snoozes),
            "performance": round((wake_rate + challenge_score) / 2, 1) if (user_sessions or user_attempts) else 0.0
        },
        "alarms": [clean(item) for item in user_alarms],
        "challenges": [clean(item) for item in user_attempts],
        "sessions": [clean(item) for item in user_sessions],
        "snoozes": [clean(item) for item in user_snoozes]
    }

@app.get("/api/wellness_coach/ml-performance")
def wellness_coach_ml_performance(user=Depends(require_roles("WELLNESS_COACH", "ADMIN"))):
    """Aggregate and per-user MLBoostModel (XGBoost) and SDBoostModel performance metrics for wellness_coachs."""
    mid = str(user["_id"])
    user_docs = list(users.find({"wellness_coach_id": mid, "role": "USER"}, {"password_hash": 0}).sort("created_at", -1))
    if not user_docs:
        user_docs = list(users.find({"role": "USER"}, {"password_hash": 0}).sort("created_at", -1))

    user_metrics_list = []
    total_predicted_rt = 0.0
    total_wakefulness = 0.0
    total_csi = 0.0
    total_habit_score = 0.0
    total_diff_score = 0.0
    all_recent_attempts = []

    for u in user_docs:
        uid = str(u["_id"])
        diff_info = difficulty_engine.get_difficulty_info(uid)
        current_streak, longest_streak = calculate_user_streak(uid)
        
        # User attempts for timeline/charts
        u_attempts = list(challenge_attempts.find({"user_id": uid}).sort("attempted_at", -1).limit(20))
        for att in u_attempts:
            all_recent_attempts.append({
                "user_id": uid,
                "user_name": u.get("name") or u.get("email", "User"),
                "challenge_type": att.get("challenge_type", "Math"),
                "response_time": float(att.get("response_time", 15.0)),
                "correct": bool(att.get("correct", False)),
                "attempted_at": att.get("attempted_at").isoformat() if isinstance(att.get("attempted_at"), datetime) else str(att.get("attempted_at", ""))
            })

        user_item = {
            "user_id": uid,
            "name": u.get("name") or u.get("email", "User"),
            "email": u.get("email", ""),
            "role": u.get("role", "USER"),
            "is_active": u.get("is_active", True),
            "predicted_response_time": diff_info.get("predicted_response_time", 15.0),
            "wakefulness_index": diff_info.get("wakefulness_index", 70.0),
            "cognitive_stability_index": diff_info.get("cognitive_stability_index", 70.0),
            "csi": diff_info.get("cognitive_stability_index", 70.0),
            "std_dev_response_time": diff_info.get("std_dev_response_time", 0.0),
            "mean_response_time": diff_info.get("mean_response_time", 0.0),
            "coeff_variation": diff_info.get("coeff_variation", 0.0),
            "sd_boost": diff_info.get("sd_boost", 0.0),
            "sd_boost_active": diff_info.get("sd_boost_active", False),
            "ml_boost": diff_info.get("ml_boost", 0.0),
            "is_ml_trained": diff_info.get("is_ml_trained", False),
            "model_name": diff_info.get("model_name", "Predictive Reaction Engine"),
            "cognitive_performance": round(diff_info.get("difficulty_score", 0.5) * 100, 1),
            "difficulty_score": diff_info.get("difficulty_score", 0.5),
            "difficulty_label": diff_info.get("difficulty_label", "MEDIUM"),
            "recommended_difficulty": diff_info.get("difficulty_label", "MEDIUM"),
            "habit_score": diff_info.get("habit_score", 75.0),
            "habit_tier": diff_info.get("habit_tier", "Building Habit 📈"),
            "habit_breakdown": diff_info.get("habit_breakdown", {}),
            "recommendations": diff_info.get("recommendations", {}),
            "streak": current_streak,
            "longest_streak": longest_streak,
            "sparkline": diff_info.get("sparkline", []),
            "attempts_count": len(u_attempts)
        }
        user_metrics_list.append(user_item)

        total_predicted_rt += user_item["predicted_response_time"]
        total_wakefulness += user_item["wakefulness_index"]
        total_csi += user_item["cognitive_stability_index"]
        total_habit_score += user_item["habit_score"]
        total_diff_score += user_item["cognitive_performance"]

    n = max(len(user_metrics_list), 1)
    avg_predicted_rt = round(total_predicted_rt / n, 2)
    avg_wakefulness = round(total_wakefulness / n, 1)
    avg_csi = round(total_csi / n, 1)
    avg_habit_score = round(total_habit_score / n, 1)
    avg_cognitive_perf = round(total_diff_score / n, 1)
    top_streak = max([u["streak"] for u in user_metrics_list] or [0])
    longest_streak_rec = max([u["longest_streak"] for u in user_metrics_list] or [0])

    # Recommended difficulty across all users based on average cognitive performance
    if avg_cognitive_perf >= 67.0:
        recommended_level = "HARD"
    elif avg_cognitive_perf >= 34.0:
        recommended_level = "MEDIUM"
    else:
        recommended_level = "EASY"

    all_recent_attempts.sort(key=lambda x: x["attempted_at"], reverse=True)

    return {
        "summary": {
            "total_users": len(user_metrics_list),
            "predicted_response_time": avg_predicted_rt,
            "wakefulness_index": avg_wakefulness,
            "cognitive_performance": avg_cognitive_perf,
            "habit_score": avg_habit_score,
            "streak": top_streak,
            "longest_streak": longest_streak_rec,
            "cognitive_stability_index": avg_csi,
            "csi": avg_csi,
            "recommended_difficulty": recommended_level,
            "model_name": "MLBoost (XGBoost) & SDBoost Engine",
            "is_ml_trained": any(u["is_ml_trained"] for u in user_metrics_list)
        },
        "users": user_metrics_list,
        "recent_attempts": all_recent_attempts[:30]
    }


@app.get("/api/wellness_coach/assigned-users/{user_id}/ml-performance")
def wellness_coach_user_ml_performance(user_id: str, user=Depends(require_roles("WELLNESS_COACH", "ADMIN"))):
    """Detailed MLBoostModel (XGBoost) and SDBoostModel metrics for a single managed user."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(400, "Invalid user id")
    target = users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    if not target:
        raise HTTPException(404, "User not found")
    uid = str(target["_id"])
    diff_info = difficulty_engine.get_difficulty_info(uid)
    current_streak, longest_streak = calculate_user_streak(uid)
    
    user_attempts = list(challenge_attempts.find({"user_id": uid}).sort("attempted_at", -1).limit(30))
    formatted_attempts = []
    for att in user_attempts:
        formatted_attempts.append({
            "challenge_type": att.get("challenge_type", "Math"),
            "response_time": float(att.get("response_time", 15.0)),
            "correct": bool(att.get("correct", False)),
            "attempted_at": att.get("attempted_at").isoformat() if isinstance(att.get("attempted_at"), datetime) else str(att.get("attempted_at", ""))
        })

    return {
        "user_id": uid,
        "name": target.get("name") or target.get("email", "User"),
        "email": target.get("email", ""),
        "role": target.get("role", "USER"),
        "is_active": target.get("is_active", True),
        "predicted_response_time": diff_info.get("predicted_response_time", 15.0),
        "wakefulness_index": diff_info.get("wakefulness_index", 70.0),
        "cognitive_stability_index": diff_info.get("cognitive_stability_index", 70.0),
        "csi": diff_info.get("cognitive_stability_index", 70.0),
        "std_dev_response_time": diff_info.get("std_dev_response_time", 0.0),
        "mean_response_time": diff_info.get("mean_response_time", 0.0),
        "coeff_variation": diff_info.get("coeff_variation", 0.0),
        "sd_boost": diff_info.get("sd_boost", 0.0),
        "sd_boost_active": diff_info.get("sd_boost_active", False),
        "ml_boost": diff_info.get("ml_boost", 0.0),
        "is_ml_trained": diff_info.get("is_ml_trained", False),
        "model_name": diff_info.get("model_name", "Predictive Reaction Engine"),
        "cognitive_performance": round(diff_info.get("difficulty_score", 0.5) * 100, 1),
        "difficulty_score": diff_info.get("difficulty_score", 0.5),
        "difficulty_label": diff_info.get("difficulty_label", "MEDIUM"),
        "recommended_difficulty": diff_info.get("difficulty_label", "MEDIUM"),
        "habit_score": diff_info.get("habit_score", 75.0),
        "habit_tier": diff_info.get("habit_tier", "Building Habit 📈"),
        "habit_breakdown": diff_info.get("habit_breakdown", {}),
        "recommendations": diff_info.get("recommendations", {}),
        "streak": current_streak,
        "longest_streak": longest_streak,
        "sparkline": diff_info.get("sparkline", []),
        "recent_attempts": formatted_attempts
    }

@app.get("/api/wellness_coach/dashboard-analytics")
def wellness_coach_dashboard_analytics(user=Depends(require_roles("WELLNESS_COACH", "ADMIN"))):
    """Aggregate, non-identifying user behavioural analytics for the wellness_coach dashboard."""
    user_docs = list(users.find({"role": "USER"}, {"password_hash": 0}))
    user_ids = [str(item["_id"]) for item in user_docs]
    all_alarms = list(alarms.find({"user_id": {"$in": user_ids}}))
    all_sessions = list(alarm_sessions.find({"user_id": {"$in": user_ids}}))
    all_attempts = list(challenge_attempts.find({"user_id": {"$in": user_ids}}))
    all_snoozes = list(snooze_logs.find({"user_id": {"$in": user_ids}}))
    completed_sessions = sum(1 for item in all_sessions if item.get("completed") or item.get("completed_at") or item.get("status") == "COMPLETED")
    correct_attempts = sum(1 for item in all_attempts if item.get("correct"))
    perf_docs = list(performance.find({"user_id": {"$in": user_ids}}))
    streak_values = [item.get("current_streak", 0) for item in perf_docs]
    # Actual-data habit score: completion, challenge accuracy, low snooze frequency and streak.
    completion_rate = completed_sessions / len(all_sessions) * 100 if all_sessions else 0.0
    challenge_rate = correct_attempts / len(all_attempts) * 100 if all_attempts else 0.0
    snooze_score = max(0.0, 100 - (len(all_snoozes) / max(len(all_sessions), 1)) * 25)
    streak_score = min(100.0, (sum(streak_values) / max(len(streak_values), 1)) * 10)
    habit_score = round(.35 * completion_rate + .25 * challenge_rate + .20 * snooze_score + .20 * streak_score, 1) if (all_sessions or all_attempts) else 0.0
    from collections import defaultdict
    daily = defaultdict(lambda: {"alarms": 0, "challenges": 0})
    for item in all_sessions:
        dt = item.get("triggered_at") or item.get("completed_at")
        if isinstance(dt, datetime): daily[dt.strftime("%Y-%m-%d")]["alarms"] += 1
    for item in all_attempts:
        dt = item.get("attempted_at")
        if isinstance(dt, datetime): daily[dt.strftime("%Y-%m-%d")]["challenges"] += 1
    timeline = [{"date": key, **value} for key, value in sorted(daily.items())[-14:]]
    return {
        "summary": {
            "total_users": len(user_docs), "active_users": sum(1 for item in user_docs if item.get("is_active") is not False),
            "alarm_activity": len(all_sessions), "active_alarms": sum(1 for item in all_alarms if item.get("enabled")),
            "challenge_activity": len(all_attempts), "habit_score": habit_score,
            "average_streak": round(sum(streak_values) / len(streak_values), 1) if streak_values else 0.0,
            "user_performance": round((completion_rate + challenge_rate) / 2, 1) if (all_sessions or all_attempts) else 0.0,
        },
        "timeline": timeline,
        "breakdown": {"completed_alarms": completed_sessions, "missed_alarms": max(0, len(all_sessions) - completed_sessions), "completed_challenges": correct_attempts, "failed_challenges": max(0, len(all_attempts) - correct_attempts)},
    }

@app.get("/api/wellness_coach/challenge-analytics")
def wellness_coach_challenge_analytics(user=Depends(require_roles("WELLNESS_COACH", "ADMIN"))):
    """Aggregate challenge usage and outcome data without returning user identities."""
    challenge_docs = list(challenges.find({}).sort("created_at", -1))
    attempts_by_challenge = {}
    for attempt in challenge_attempts.find({}):
        attempts_by_challenge.setdefault(str(attempt.get("challenge_id", "")), []).append(attempt)
    rows = []
    for challenge in challenge_docs:
        challenge_id = str(challenge["_id"])
        attempts = attempts_by_challenge.get(challenge_id, [])
        completed = sum(1 for attempt in attempts if attempt.get("correct"))
        total = len(attempts)
        success_rate = round(completed / total * 100, 1) if total else 0.0
        # The app records correct/incorrect outcomes, so average score is the actual mean binary score.
        rows.append({
            "id": challenge_id,
            "name": challenge.get("question") or challenge.get("title") or "Untitled challenge",
            "type": challenge.get("type") or challenge.get("challenge_type") or "MATH",
            "difficulty": challenge.get("difficulty") or "MEDIUM",
            "attempts": total,
            "completion": completed,
            "average_score": success_rate,
            "success_rate": success_rate,
        })
    type_totals = {}
    for row in rows:
        bucket = type_totals.setdefault(row["type"], {"type": row["type"], "attempts": 0, "completion": 0})
        bucket["attempts"] += row["attempts"]
        bucket["completion"] += row["completion"]
    type_chart = []
    for row in type_totals.values():
        row["success_rate"] = round(row["completion"] / row["attempts"] * 100, 1) if row["attempts"] else 0.0
        type_chart.append(row)
    return {"challenges": rows, "type_chart": sorted(type_chart, key=lambda item: item["attempts"], reverse=True)}

@app.get("/api/wellness_coach/assigned-users/{user_id}/report")
def wellness_coach_assigned_user_report(user_id: str, user=Depends(require_roles("WELLNESS_COACH"))):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(400, "Invalid user id")
    target = users.find_one({"_id": ObjectId(user_id), "wellness_coach_id": str(user["_id"]), "role": "USER"})
    if not target:
        raise HTTPException(404, "Assigned user not found")
    uid = str(target["_id"])
    return build_wellness_coach_analytics(
        [target], list(alarm_sessions.find({"user_id": uid})),
        list(challenge_attempts.find({"user_id": uid})), list(snooze_logs.find({"user_id": uid})),
    )

@app.get("/api/wellness_coach/assigned-users/{user_id}/challenges")
def wellness_coach_assigned_user_challenges(user_id: str, user=Depends(require_roles("WELLNESS_COACH"))):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(400, "Invalid user id")
    target = users.find_one({"_id": ObjectId(user_id), "wellness_coach_id": str(user["_id"]), "role": "USER"})
    if not target:
        raise HTTPException(404, "Assigned user not found")
    return [clean(item) for item in challenge_attempts.find({"user_id": user_id}).sort("attempted_at", -1).limit(100)]

@app.get("/api/wellness_coach/assigned-users/{user_id}/details")
def wellness_coach_assigned_user_details(user_id: str, user=Depends(require_roles("WELLNESS_COACH"))):
    """Complete real-data monitoring view for one user assigned to the wellness_coach."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(400, "Invalid user id")
    target = users.find_one({"_id": ObjectId(user_id), "wellness_coach_id": str(user["_id"]), "role": "USER"}, {"password_hash": 0})
    if not target:
        raise HTTPException(404, "Assigned user not found")
    uid = str(target["_id"])
    user_alarms = list(alarms.find({"user_id": uid}).sort("created_at", -1).limit(50))
    user_attempts = list(challenge_attempts.find({"user_id": uid}).sort("attempted_at", -1).limit(100))
    user_sessions = list(alarm_sessions.find({"user_id": uid}))
    user_snoozes = list(snooze_logs.find({"user_id": uid}))
    completed_sessions = sum(1 for item in user_sessions if item.get("completed") or item.get("completed_at") or item.get("status") == "COMPLETED")
    correct_attempts = sum(1 for item in user_attempts if item.get("correct"))
    wake_rate = completed_sessions / len(user_sessions) * 100 if user_sessions else 0.0
    challenge_score = correct_attempts / len(user_attempts) * 100 if user_attempts else 0.0
    current_streak, longest_streak = calculate_user_streak(uid)
    snooze_score = max(0.0, 100 - len(user_snoozes) / max(len(user_sessions), 1) * 25)
    streak_score = min(100.0, current_streak * 10)
    habit_score = round(.35 * wake_rate + .25 * challenge_score + .20 * snooze_score + .20 * streak_score, 1) if (user_sessions or user_attempts) else 0.0
    profile = clean(target)
    return {
        "profile": profile,
        "metrics": {"alarm_activity": len(user_sessions), "completed_alarms": completed_sessions, "wake_success": round(wake_rate, 1), "challenge_activity": len(user_attempts), "challenge_completed": correct_attempts, "challenge_score": round(challenge_score, 1), "habit_score": habit_score, "streak": current_streak, "longest_streak": longest_streak, "snoozes": len(user_snoozes), "performance": round((wake_rate + challenge_score) / 2, 1) if (user_sessions or user_attempts) else 0.0},
        "alarms": [clean(item) for item in user_alarms],
        "challenges": [clean(item) for item in user_attempts[:20]],
    }

@app.get("/api/wellness_coach/challenges")
def wellness_coach_challenges(user=Depends(require_roles("ADMIN"))):
    return [clean(x) for x in challenges.find({}).sort("created_at", -1)]

@app.post("/api/admin/challenges")
def admin_create_challenge(data: ChallengeManage, user=Depends(require_roles("ADMIN"))):
    doc = data.model_dump()
    doc["type"] = doc["type"].upper()
    doc["difficulty"] = doc["difficulty"].upper()
    doc["created_at"] = datetime.now(timezone.utc)
    doc["updated_at"] = doc["created_at"]
    result = challenges.insert_one(doc)
    return clean(challenges.find_one({"_id": result.inserted_id}))

@app.put("/api/admin/challenges/{challenge_id}")
def admin_update_challenge(challenge_id: str, data: ChallengeManage, user=Depends(require_roles("ADMIN"))):
    if not ObjectId.is_valid(challenge_id): raise HTTPException(400, "Invalid challenge ID")
    update = data.model_dump()
    update["type"] = update["type"].upper(); update["difficulty"] = update["difficulty"].upper(); update["updated_at"] = datetime.now(timezone.utc)
    result = challenges.update_one({"_id": ObjectId(challenge_id)}, {"$set": update})
    if not result.matched_count: raise HTTPException(404, "Challenge not found")
    return clean(challenges.find_one({"_id": ObjectId(challenge_id)}))

@app.delete("/api/admin/challenges/{challenge_id}")
def admin_delete_challenge(challenge_id: str, user=Depends(require_roles("ADMIN"))):
    if not ObjectId.is_valid(challenge_id): raise HTTPException(400, "Invalid challenge ID")
    if not challenges.delete_one({"_id": ObjectId(challenge_id)}).deleted_count: raise HTTPException(404, "Challenge not found")
    return {"message": "Challenge deleted"}

@app.get("/api/wellness_coach/analytics")
def wellness_coach_analytics(user=Depends(require_roles("ADMIN"))):
    """Administrator-only population behavioural analytics and ML predictions."""
    return build_wellness_coach_analytics(
        list(users.find({}, {"password_hash": 0})),
        list(alarm_sessions.find({})),
        list(challenge_attempts.find({})),
        list(snooze_logs.find({})),
    )

@app.get("/api/wellness_coach/sleep-trend-reports")
def wellness_coach_sleep_trend_reports(user=Depends(require_roles("WELLNESS_COACH", "ADMIN"))):
    """Aggregate sleep trend metrics for all managed users.
    
    Derives sleep quality indicators from alarm_sessions and snooze_logs:
    - Wake consistency (how regularly users wake at the same time)
    - Snooze rate per user
    - Session completion trend over last 30 days
    - Per-user sleep quality score
    """
    caller_role = user.get("role", "WELLNESS_COACH")
    mid = str(user["_id"])
    if caller_role == "ADMIN":
        user_docs = list(users.find({"role": "USER"}, {"password_hash": 0}).sort("created_at", -1))
    else:
        user_docs = list(users.find({"wellness_coach_id": mid, "role": "USER"}, {"password_hash": 0}).sort("created_at", -1))
        if not user_docs:
            user_docs = list(users.find({"role": "USER"}, {"password_hash": 0}).sort("created_at", -1))

    user_ids = [str(u["_id"]) for u in user_docs]
    all_sessions = list(alarm_sessions.find({"user_id": {"$in": user_ids}}).sort("triggered_at", 1))
    all_snoozes  = list(snooze_logs.find({"user_id": {"$in": user_ids}}))
    all_alarms   = list(alarms.find({"user_id": {"$in": user_ids}}))

    from collections import defaultdict
    sessions_by_user = defaultdict(list)
    for s in all_sessions:
        sessions_by_user[str(s.get("user_id"))].append(s)
    snoozes_by_user = defaultdict(list)
    for sn in all_snoozes:
        snoozes_by_user[str(sn.get("user_id"))].append(sn)
    alarms_by_user = defaultdict(list)
    for a in all_alarms:
        alarms_by_user[str(a.get("user_id"))].append(a)

    user_reports = []
    total_sleep_quality = 0.0
    daily_agg = defaultdict(lambda: {"completed": 0, "total": 0, "snoozes": 0})
    hourly_dist = defaultdict(int)

    for u in user_docs:
        uid = str(u["_id"])
        u_sessions = sessions_by_user[uid]
        u_snoozes  = snoozes_by_user[uid]
        u_alarms   = alarms_by_user[uid]

        total_sessions = len(u_sessions)
        completed = sum(1 for s in u_sessions if s.get("completed") or s.get("completed_at") or s.get("status") == "COMPLETED")
        snooze_count = len(u_snoozes)

        # Wake time consistency: extract hour from triggered_at
        wake_hours = []
        for s in u_sessions:
            dt = s.get("triggered_at")
            if isinstance(dt, datetime):
                wake_hours.append(dt.hour + dt.minute / 60.0)
                daily_agg[dt.strftime("%Y-%m-%d")]["total"] += 1
                if s.get("completed") or s.get("completed_at") or s.get("status") == "COMPLETED":
                    daily_agg[dt.strftime("%Y-%m-%d")]["completed"] += 1
                hourly_dist[dt.hour] += 1
        for sn in u_snoozes:
            dt = sn.get("snoozed_at")
            if isinstance(dt, datetime):
                daily_agg[dt.strftime("%Y-%m-%d")]["snoozes"] += 1

        avg_wake_hour = round(sum(wake_hours) / len(wake_hours), 2) if wake_hours else None
        # Consistency score: 100 if std_dev < 0.5hr, scales down
        if len(wake_hours) >= 2:
            mean_h = sum(wake_hours) / len(wake_hours)
            variance = sum((h - mean_h) ** 2 for h in wake_hours) / len(wake_hours)
            std_dev = variance ** 0.5
            consistency_score = max(0.0, round(100.0 - std_dev * 40.0, 1))
        else:
            std_dev = 0.0
            consistency_score = 100.0 if wake_hours else 0.0

        snooze_rate = round(snooze_count / max(total_sessions, 1) * 100, 1)
        completion_rate = round(completed / total_sessions * 100, 1) if total_sessions else 0.0
        
        # Sleep quality score: weighted from consistency, completion, low snooze
        snooze_penalty = min(100.0, snooze_rate * 2.0)  # 50% snooze = -100
        sleep_quality = round(0.40 * consistency_score + 0.40 * completion_rate + 0.20 * max(0.0, 100.0 - snooze_penalty), 1) if total_sessions else 0.0

        # Alarm schedule info
        alarm_times = [a.get("alarm_time", "") for a in u_alarms if a.get("alarm_time")]
        most_common_alarm = alarm_times[0] if alarm_times else "Not set"

        current_streak, longest_streak = calculate_user_streak(uid)

        # Per-user 14-day session trend
        user_daily = defaultdict(lambda: {"date": "", "completed": 0, "total": 0, "snoozes": 0})
        for s in u_sessions:
            dt = s.get("triggered_at")
            if isinstance(dt, datetime):
                key = dt.strftime("%Y-%m-%d")
                user_daily[key]["date"] = key
                user_daily[key]["total"] += 1
                if s.get("completed") or s.get("completed_at") or s.get("status") == "COMPLETED":
                    user_daily[key]["completed"] += 1
        for sn in u_snoozes:
            dt = sn.get("snoozed_at")
            if isinstance(dt, datetime):
                key = dt.strftime("%Y-%m-%d")
                user_daily[key]["date"] = key
                user_daily[key]["snoozes"] += 1
        user_timeline = sorted(user_daily.values(), key=lambda x: x["date"])[-14:]

        total_sleep_quality += sleep_quality
        user_reports.append({
            "user_id": uid,
            "name": u.get("name") or u.get("email", "User"),
            "email": u.get("email", ""),
            "is_active": bool(u.get("is_active", True)),
            "total_sessions": total_sessions,
            "completed_sessions": completed,
            "completion_rate": completion_rate,
            "snooze_count": snooze_count,
            "snooze_rate": snooze_rate,
            "avg_wake_hour": avg_wake_hour,
            "wake_time_std_dev": round(std_dev, 2),
            "consistency_score": consistency_score,
            "sleep_quality_score": sleep_quality,
            "most_common_alarm": most_common_alarm,
            "streak": current_streak,
            "longest_streak": longest_streak,
            "timeline": user_timeline,
        })

    # Sort daily_agg for timeline
    global_timeline = [
        {"date": k, **v}
        for k, v in sorted(daily_agg.items())
    ][-30:]

    # Hourly wake distribution
    hourly_distribution = [{"hour": h, "count": hourly_dist.get(h, 0)} for h in range(24)]

    n = max(len(user_reports), 1)
    avg_sleep_quality = round(total_sleep_quality / n, 1)
    avg_completion = round(sum(r["completion_rate"] for r in user_reports) / n, 1)
    avg_snooze_rate = round(sum(r["snooze_rate"] for r in user_reports) / n, 1)
    avg_consistency = round(sum(r["consistency_score"] for r in user_reports) / n, 1)
    high_quality_count = sum(1 for r in user_reports if r["sleep_quality_score"] >= 70)
    needs_support_count = sum(1 for r in user_reports if r["sleep_quality_score"] < 40)

    return {
        "summary": {
            "total_users": len(user_reports),
            "avg_sleep_quality_score": avg_sleep_quality,
            "avg_completion_rate": avg_completion,
            "avg_snooze_rate": avg_snooze_rate,
            "avg_consistency_score": avg_consistency,
            "high_quality_sleepers": high_quality_count,
            "needs_support_count": needs_support_count,
        },
        "users": user_reports,
        "global_timeline": global_timeline,
        "hourly_distribution": hourly_distribution,
    }


@app.get("/api/wellness_coach/sleep-trend-reports/{user_id}")
def wellness_coach_sleep_trend_user(user_id: str, user=Depends(require_roles("WELLNESS_COACH", "ADMIN"))):
    """Detailed sleep trend report for a single managed user."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(400, "Invalid user id")
    target = users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    if not target:
        raise HTTPException(404, "User not found")
    uid = str(target["_id"])

    u_sessions = list(alarm_sessions.find({"user_id": uid}).sort("triggered_at", 1))
    u_snoozes  = list(snooze_logs.find({"user_id": uid}).sort("snoozed_at", 1))
    u_alarms   = list(alarms.find({"user_id": uid}))

    total_sessions = len(u_sessions)
    completed = sum(1 for s in u_sessions if s.get("completed") or s.get("completed_at") or s.get("status") == "COMPLETED")
    snooze_count = len(u_snoozes)

    wake_hours = []
    daily = defaultdict(lambda: {"date": "", "completed": 0, "total": 0, "snoozes": 0, "wake_hour": None})
    for s in u_sessions:
        dt = s.get("triggered_at")
        if isinstance(dt, datetime):
            key = dt.strftime("%Y-%m-%d")
            h = dt.hour + dt.minute / 60.0
            wake_hours.append(h)
            daily[key]["date"] = key
            daily[key]["total"] += 1
            daily[key]["wake_hour"] = round(h, 2)
            if s.get("completed") or s.get("completed_at") or s.get("status") == "COMPLETED":
                daily[key]["completed"] += 1
    for sn in u_snoozes:
        dt = sn.get("snoozed_at")
        if isinstance(dt, datetime):
            key = dt.strftime("%Y-%m-%d")
            daily[key]["date"] = key
            daily[key]["snoozes"] += 1

    avg_wake_hour = round(sum(wake_hours) / len(wake_hours), 2) if wake_hours else None
    if len(wake_hours) >= 2:
        mean_h = sum(wake_hours) / len(wake_hours)
        variance = sum((h - mean_h) ** 2 for h in wake_hours) / len(wake_hours)
        std_dev = variance ** 0.5
        consistency_score = max(0.0, round(100.0 - std_dev * 40.0, 1))
    else:
        std_dev = 0.0
        consistency_score = 100.0 if wake_hours else 0.0

    snooze_rate = round(snooze_count / max(total_sessions, 1) * 100, 1)
    completion_rate = round(completed / total_sessions * 100, 1) if total_sessions else 0.0
    snooze_penalty = min(100.0, snooze_rate * 2.0)
    sleep_quality = round(0.40 * consistency_score + 0.40 * completion_rate + 0.20 * max(0.0, 100.0 - snooze_penalty), 1) if total_sessions else 0.0

    current_streak, longest_streak = calculate_user_streak(uid)
    alarm_times = [a.get("alarm_time", "") for a in u_alarms if a.get("alarm_time")]

    timeline = sorted(daily.values(), key=lambda x: x["date"])

    # Detailed session list (last 20)
    session_list = []
    for s in reversed(u_sessions[-20:]):
        dt = s.get("triggered_at")
        session_list.append({
            "date": dt.strftime("%Y-%m-%d %H:%M") if isinstance(dt, datetime) else "N/A",
            "completed": bool(s.get("completed") or s.get("completed_at") or s.get("status") == "COMPLETED"),
            "snoozed_count": s.get("snoozed_count", 0),
            "total_time": s.get("total_time", 0),
            "challenges_completed": s.get("challenges_completed", 0),
        })

    return {
        "profile": clean(target),
        "metrics": {
            "total_sessions": total_sessions,
            "completed_sessions": completed,
            "completion_rate": completion_rate,
            "snooze_count": snooze_count,
            "snooze_rate": snooze_rate,
            "avg_wake_hour": avg_wake_hour,
            "wake_time_std_dev": round(std_dev, 2),
            "consistency_score": consistency_score,
            "sleep_quality_score": sleep_quality,
            "streak": current_streak,
            "longest_streak": longest_streak,
            "most_common_alarm": alarm_times[0] if alarm_times else "Not set",
        },
        "timeline": timeline,
        "sessions": session_list,
    }


@app.get("/api/wellness_coach/self-report")
def wellness_coach_self_report(user=Depends(require_roles("WELLNESS_COACH", "ADMIN"))):
    """A wellness_coach's report is intentionally restricted to their own behavioural data."""
    uid = str(user["_id"])
    own_sessions = list(alarm_sessions.find({"user_id": uid}))
    own_attempts = list(challenge_attempts.find({"user_id": uid}))
    own_snoozes = list(snooze_logs.find({"user_id": uid}))
    result = build_wellness_coach_analytics(
        [user],
        own_sessions,
        own_attempts,
        own_snoozes,
    )
    completed_sessions = sum(
        1 for session in own_sessions
        if session.get("completed") or session.get("completed_at") or session.get("status") == "COMPLETED"
    )
    correct_attempts = sum(1 for attempt in own_attempts if attempt.get("correct"))
    current_streak, longest_streak = calculate_user_streak(uid)
    result["summary"] = {
        "alarm_sessions": len(own_sessions),
        "completed_sessions": completed_sessions,
        "wake_success_rate": round(completed_sessions / len(own_sessions) * 100, 1) if own_sessions else None,
        "challenge_attempts": len(own_attempts),
        "challenge_completed": correct_attempts,
        "challenge_score": round(correct_attempts / len(own_attempts) * 100, 1) if own_attempts else None,
        "snoozes": len(own_snoozes),
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "engagement_events": len(own_sessions) + len(own_attempts) + len(own_snoozes),
    }
    return result
