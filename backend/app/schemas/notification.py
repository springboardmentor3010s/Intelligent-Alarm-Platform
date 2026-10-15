from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class AnnouncementCreate(BaseModel):
    title: str
    message: str
    priority: str = "info"  # info, warning, urgent
    is_active: bool = True


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    priority: Optional[str] = None
    is_active: Optional[bool] = None


class AnnouncementResponse(BaseModel):
    id: int
    title: str
    message: str
    priority: str
    is_active: bool
    created_at: datetime
    created_by: int


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    category: str  # bedtime, wake_advance, habit, challenge, progress, announcement
    title: str
    message: str
    priority: str
    is_read: bool
    created_at: datetime


class NotificationPreferences(BaseModel):
    bedtime_reminders_enabled: bool = True
    advance_wake_reminders_enabled: bool = True
    advance_reminder_minutes: int = 15
    habit_alerts_enabled: bool = True
    challenge_reminders_enabled: bool = True
    progress_notifications_enabled: bool = True


class NotificationSummaryResponse(BaseModel):
    notifications: List[NotificationResponse] = []
    announcements: List[AnnouncementResponse] = []
    unread_count: int = 0
    bedtime_reminder: Optional[Dict[str, Any]] = None
    advance_wake_reminders: List[Dict[str, Any]] = []
    habit_alerts: List[Dict[str, Any]] = []
    challenge_reminders: List[Dict[str, Any]] = []
    progress_notifications: List[Dict[str, Any]] = []
