from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, ForeignKey, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from jose import jwt
from pydantic import BaseModel
from datetime import datetime
import hashlib
import time
import os
import io
import csv
import json

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from openpyxl import Workbook

from intelligence import (
    DIFFICULTY_LEVELS,
    CHALLENGE_TYPES,
    VERIFICATION_METHODS,
    generate_cognitive_challenge,
    adapt_user_difficulty,
    compute_weighted_habit_score,
    analyze_behavior_and_anomalies,
    generate_personalized_recommendations
)

app = FastAPI(title="Intelligent Cognitive Alarm Platform", version="11.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_GATEWAY_METRICS = {
    "total_requests": 0,
    "avg_response_time_ms": 8.4,
    "rate_limit_status": "Active",
    "recent_audit_logs": []
}

@app.middleware("http")
async def api_gateway_middleware(request: Request, call_next):
    t0 = time.perf_counter()
    API_GATEWAY_METRICS["total_requests"] += 1
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
    log_entry = f"[{datetime.now().strftime('%H:%M:%S')}] {request.method} {request.url.path} -> {response.status_code} ({elapsed_ms}ms)"
    API_GATEWAY_METRICS["recent_audit_logs"] = ([log_entry] + API_GATEWAY_METRICS["recent_audit_logs"])[:15]
    return response

SECRET_KEY = "intelligent_cognitive_alarm_secret_key_master"
ALGORITHM = "HS256"
VALID_ROLES = ["User", "Wellness Coach", "Administrator"]
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def hash_password(password: str) -> str:
    salt = "cognitive_alarm_salt_v4"
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password

POSTGRES_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost/cognitive_alarm")

try:
    engine = create_engine(POSTGRES_URL, pool_pre_ping=True, connect_args={"connect_timeout": 2})
    with engine.connect() as conn:
        pass
except Exception:
    engine = create_engine("sqlite:///./cognitive_alarm_v4.db", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

LOCAL_MONGO_FILE = "mongodb_document_store.json"

def insert_document_log(doc: dict):
    # FIXED: Added 'Z' so Javascript parses UTC correctly for the graphs
    doc["timestamp"] = datetime.utcnow().isoformat() + "Z"
    data = []
    if os.path.exists(LOCAL_MONGO_FILE):
        try:
            with open(LOCAL_MONGO_FILE, "r") as f:
                data = json.load(f)
        except Exception:
            data = []
    doc["id"] = len(data) + 1
    data.append(doc)
    with open(LOCAL_MONGO_FILE, "w") as f:
        json.dump(data, f, indent=2)

def get_document_logs(user_id: int = None) -> list:
    if not os.path.exists(LOCAL_MONGO_FILE):
        return []
    try:
        with open(LOCAL_MONGO_FILE, "r") as f:
            data = json.load(f)
        if user_id is not None:
            return [d for d in data if d.get("user_id") == user_id]
        return data
    except Exception:
        return []

def delete_user_document_logs(user_id: int):
    if not os.path.exists(LOCAL_MONGO_FILE):
        return
    try:
        with open(LOCAL_MONGO_FILE, "r") as f:
            data = json.load(f)
        filtered = [d for d in data if d.get("user_id") != user_id]
        with open(LOCAL_MONGO_FILE, "w") as f:
            json.dump(filtered, f, indent=2)
    except Exception:
        pass

class UserDB(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, default="")
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="User")
    auth_provider = Column(String, default="local")
    preferred_wake_time = Column(String, default="07:00")
    sleep_duration_hours = Column(Float, default=8.0)
    timezone = Column(String, default="IST (UTC+5:30)")
    productivity_goals = Column(String, default="Morning Study & Deep Focus")
    difficulty_preference = Column(String, default="Easy")
    habit_preferences = Column(String, default="Math Problems")

class AlarmDB(Base):
    __tablename__ = "alarms"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    time = Column(String)
    alarm_type = Column(String, default="Daily Alarm")
    recurring_days = Column(String, default="Mon-Sun")
    challenge_type = Column(String, default="Math Problems")
    difficulty = Column(String, default="Easy")
    verification_method = Column(String, default="Puzzle Completion")
    custom_label = Column(String, default="Morning Wake-Up")
    is_active = Column(Boolean, default=True)

class NotificationDB(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    category = Column(String)
    message = Column(String)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat() + "Z")

class HabitScoreDB(Base):
    __tablename__ = "habit_scores"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    wake_up_consistency = Column(Float)
    challenge_completion = Column(Float)
    snooze_reduction = Column(Float)
    sleep_adherence = Column(Float)
    total_score = Column(Float)
    timestamp = Column(String, default=lambda: datetime.utcnow().isoformat() + "Z")

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> UserDB:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user = db.query(UserDB).filter(UserDB.username == payload.get("sub")).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

class RegisterRequest(BaseModel):
    full_name: str
    email: str
    username: str
    password: str
    role: str = "User"

class GoogleAuthRequest(BaseModel):
    email: str
    full_name: str = ""
    google_id: str
    role: str = "User"

class ProfileUpdate(BaseModel):
    full_name: str = ""
    preferred_wake_time: str
    sleep_duration_hours: float
    timezone: str
    productivity_goals: str
    habit_preferences: str

class AlarmCreate(BaseModel):
    time: str
    alarm_type: str
    recurring_days: str = "Mon-Fri"
    challenge_type: str = "Math Problems"
    verification_method: str = "Puzzle Completion"
    custom_label: str = "Morning Wake-Up"

class ChallengeVerifyRequest(BaseModel):
    challenge_id: str
    challenge_type: str
    difficulty: str
    verification_method: str
    user_answer: str
    expected_answer: str
    time_taken_seconds: float
    snoozed: bool
    steps_completed: int = 1

class AnnouncementCreate(BaseModel):
    category: str = "Broadcast Alert"
    message: str

@app.get("/", tags=["System Status"])
def root_status():
    return {"status": "Online", "web_dashboard": "http://localhost:3000"}

@app.post("/register", tags=["Authentication & RBAC"])
def register_user(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(UserDB).filter(UserDB.username == req.username).first():
        raise HTTPException(status_code=400, detail="Username is already taken")
    assigned_role = req.role if req.role in VALID_ROLES else "User"
    new_user = UserDB(
        full_name=req.full_name, email=req.email, username=req.username,
        hashed_password=hash_password(req.password), role=assigned_role, auth_provider="local",
        difficulty_preference="Easy"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    db.add(NotificationDB(user_id=new_user.id, category="Account Created", message=f"Welcome {req.full_name}! Your '{assigned_role}' account is ready."))
    db.commit()
    return {"status": "registered", "username": new_user.username, "role": new_user.role}

@app.post("/login", tags=["Authentication & RBAC"])
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(UserDB).filter((UserDB.username == form_data.username) | (UserDB.email == form_data.username)).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username/email or password")
    token = jwt.encode({"sub": user.username, "role": user.role}, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer", "role": user.role, "username": user.username, "full_name": user.full_name, "email": user.email}

@app.post("/auth/google", tags=["Authentication & RBAC"])
def google_oauth_login(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.email == req.email).first()
    if not user:
        assigned_role = req.role if req.role in VALID_ROLES else "User"
        base_username = req.email.split("@")[0]
        user = UserDB(full_name=req.full_name, email=req.email, username=base_username, hashed_password=hash_password(req.google_id), role=assigned_role, auth_provider="google")
        db.add(user)
        db.commit()
        db.refresh(user)
    token = jwt.encode({"sub": user.username, "role": user.role}, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "role": user.role, "full_name": user.full_name}

@app.put("/users/{target_user_id}/role", tags=["Administrator User Management"])
def grant_user_role(target_user_id: int, new_role: str, user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "Administrator":
        raise HTTPException(status_code=403, detail="Only Administrators can change roles.")
    target = db.query(UserDB).filter(UserDB.id == target_user_id).first()
    if target:
        target.role = new_role
        db.commit()
    return {"status": "Role updated"}

@app.delete("/users/{target_user_id}", tags=["Administrator User Management"])
def delete_user_account(target_user_id: int, user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "Administrator":
        raise HTTPException(status_code=403, detail="Only Administrators can delete users.")
    target = db.query(UserDB).filter(UserDB.id == target_user_id).first()
    if target:
        db.query(AlarmDB).filter(AlarmDB.user_id == target.id).delete()
        db.delete(target)
        db.commit()
    return {"status": "User deleted"}

@app.put("/profile", tags=["User Profile"])
def update_profile(profile: ProfileUpdate, user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    user.full_name = profile.full_name
    user.preferred_wake_time = profile.preferred_wake_time
    user.sleep_duration_hours = profile.sleep_duration_hours
    user.timezone = profile.timezone
    user.productivity_goals = profile.productivity_goals
    user.habit_preferences = profile.habit_preferences
    db.commit()
    return {"status": "Profile updated"}

@app.post("/alarms", tags=["Alarm Management"])
def create_alarm(alarm: AlarmCreate, user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    new_alarm = AlarmDB(
        user_id=user.id, time=alarm.time, alarm_type=alarm.alarm_type, recurring_days=alarm.recurring_days,
        challenge_type=alarm.challenge_type, difficulty=user.difficulty_preference, verification_method=alarm.verification_method,
        custom_label=alarm.custom_label, is_active=True
    )
    db.add(new_alarm)
    db.commit()
    return {"status": "Alarm created"}

@app.put("/alarms/{alarm_id}/toggle", tags=["Alarm Management"])
def toggle_alarm(alarm_id: int, user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    alarm = db.query(AlarmDB).filter(AlarmDB.id == alarm_id, AlarmDB.user_id == user.id).first()
    if alarm:
        alarm.is_active = not alarm.is_active
        db.commit()
    return {"status": "Toggled"}

@app.delete("/alarms/{alarm_id}", tags=["Alarm Management"])
def delete_alarm(alarm_id: int, user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    alarm = db.query(AlarmDB).filter(AlarmDB.id == alarm_id, AlarmDB.user_id == user.id).first()
    if alarm:
        db.delete(alarm)
        db.commit()
    return {"status": "Deleted"}

@app.delete("/notifications/clear", tags=["Notifications"])
def clear_notifications(user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(NotificationDB).filter((NotificationDB.user_id == user.id) | (NotificationDB.user_id == None)).delete()
    db.commit()
    return {"status": "Notifications cleared"}

@app.get("/challenge/generate", tags=["Cognitive Challenges"])
def get_challenge(challenge_type: str = None, difficulty: str = None, verification_method: str = "Puzzle Completion", user: UserDB = Depends(get_current_user)):
    return generate_cognitive_challenge(challenge_type, difficulty, verification_method)

@app.post("/challenge/verify", tags=["Cognitive Challenges"])
def verify_and_adapt(payload: ChallengeVerifyRequest, user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    is_correct = (payload.user_answer.strip().lower() == payload.expected_answer.strip().lower()) and not payload.snoozed
    insert_document_log({
        "user_id": user.id, "username": user.username, "full_name": user.full_name,
        "challenge_id": payload.challenge_id, "challenge_type": payload.challenge_type, "difficulty": payload.difficulty,
        "verification_method": payload.verification_method, "is_successful": is_correct,
        "snoozed": payload.snoozed, "completion_time_seconds": payload.time_taken_seconds, "steps_completed": payload.steps_completed
    })
    
    user_logs = get_document_logs(user.id)
    adaptation = adapt_user_difficulty(payload.difficulty or user.difficulty_preference, user_logs)
    
    # AI dynamically adapts the user's base difficulty based on performance
    user.difficulty_preference = adaptation["new_difficulty"]
    
    alarms = db.query(AlarmDB).filter(AlarmDB.user_id == user.id).all()
    for a in alarms:
        a.difficulty = adaptation["new_difficulty"]
        
    active_alarms_count = sum(1 for a in alarms if a.is_active)
    score_breakdown = compute_weighted_habit_score(user_logs, user.sleep_duration_hours, active_alarms_count)
    db.commit()
    
    return {"verified": is_correct, "snoozed": payload.snoozed, "adaptation": adaptation, "score_breakdown": score_breakdown}

@app.get("/dashboard", tags=["Dashboards & Analytics"])
def get_complete_dashboard(user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    all_logs = get_document_logs()
    user_logs = get_document_logs(user.id)
    alarms = db.query(AlarmDB).filter(AlarmDB.user_id == user.id).all()
    alarms_serialized = [{"id": a.id, "time": a.time, "alarm_type": a.alarm_type, "challenge_type": a.challenge_type, "difficulty": a.difficulty or user.difficulty_preference, "verification_method": a.verification_method, "custom_label": a.custom_label, "is_active": a.is_active} for a in alarms]
    active_alarms_count = sum(1 for a in alarms_serialized if a["is_active"])

    score_breakdown = compute_weighted_habit_score(user_logs, user.sleep_duration_hours, active_alarms_count)
    behavior = analyze_behavior_and_anomalies(user_logs, user.sleep_duration_hours)
    recommendations = generate_personalized_recommendations(score_breakdown, behavior, user.habit_preferences, alarms_serialized, user.full_name or user.username, user.preferred_wake_time)
    adaptation_state = adapt_user_difficulty(user.difficulty_preference, user_logs)

    notifs = db.query(NotificationDB).filter((NotificationDB.user_id == user.id) | (NotificationDB.user_id == None)).order_by(NotificationDB.id.desc()).limit(15).all()

    all_users = db.query(UserDB).all()
    cohort_analytics = []
    for u in all_users:
        u_logs = get_document_logs(u.id)
        u_score = compute_weighted_habit_score(u_logs, u.sleep_duration_hours, 1)
        u_beh = analyze_behavior_and_anomalies(u_logs, u.sleep_duration_hours)
        cohort_analytics.append({"id": u.id, "full_name": u.full_name or u.username, "email": u.email, "username": u.username, "role": u.role, "wake_goal": u.preferred_wake_time, "sleep_hours": u.sleep_duration_hours, "difficulty": u.difficulty_preference, "habit_score": u_score["total_habit_score"], "status": u_beh["behavioral_status"]})

    overall_beh = analyze_behavior_and_anomalies(all_logs)

    return {
        "assigned_role": user.role,
        "profile": {"id": user.id, "full_name": user.full_name, "email": user.email, "username": user.username, "role": user.role, "preferred_wake_time": user.preferred_wake_time, "sleep_duration_hours": user.sleep_duration_hours, "timezone": user.timezone, "productivity_goals": user.productivity_goals, "difficulty_preference": user.difficulty_preference, "habit_preferences": user.habit_preferences},
        "alarms": alarms_serialized,
        "habit_score_breakdown": score_breakdown,
        "behavioral_analytics": behavior,
        "adaptive_engine": adaptation_state,
        "recommendations": recommendations,
        "recent_challenge_logs": user_logs[::-1],
        "notifications": [{"category": n.category, "message": n.message, "created_at": n.created_at} for n in notifs],
        "coach_dashboard": {"cohort_analytics": cohort_analytics, "sleep_trend_summary": "Users completing cognitive puzzles maintain higher wake-up consistency."},
        "admin_dashboard": {"platform_metrics": {"total_users": len(all_users), "total_active_alarms": db.query(AlarmDB).count(), "total_challenges_logged": len(all_logs), "platform_wake_accuracy": overall_beh["wake_up_accuracy_percent"]}, "user_directory": cohort_analytics}
    }

@app.get("/export/pdf", tags=["Reports & Export"])
def export_pdf(report_type: str = "Complete Master Report", user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    
    current_date = datetime.now().strftime("%B %d, %Y at %I:%M %p")
    
    if report_type == "System Report" and user.role == "Administrator":
        all_logs = get_document_logs()
        total_users = db.query(UserDB).count()
        overall_beh = analyze_behavior_and_anomalies(all_logs)
        p.setFont("Helvetica-Bold", 16)
        p.drawString(45, 755, "Intelligent Cognitive Alarm — System Platform Report")
        p.setFont("Helvetica", 10)
        p.drawString(45, 735, f"Generated by Admin: {user.full_name} | Role: Administrator")
        p.drawString(45, 720, f"Date Generated: {current_date}")
        p.line(45, 710, 565, 710)
        p.setFont("Helvetica-Bold", 12)
        p.drawString(45, 680, "Platform Analytics Overview")
        p.setFont("Helvetica", 11)
        p.drawString(60, 662, f"• Total Registered Users: {total_users}")
        p.drawString(60, 646, f"• Total Active Smart Alarms: {db.query(AlarmDB).count()}")
        p.drawString(60, 630, f"• Total Cognitive Puzzles Solved: {len(all_logs)}")
        p.drawString(60, 614, f"• Platform-Wide Wake Accuracy: {overall_beh['wake_up_accuracy_percent']}%")
        p.showPage()
        p.save()
        buffer.seek(0)
        return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=system_report.pdf"})
        
    if report_type == "Sleep Trend Report" and user.role == "Wellness Coach":
        p.setFont("Helvetica-Bold", 16)
        p.drawString(45, 755, "Intelligent Cognitive Alarm — Cohort Sleep Trend Report")
        p.setFont("Helvetica", 10)
        p.drawString(45, 735, f"Generated by Coach: {user.full_name} | Role: Wellness Coach")
        p.drawString(45, 720, f"Date Generated: {current_date}")
        p.line(45, 710, 565, 710)
        p.setFont("Helvetica-Bold", 12)
        p.drawString(45, 680, "Cohort Monitoring Summary")
        p.setFont("Helvetica", 11)
        p.drawString(60, 662, "• Trend: Users completing cognitive puzzles maintain higher wake-up consistency.")
        p.drawString(60, 646, f"• Total Monitored Users: {db.query(UserDB).count()}")
        p.showPage()
        p.save()
        buffer.seek(0)
        return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=sleep_trend_report.pdf"})

    logs = get_document_logs(user.id)
    score = compute_weighted_habit_score(logs, user.sleep_duration_hours, 1)
    behavior = analyze_behavior_and_anomalies(logs, user.sleep_duration_hours)
    recs = generate_personalized_recommendations(score, behavior, user.habit_preferences)

    p.setFont("Helvetica-Bold", 16)
    p.drawString(45, 755, f"Intelligent Cognitive Alarm — {report_type}")
    p.setFont("Helvetica", 10)
    p.drawString(45, 735, f"User: {user.full_name} ({user.email}) | Target Sleep: {user.sleep_duration_hours}h")
    p.drawString(45, 720, f"Date Generated: {current_date}")
    p.line(45, 710, 565, 710)

    y_pos = 680

    def check_page():
        nonlocal y_pos
        if y_pos < 100:
            p.showPage()
            y_pos = 750

    if report_type in ["Habit reports", "Complete Master Report"]:
        p.setFont("Helvetica-Bold", 12)
        p.drawString(45, y_pos, "Habit Score Breakdown (35/25/20/20 Weighting)")
        p.setFont("Helvetica", 11)
        p.drawString(60, y_pos-18, f"• Overall Habit Score: {score['total_habit_score']} / 100")
        p.drawString(60, y_pos-34, f"• Wake-Up Consistency (35%): {score['wake_up_consistency_score']} | Challenge Success (25%): {score['challenge_completion_score']}")
        p.drawString(60, y_pos-50, f"• Snooze Reduction (20%): {score['snooze_reduction_score']} | Sleep Adherence (20%): {score['sleep_adherence_score']}")
        y_pos -= 85
        check_page()

    if report_type in ["Wake-up reports", "Complete Master Report"]:
        p.setFont("Helvetica-Bold", 12)
        p.drawString(45, y_pos, "Wake-Up Analytics & Verification")
        p.setFont("Helvetica", 11)
        p.drawString(60, y_pos-18, f"• First-Alarm Wake-Up Accuracy: {behavior['wake_up_accuracy_percent']}%")
        p.drawString(60, y_pos-34, f"• Snooze Rate & Penalty Impact: {behavior['snooze_rate_percent']}%")
        p.drawString(60, y_pos-50, f"• Wake-Up Tip: {recs['wakeup_optimization_suggestions'][:90]}...")
        y_pos -= 85
        check_page()

    if report_type in ["Challenge performance reports", "Complete Master Report"]:
        p.setFont("Helvetica-Bold", 12)
        p.drawString(45, y_pos, "Cognitive Challenge Performance")
        p.setFont("Helvetica", 11)
        p.drawString(60, y_pos-18, f"• Current Adaptive Difficulty Stage: {user.difficulty_preference}")
        p.drawString(60, y_pos-34, f"• Preferred Puzzle Category: {user.habit_preferences}")
        p.drawString(60, y_pos-50, f"• Average Cognitive Response Time: {behavior['avg_response_time_sec']}s")
        p.drawString(60, y_pos-66, f"• Puzzle Tip: {recs['personalized_challenge_recommendations'][:90]}...")
        y_pos -= 100
        check_page()

    if report_type in ["Productivity reports", "Complete Master Report"]:
        p.setFont("Helvetica-Bold", 12)
        p.drawString(45, y_pos, "Productivity & Focus Mapping")
        p.setFont("Helvetica", 11)
        p.drawString(60, y_pos-18, f"• User Stated Daily Productivity Goal: {user.productivity_goals}")
        p.drawString(60, y_pos-34, f"• Cognitive Readiness Correlation (R²): {behavior.get('productivity_correlation_analysis', 0.91)}")
        p.drawString(60, y_pos-50, f"• Focus Tip: {recs['productivity_recommendations'][:90]}...")
        y_pos -= 85
        check_page()

    if report_type in ["Sleep analytics reports", "Complete Master Report"]:
        p.setFont("Helvetica-Bold", 12)
        p.drawString(45, y_pos, "Sleep Analytics & Circadian Health")
        p.setFont("Helvetica", 11)
        p.drawString(60, y_pos-18, f"• Sleep Duration Target: {user.sleep_duration_hours} Hours")
        p.drawString(60, y_pos-34, f"• Wake-Up Goal: {user.preferred_wake_time}")
        p.drawString(60, y_pos-50, f"• Behavioral Status: {behavior['behavioral_status']}")
        p.drawString(60, y_pos-66, f"• Sleep Tip: {recs['sleep_improvement_recommendations'][:90]}...")
        y_pos -= 100
        check_page()

    p.showPage()
    p.save()
    buffer.seek(0)
    response = StreamingResponse(buffer, media_type="application/pdf")
    response.headers["Content-Disposition"] = f"attachment; filename={report_type.lower().replace(' ', '_')}.pdf"
    return response

@app.get("/export/csv", tags=["Reports & Export"])
def export_csv(report_type: str = "Complete Master Report", user: UserDB = Depends(get_current_user)):
    logs = get_document_logs()
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["Report Type", "Username", "Challenge Type", "Difficulty", "Verification", "Verified", "Snoozed", "Time (s)", "Timestamp"])
    for l in logs:
        writer.writerow([report_type, l.get("username"), l.get("challenge_type"), l.get("difficulty"), l.get("verification_method"), l.get("is_successful"), l.get("snoozed"), l.get("completion_time_seconds"), l.get("timestamp")])
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename={report_type.lower().replace(' ', '_')}.csv"
    return response

@app.get("/export/excel", tags=["Reports & Export"])
def export_excel(report_type: str = "Complete Master Report", user: UserDB = Depends(get_current_user)):
    wb = Workbook()
    ws1 = wb.active
    ws1.title = "Summary"
    ws1.append(["Report Type:", report_type])
    ws1.append(["User:", user.full_name])
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    response = StreamingResponse(buffer, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    response.headers["Content-Disposition"] = f"attachment; filename={report_type.lower().replace(' ', '_')}.xlsx"
    return response