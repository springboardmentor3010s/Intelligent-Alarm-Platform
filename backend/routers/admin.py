from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from pydantic import BaseModel

from database import get_db
from Models.user import User, UserProfile
from Models.habit import Habit
from Models.alarm import Alarm
from Models.coach import CoachAssignment, CoachGuidance
from auth import require_role, require_roles, hash_password

router = APIRouter(tags=["Admin & Coach"])

class RoleUpdateRequest(BaseModel):
    role: str

class AdminCreateUserRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str

class CoachAssignmentRequest(BaseModel):
    coach_id: int
    user_id: int

@router.get("/admin/users")
def get_all_users(current_user: dict = Depends(require_role("admin")), db: Session = Depends(get_db)):
    users = db.query(User).all()
    result = []
    for u in users:
        p = db.query(UserProfile).filter(UserProfile.user_id == u.id).first()
        result.append({"id": u.id, "name": u.name, "email": u.email, "role": u.role, "created_at": u.created_at.isoformat() if u.created_at else None, "preferred_wakeup_time": p.preferred_wakeup_time if p else "06:30 AM", "difficulty_preference": p.difficulty_preference if p else "Medium"})
    return result

@router.put("/admin/users/{user_id}/role")
def update_user_role(user_id: int, role_data: RoleUpdateRequest, current_user: dict = Depends(require_role("admin")), db: Session = Depends(get_db)):
    if role_data.role not in ["user", "wellness_coach", "admin"]: raise HTTPException(status_code=400, detail="Invalid role specified")
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    user.role = role_data.role
    db.commit()
    db.refresh(user)
    return {"message": f"User role updated to {user.role}", "user_id": user.id, "role": user.role}

@router.post("/admin/create-user")
def create_user_as_admin(user_data: AdminCreateUserRequest, current_user: dict = Depends(require_role("admin")), db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    valid_roles = ["user", "wellness_coach", "admin"]
    assigned_role = user_data.role if user_data.role in valid_roles else "user"
    
    hashed_pw = hash_password(user_data.password)
    new_user = User(name=user_data.name, email=user_data.email, password_hash=hashed_pw, role=assigned_role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    profile = UserProfile(user_id=new_user.id)
    db.add(profile)
    db.commit()

    try:
        from services.notification_service import notify_admins
        notify_admins(
            db=db,
            title=f"New {assigned_role.replace('_', ' ').title()} Created",
            message=f"Account '{new_user.name}' ({new_user.email}) created by administrator.",
            category="system",
            priority="normal",
            link="/admin/users",
            related_entity_type="user",
            related_entity_id=new_user.id
        )
    except Exception as e:
        print(f"Admin notification failed: {e}")

    return {"message": "User created successfully", "user": {"id": new_user.id, "name": new_user.name, "email": new_user.email, "role": new_user.role}}

from Models.challenge import Challenge, ChallengeAttempt, WakeUpEvent

@router.delete("/admin/users/{user_id}")
def delete_user(user_id: int, current_user: dict = Depends(require_role("admin")), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    
    # Delete associated profile, habits, alarms, challenges
    db.query(UserProfile).filter(UserProfile.user_id == user_id).delete()
    db.query(Habit).filter(Habit.user_id == user_id).delete()
    db.query(Alarm).filter(Alarm.user_id == user_id).delete()
    db.query(ChallengeAttempt).filter(ChallengeAttempt.user_id == user_id).delete()
    db.query(Challenge).filter(Challenge.user_id == user_id).delete()
    db.query(CoachGuidance).filter((CoachGuidance.user_id == user_id) | (CoachGuidance.coach_id == user_id)).delete()
    db.query(CoachAssignment).filter((CoachAssignment.user_id == user_id) | (CoachAssignment.coach_id == user_id)).delete()
    
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}

@router.get("/admin/stats")
def get_admin_stats(current_user: dict = Depends(require_role("admin")), db: Session = Depends(get_db)):
    total_users = db.query(User).filter(User.role == "user").count()
    total_alarms = db.query(Alarm).count()
    active_alarms = db.query(Alarm).filter(Alarm.is_active == True).count()
    total_habits = db.query(Habit).count()
    total_challenges = db.query(Challenge).count()
    
    completed_challenges = db.query(Challenge).filter(Challenge.status == "completed").count()
    success_rate = round((completed_challenges / total_challenges * 100), 1) if total_challenges > 0 else 0
    
    # Calculate Platform Health Score (Engagement + Success Rate)
    engagement_score = min((active_alarms / total_users * 100), 100) if total_users > 0 else 0
    platform_health_score = round((engagement_score + success_rate) / 2, 1)

    # Cognitive Analytics
    avg_score = db.query(func.avg(ChallengeAttempt.score)).scalar() or 0
    avg_solve_time = db.query(func.avg(ChallengeAttempt.solve_time)).scalar() or 0
    
    return {
        "total_users": total_users, 
        "total_alarms": total_alarms, 
        "total_habits": total_habits,
        "total_challenges": total_challenges,
        "challenge_success_rate": success_rate,
        "platform_health_score": platform_health_score,
        "avg_cognitive_score": round(float(avg_score), 1),
        "avg_solve_time": round(float(avg_solve_time), 1)
    }

@router.get("/admin/coaches")
def get_coaches(current_user: dict = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return [{"id": coach.id, "name": coach.name, "email": coach.email} for coach in db.query(User).filter(User.role == "wellness_coach").all()]

@router.post("/admin/coach-assignments")
def assign_user_to_coach(data: CoachAssignmentRequest, current_user: dict = Depends(require_role("admin")), db: Session = Depends(get_db)):
    coach = db.query(User).filter(User.id == data.coach_id, User.role == "wellness_coach").first()
    user = db.query(User).filter(User.id == data.user_id, User.role == "user").first()
    if not coach or not user:
        raise HTTPException(status_code=404, detail="Coach or user not found")
    if db.query(CoachAssignment).filter(CoachAssignment.coach_id == coach.id, CoachAssignment.user_id == user.id).first():
        raise HTTPException(status_code=400, detail="User is already assigned to this coach")
    db.add(CoachAssignment(coach_id=coach.id, user_id=user.id))
    db.commit()
    return {"message": "User assigned to wellness coach"}

@router.get("/admin/challenges")
def get_all_challenges(current_user: dict = Depends(require_role("admin")), db: Session = Depends(get_db)):
    challenges = db.query(Challenge).order_by(Challenge.id.desc()).limit(100).all()
    result = []
    for c in challenges:
        user = db.query(User).filter(User.id == c.user_id).first()
        result.append({
            "id": c.id,
            "user_id": c.user_id,
            "user_name": user.name if user else "Unknown",
            "challenge_type": c.challenge_type,
            "difficulty": c.difficulty,
            "status": c.status,
            "created_at": c.created_at.isoformat() if c.created_at else None
        })
    return result

@router.get("/admin/alarms")
def get_all_alarms(current_user: dict = Depends(require_role("admin")), db: Session = Depends(get_db)):
    alarms = db.query(Alarm).order_by(Alarm.id.desc()).all()
    result = []
    for a in alarms:
        user = db.query(User).filter(User.id == a.user_id).first()
        result.append({
            "id": a.id,
            "user_id": a.user_id,
            "user_name": user.name if user else "Unknown",
            "time": a.time,
            "label": a.title,
            "is_active": a.is_active,
            "challenge_type": a.challenge_type,
            "difficulty": a.difficulty,
            "days_of_week": a.days_of_week,
            "created_at": a.created_at.isoformat() if a.created_at else None
        })
    return result

@router.get("/admin/verifications")
def get_all_verifications(current_user: dict = Depends(require_role("admin")), db: Session = Depends(get_db)):
    events = db.query(WakeUpEvent).order_by(WakeUpEvent.id.desc()).limit(100).all()
    result = []
    for e in events:
        user = db.query(User).filter(User.id == e.user_id).first()
        alarm = db.query(Alarm).filter(Alarm.id == e.alarm_id).first()
        result.append({
            "id": e.id,
            "user_id": e.user_id,
            "user_name": user.name if user else "Unknown",
            "alarm_id": e.alarm_id,
            "alarm_time": alarm.time if alarm else "Unknown",
            "status": e.status,
            "verification_status": e.verification_status,
            "required_challenges": e.required_challenges,
            "completed_challenges": e.completed_challenges,
            "total_attempts": e.total_attempts,
            "started_at": e.started_at.isoformat() if e.started_at else None,
            "completed_at": e.completed_at.isoformat() if e.completed_at else None
        })
    return result

@router.get("/admin/analytics/historical")
def get_historical_analytics(current_user: dict = Depends(require_role("admin")), db: Session = Depends(get_db)):
    from datetime import datetime, timedelta
    import calendar

    # User Growth (Last 6 Months)
    now = datetime.utcnow()
    users = db.query(User).filter(User.role == "user").all()
    user_growth = []
    
    # Pre-fill last 6 months
    for i in range(5, -1, -1):
        target_month = now.replace(day=1) - timedelta(days=30*i)
        month_abbr = calendar.month_abbr[target_month.month]
        user_growth.append({"month": month_abbr, "users": 0})
        
    for user in users:
        if user.created_at:
            month_abbr = calendar.month_abbr[user.created_at.month]
            for item in user_growth:
                if item["month"] == month_abbr:
                    item["users"] += 1
    
    # Make it cumulative growth
    cumulative = 0
    for item in user_growth:
        cumulative += item["users"]
        item["users"] = cumulative

    # Challenge Success vs Failures (Last 7 Days)
    attempts = db.query(ChallengeAttempt).all()
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    challenge_data = {day: {"day": day, "success": 0, "fail": 0} for day in days}
    
    for attempt in attempts:
        if attempt.created_at:
            day_name = days[attempt.created_at.weekday()]
            if attempt.is_correct:
                challenge_data[day_name]["success"] += 1
            else:
                challenge_data[day_name]["fail"] += 1
                
    challenge_success = list(challenge_data.values())

    return {
        "userGrowth": user_growth,
        "challengeSuccess": challenge_success
    }
