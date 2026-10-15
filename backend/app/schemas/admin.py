from datetime import datetime, time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class AdminUserSummary(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: Optional[datetime] = None


class AdminUserDetail(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: Optional[datetime] = None
    total_alarms: int = 0
    total_sessions: int = 0
    preferred_wake_time: Optional[str] = None
    sleep_duration: Optional[int] = None
    time_zone: Optional[str] = None
    difficulty_preference: Optional[str] = None
    wake_up_goal: Optional[str] = None
    productivity_goals: Optional[str] = None


class AdminUsersResponse(BaseModel):
    users: List[AdminUserSummary]


class AdminStatsResponse(BaseModel):
    total_users: int
    total_admins: int
    total_coaches: int
    total_regular_users: int
    total_alarms: int
    active_alarms: int
    total_sessions: int
    completed_sessions: int


class AdminAnalyticsResponse(BaseModel):
    total_users: int
    total_coaches: int
    total_alarms: int
    active_alarms: int
    total_sessions: int
    completed_sessions: int
    correct_answers: int
    wrong_answers: int
    accuracy: float
    completion_rate: float


class AdminSessionItem(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    alarm_id: int
    alarm_name: Optional[str] = None
    challenge_id: Optional[int] = None
    challenge_type: Optional[str] = None
    user_answer: Optional[str] = None
    is_correct: Optional[bool] = None
    session_status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None


class AdminSessionsResponse(BaseModel):
    sessions: List[AdminSessionItem]
    total: int


class AdminMLMonitoringResponse(BaseModel):
    model_status: Dict[str, Any]
    platform_ml_adoption: Dict[str, Any]
    recommendation_activity: Dict[str, Any]


class AdminSystemReportSummary(BaseModel):
    generated_at: str
    platform_overview: Dict[str, Any]
    challenge_breakdown: Dict[str, Any]
    difficulty_breakdown: Dict[str, Any]
    ml_system_health: Dict[str, Any]
    data_safety_certification: str
