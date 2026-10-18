from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Dict, Any

from mongodb import log_behavior_event


router = APIRouter(
    prefix="/behavior",
    tags=["Behavioral Analytics"]
)


class BehaviorEvent(BaseModel):
    user_id: int
    event_type: str
    event_data: Optional[Dict[str, Any]] = None


@router.post("/event")
def create_behavior_event(event: BehaviorEvent):
    event_id = log_behavior_event(
        user_id=event.user_id,
        event_type=event.event_type,
        event_data=event.event_data
    )

    return {
        "message": "Behavior event recorded successfully",
        "event_id": event_id
    }