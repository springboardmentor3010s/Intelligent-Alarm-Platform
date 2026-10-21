from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional
from pydantic import BaseModel

from database import get_db
from Models.habit import Habit
from auth import get_current_user
from services.notification_service import create_notification

router = APIRouter(prefix="/habits", tags=["Habits"])

class HabitCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    category: Optional[str] = "Health"
    frequency: Optional[str] = "Daily"
    target_duration_minutes: Optional[int] = 15
    priority: Optional[str] = "Medium"
    reminder_time: Optional[str] = None
    start_date: Optional[date] = None
    target_date: Optional[date] = None
    goal_target: Optional[str] = ""
    is_enabled: bool = True

class HabitUpdateRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    category: Optional[str] = "Health"
    frequency: Optional[str] = "Daily"
    target_duration_minutes: Optional[int] = 15
    priority: Optional[str] = "Medium"
    reminder_time: Optional[str] = None
    start_date: Optional[date] = None
    target_date: Optional[date] = None
    goal_target: Optional[str] = ""
    is_enabled: bool = True

def serialize_habit(habit: Habit):
    return {"id": habit.id, "name": habit.name, "description": habit.description or "", "category": habit.category, "frequency": habit.frequency, "target_duration_minutes": habit.target_duration_minutes, "priority": habit.priority or "Medium", "reminder_time": habit.reminder_time, "start_date": habit.start_date.isoformat() if habit.start_date else None, "target_date": habit.target_date.isoformat() if habit.target_date else None, "goal_target": habit.goal_target or "", "is_enabled": habit.is_enabled, "completed": habit.completed, "created_at": habit.created_at.isoformat() if habit.created_at else None}

@router.get("")
def get_habits(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.get("user_id")
    habits = db.query(Habit).filter(Habit.user_id == user_id).order_by(Habit.id.desc()).all()
    return [serialize_habit(habit) for habit in habits]

@router.post("")
def create_habit(habit_data: HabitCreateRequest, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.get("user_id")
    new_habit = Habit(user_id=user_id, name=habit_data.name, description=habit_data.description or "", category=habit_data.category or "Health", frequency=habit_data.frequency or "Daily", target_duration_minutes=habit_data.target_duration_minutes or 15, priority=habit_data.priority or "Medium", reminder_time=habit_data.reminder_time or None, start_date=habit_data.start_date, target_date=habit_data.target_date, goal_target=habit_data.goal_target or "", is_enabled=habit_data.is_enabled, completed=False)
    db.add(new_habit)
    db.commit()
    db.refresh(new_habit)

    if new_habit.reminder_time:
        create_notification(
            db=db,
            user_id=user_id,
            title=f"Habit Reminder Set: {new_habit.name}",
            message=f"Daily habit reminder configured for {new_habit.reminder_time}.",
            category="habit",
            priority="normal",
            link="/habits",
            related_entity_type="habit",
            related_entity_id=new_habit.id,
            prevent_duplicate=True
        )

    return {"message": "Habit created successfully", "habit": serialize_habit(new_habit)}

@router.put("/{habit_id}")
def update_habit(habit_id: int, habit_data: HabitUpdateRequest, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.get("user_id")
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    if not habit_data.name.strip():
        raise HTTPException(status_code=422, detail="Habit name cannot be empty")
    habit.name = habit_data.name.strip()
    habit.description = habit_data.description or ""
    habit.category = habit_data.category or "Health"
    habit.frequency = habit_data.frequency or "Daily"
    habit.target_duration_minutes = habit_data.target_duration_minutes or 15
    habit.priority = habit_data.priority or "Medium"
    habit.reminder_time = habit_data.reminder_time or None
    habit.start_date = habit_data.start_date
    habit.target_date = habit_data.target_date
    habit.goal_target = habit_data.goal_target or ""
    habit.is_enabled = habit_data.is_enabled
    db.commit()
    db.refresh(habit)
    return {"message": "Habit updated successfully", "habit": serialize_habit(habit)}

@router.patch("/{habit_id}/toggle")
def toggle_habit(habit_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.get("user_id")
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    if not habit: raise HTTPException(status_code=404, detail="Habit not found")
    habit.completed = not habit.completed
    db.commit()
    db.refresh(habit)

    if habit.completed:
        create_notification(
            db=db,
            user_id=user_id,
            title=f"Habit Completed: {habit.name}",
            message=f"Great job completing '{habit.name}' today! Your daily habit streak is moving forward.",
            category="habit",
            priority="normal",
            link="/habits",
            related_entity_type="habit",
            related_entity_id=habit.id,
            prevent_duplicate=True
        )

    return {"message": "Habit status updated", "completed": habit.completed}

@router.delete("/{habit_id}")
def delete_habit(habit_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.get("user_id")
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    if not habit: raise HTTPException(status_code=404, detail="Habit not found")
    db.delete(habit)
    db.commit()
    return {"message": "Habit deleted successfully"}
