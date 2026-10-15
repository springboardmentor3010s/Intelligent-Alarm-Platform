from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class ClientSummary(BaseModel):
    id: int
    name: str
    email: str
    created_at: Optional[datetime] = None
    preferred_wake_time: Optional[str] = None
    sleep_duration: Optional[int] = None
    time_zone: Optional[str] = None
    difficulty_preference: Optional[str] = "medium"
    habit_score: float = 60.0
    total_alarms: int = 0
    active_alarms: int = 0
    total_sessions: int = 0
    completed_sessions: int = 0
    completion_rate: float = 0.0


class CoachDashboardStats(BaseModel):
    total_clients: int
    active_clients: int
    average_habit_score: float
    total_completed_sessions: int
    clients: List[ClientSummary]


class ClientInsightsResponse(BaseModel):
    client: Dict[str, Any]
    behavioral_summary: Dict[str, Any]
    habit_metrics: Dict[str, Any]
    ml_insights: Dict[str, Any]


class ClientHabitsResponse(BaseModel):
    client_id: int
    client_name: str
    goals: Dict[str, Optional[str]]
    adherence_metrics: Dict[str, float]
    streak: int
    snooze_frequency: Dict[str, Any]


class SleepLogItem(BaseModel):
    session_id: int
    alarm_id: int
    alarm_name: str
    scheduled_alarm_time: str
    started_at_ist: str
    completed_at_ist: str
    actual_wake_time: str
    drift_minutes: Optional[float] = None
    on_time: bool
    snooze_count: int
    dismissal_status: str


class ClientSleepTrendsResponse(BaseModel):
    client_id: int
    client_name: str
    preferred_wake_time: Optional[str] = None
    sleep_duration_hours: Optional[int] = None
    sleep_adherence_percentage: float
    average_wake_drift_minutes: float
    total_evaluated_sessions: int
    wake_up_log: List[SleepLogItem]
