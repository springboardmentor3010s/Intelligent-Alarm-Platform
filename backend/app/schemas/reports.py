from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class HabitReportData(BaseModel):
    overall_habit_score: float
    wake_up_consistency: float
    challenge_completion: float
    snooze_reduction: float
    sleep_schedule_adherence: float
    sessions_evaluated: int
    average_snooze_count: float


class WakeUpReportData(BaseModel):
    total_sessions: int
    wake_up_consistency: float
    average_response_time: float
    successful_dismissals: int
    total_snoozes: int
    status_breakdown: Dict[str, int]


class ChallengeTypeItem(BaseModel):
    challenge_type: str
    total: int
    correct: int
    incorrect: int
    accuracy: float


class DifficultyLevelItem(BaseModel):
    difficulty: str
    total: int
    correct: int
    incorrect: int
    accuracy: float


class ChallengeReportData(BaseModel):
    total_challenges: int
    completed_challenges: int
    correct_answers: int
    incorrect_answers: int
    completion_percentage: float
    accuracy_percentage: float
    challenge_types: List[ChallengeTypeItem]
    difficulty_levels: List[DifficultyLevelItem]
    average_response_time: float


class SleepAdherenceReportData(BaseModel):
    preferred_wake_time: str
    sleep_duration: str
    sleep_schedule_adherence: float
    schedule_alignment: str
    has_profile_data: bool


class ProductivityReportData(BaseModel):
    has_productivity_data: bool
    productivity_goals: Optional[str] = None
    status: str
    message: str


class ReportSummaryResponse(BaseModel):
    user_name: str
    user_email: str
    generated_at: str
    is_demo: bool = False
    habit_report: HabitReportData
    wake_up_report: WakeUpReportData
    challenge_report: ChallengeReportData
    sleep_adherence_report: SleepAdherenceReportData
    productivity_report: ProductivityReportData
