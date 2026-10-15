from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class DailyPerformance(BaseModel):
    date: str
    total_sessions: int
    completed_sessions: int
    correct_answers: int
    wrong_answers: int
    accuracy: float


class ChallengePerformance(BaseModel):
    challenge_type: str
    total: int
    correct: int
    wrong: int
    accuracy: float


# =====================================================================
# MILESTONE 4 — PHASE 2 SCHEMAS
# =====================================================================

class WakeUpSessionItem(BaseModel):
    session_id: int
    date: str
    alarm_name: str
    alarm_time: str
    actual_wake_time: str
    response_time_seconds: float
    session_status: str
    dismissal_status: str


class DifficultyPerformanceItem(BaseModel):
    difficulty: str
    total: int
    correct: int
    wrong: int
    accuracy: float


class SnoozeDailyItem(BaseModel):
    date: str
    snooze_count: int
    sessions_count: int


class SnoozeAnalyticsResponse(BaseModel):
    total_snoozes: int
    average_snooze_count: float
    sessions_with_snooze: int
    sessions_without_snooze: int
    snooze_rate: float
    snooze_history: List[SnoozeDailyItem]


class SleepAdherenceResponse(BaseModel):
    preferred_wake_time: str
    sleep_duration: str
    sleep_schedule_adherence: float
    schedule_alignment: str
    is_configured: bool


# =====================================================================
# MILESTONE 3 SCHEMAS
# =====================================================================
# MILESTONE 3 SCHEMAS (WITH ML PRIMARY EXTENSIONS)
# =====================================================================

class HabitScoreResponse(BaseModel):
    overall_habit_score: float
    wake_up_consistency: float
    challenge_completion: float
    snooze_reduction: float
    sleep_schedule_adherence: float
    total_sessions: int
    avg_snooze_count: float
    # ML Behavioral Intelligence Extensions
    ml_behavioral_score: Optional[float] = None
    prediction_source: Optional[str] = "rule_based_fallback"
    confidence_note: Optional[str] = None


class RecommendationItem(BaseModel):
    category: str
    title: str
    message: str
    priority: str
    supporting_metric: Optional[Dict[str, Any]] = None
    prediction_source: Optional[str] = "rule_based_fallback"


class RecommendationsResponse(BaseModel):
    recommendations: List[RecommendationItem]
    total: int
    prediction_source: Optional[str] = "rule_based_fallback"


class AdaptiveDifficultyResponse(BaseModel):
    current_difficulty: str
    recommended_difficulty: str
    accuracy: float
    sample_size: int
    adjusted: bool
    reason: str
    # ML Adaptive Tuning Extensions
    action: Optional[str] = None
    prediction_source: Optional[str] = "rule_based_fallback"
    confidence: Optional[float] = None


# =====================================================================
# EXECUTIVE ANALYTICS RESPONSE (COMBINED & BACKWARD-COMPATIBLE)
# =====================================================================

class AnalyticsResponse(BaseModel):
    total_alarms: int
    active_alarms: int

    total_sessions: int
    completed_sessions: int
    correct_answers: int
    wrong_answers: int

    accuracy: float
    progress: float

    daily_performance: List[DailyPerformance]
    challenge_performance: List[ChallengePerformance]

    # Optional Milestone 3 extensions (backwards compatible)
    habit_score: Optional[HabitScoreResponse] = None
    recommended_difficulty: Optional[str] = None

    # Optional Milestone 4 Phase 2 extensions (backwards compatible)
    average_response_time: Optional[float] = 0.0
    successful_dismissals: Optional[int] = 0
    wake_up_history: Optional[List[WakeUpSessionItem]] = None
    difficulty_performance: Optional[List[DifficultyPerformanceItem]] = None
    snooze_analytics: Optional[SnoozeAnalyticsResponse] = None
    sleep_adherence: Optional[SleepAdherenceResponse] = None
    time_range: Optional[str] = "all"