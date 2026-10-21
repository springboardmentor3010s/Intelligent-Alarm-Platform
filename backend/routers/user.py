from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from database import get_db
from Models.user import User, UserProfile
from auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(tags=["User & Auth"])

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: Optional[str] = "user"

class LoginRequest(BaseModel):
    email: str
    password: str
    login_type: Optional[str] = "user"

class OAuthLoginRequest(BaseModel):
    name: str
    email: str
    provider: Optional[str] = "google"

class ProfileUpdateRequest(BaseModel):
    Name: str
    Email: str
    Password: Optional[str] = None
    preferred_wakeup_time: Optional[str] = "06:30 AM"
    sleep_duration: Optional[float] = 7.5
    time_zone: Optional[str] = "UTC+05:30"
    productivity_goals: Optional[str] = ""
    difficulty_preference: Optional[str] = "Beginner"
    habit_preferences: Optional[str] = ""
    sleep_schedule_start: Optional[str] = "22:30"
    sleep_schedule_end: Optional[str] = "06:30"


@router.post("/register")
def register(user_data: RegisterRequest, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Secure Public Registration: All public signups are strictly forced to the 'user' role
    assigned_role = "user"
    hashed_pw = hash_password(user_data.password)
    new_user = User(name=user_data.name, email=user_data.email, password_hash=hashed_pw, role=assigned_role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    profile = UserProfile(
        user_id=new_user.id,
        difficulty_preference="Beginner"
    )
    db.add(profile)
    db.commit()

    try:
        from services.notification_service import notify_admins
        notify_admins(
            db=db,
            title="New User Registration",
            message=f"New user account registered: '{new_user.name}' ({new_user.email}).",
            category="system",
            priority="normal",
            link="/admin/users",
            related_entity_type="user",
            related_entity_id=new_user.id
        )
    except Exception as e:
        print(f"Admin notification failed: {e}")

    return {"message": "User registered successfully", "user": {"id": new_user.id, "name": new_user.name, "email": new_user.email, "role": new_user.role}}


@router.post("/login")
def login(user_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email.ilike(user_data.email.strip())).first()
    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user_data.login_type == "admin" and user.role not in ["admin", "wellness_coach"]:
        raise HTTPException(status_code=403, detail="Access denied. Your account does not have Administrative / Coach privileges.")
    if user_data.login_type == "coach" and user.role != "wellness_coach":
        raise HTTPException(status_code=403, detail="Access denied. This account is not a wellness coach.")

    token = create_access_token({"user_id": user.id, "name": user.name, "email": user.email, "role": user.role})
    return {"message": "Login successful", "access_token": token, "token_type": "bearer", "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}}


@router.post("/auth/oauth")
def oauth_login(data: OAuthLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        user = User(name=data.name, email=data.email, password_hash=hash_password("oauth_external_sso_key"), role="user")
        db.add(user)
        db.commit()
        db.refresh(user)
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        db.commit()

    token = create_access_token({"user_id": user.id, "name": user.name, "email": user.email, "role": user.role})
    return {"message": "OAuth login successful", "access_token": token, "token_type": "bearer", "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}}


@router.get("/profile")
def get_profile(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.get("user_id")
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")

    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not profile:
        profile = UserProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    from services.analytics import get_user_adaptive_difficulty
    adaptive_diff = get_user_adaptive_difficulty(user_id, db)
    if profile.difficulty_preference != adaptive_diff:
        profile.difficulty_preference = adaptive_diff
        db.commit()
        db.refresh(profile)

    return {
        "id": user.id, "Name": user.name, "Email": user.email, "Role": user.role,
        "preferred_wakeup_time": profile.preferred_wakeup_time, "sleep_duration": profile.sleep_duration,
        "time_zone": profile.time_zone, "productivity_goals": profile.productivity_goals,
        "difficulty_preference": profile.difficulty_preference, "habit_preferences": profile.habit_preferences,
        "sleep_schedule_start": profile.sleep_schedule_start, "sleep_schedule_end": profile.sleep_schedule_end
    }


@router.put("/profile")
def update_profile(profile_data: ProfileUpdateRequest, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.get("user_id")
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")

    existing_user = db.query(User).filter(User.email == profile_data.Email, User.id != user_id).first()
    if existing_user: raise HTTPException(status_code=400, detail="Email already registered by another user")

    user.name = profile_data.Name
    user.email = profile_data.Email
    if profile_data.Password: user.password_hash = hash_password(profile_data.Password)

    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not profile: profile = UserProfile(user_id=user_id); db.add(profile)

    if profile_data.preferred_wakeup_time is not None: profile.preferred_wakeup_time = profile_data.preferred_wakeup_time
    if profile_data.sleep_duration is not None: profile.sleep_duration = profile_data.sleep_duration
    if profile_data.time_zone is not None: profile.time_zone = profile_data.time_zone
    if profile_data.productivity_goals is not None: profile.productivity_goals = profile_data.productivity_goals
    if profile_data.difficulty_preference is not None: profile.difficulty_preference = profile_data.difficulty_preference
    if profile_data.habit_preferences is not None: profile.habit_preferences = profile_data.habit_preferences
    if profile_data.sleep_schedule_start is not None: profile.sleep_schedule_start = profile_data.sleep_schedule_start
    if profile_data.sleep_schedule_end is not None: profile.sleep_schedule_end = profile_data.sleep_schedule_end

    db.commit()
    db.refresh(user)
    db.refresh(profile)
    return {"message": "Profile updated successfully"}


@router.delete("/profile")
def delete_account(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.get("user_id")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db.delete(user)
    db.commit()
    return {"message": "Account deleted successfully"}
