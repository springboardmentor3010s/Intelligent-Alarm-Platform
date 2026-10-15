from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.models import Alarm, User
from app.schemas.schemas import AlarmCreate, AlarmUpdate, AlarmOut
from app.core.security import get_current_user

router = APIRouter(prefix="/alarms", tags=["Alarms"])

@router.get("", response_model=List[AlarmOut])
def get_alarms(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Alarm).filter(Alarm.user_id == current_user.id).all()

@router.post("", response_model=AlarmOut, status_code=201)
def create_alarm(data: AlarmCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    alarm = Alarm(**data.model_dump(), user_id=current_user.id)
    db.add(alarm)
    db.commit()
    db.refresh(alarm)
    return alarm

@router.get("/{alarm_id}", response_model=AlarmOut)
def get_alarm(alarm_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    alarm = db.query(Alarm).filter(Alarm.id == alarm_id, Alarm.user_id == current_user.id).first()
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")
    return alarm

@router.put("/{alarm_id}", response_model=AlarmOut)
def update_alarm(alarm_id: int, data: AlarmUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    alarm = db.query(Alarm).filter(Alarm.id == alarm_id, Alarm.user_id == current_user.id).first()
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(alarm, field, value)
    db.commit()
    db.refresh(alarm)
    return alarm

@router.delete("/{alarm_id}", status_code=204)
def delete_alarm(alarm_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    alarm = db.query(Alarm).filter(Alarm.id == alarm_id, Alarm.user_id == current_user.id).first()
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")
    db.delete(alarm)
    db.commit()
