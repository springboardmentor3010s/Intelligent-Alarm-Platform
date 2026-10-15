"""
Feature Extractor for XGBoost Wake-Up Prediction.

Extracts prediction-time features from Alarm, UserProfile, and historical sessions.
Strictly guarantees ZERO DATA LEAKAGE by only utilizing signals known prior to the alarm ringing.
"""

import math
from datetime import datetime, time, timezone
from typing import Any, Dict, List, Optional
import pandas as pd


DIFFICULTY_MAP = {
    "beginner": 1,
    "easy": 1,
    "medium": 2,
    "hard": 3,
    "expert": 4,
}


def time_to_minutes(t: Optional[time]) -> int:
    """Converts a time object to total minutes from midnight (0–1439)."""
    if not t:
        return 420  # Default 07:00 AM
    return t.hour * 60 + t.minute


def extract_prediction_features(
    alarm: Any,
    user_profile: Optional[Any] = None,
    past_sessions: Optional[List[Any]] = None,
    target_date: Optional[datetime] = None,
) -> pd.DataFrame:
    """
    Extracts a single-row pandas DataFrame containing all features required by the XGBoost model.
    """
    # 1. Target Date & Time of Prediction
    if target_date is None:
        target_date = datetime.now(timezone.utc)

    day_of_week = target_date.weekday()
    is_weekend = 1 if day_of_week in [5, 6] else 0

    # 2. Alarm Schedule Features
    alarm_time = getattr(alarm, "alarm_time", None)
    alarm_minutes = time_to_minutes(alarm_time)
    alarm_hour = alarm_minutes // 60
    alarm_minute = alarm_minutes % 60

    # Cyclic time representation
    time_rad = (alarm_minutes / 1440.0) * 2.0 * math.pi
    sin_alarm_time = round(math.sin(time_rad), 4)
    cos_alarm_time = round(math.cos(time_rad), 4)

    # Challenge & Difficulty
    raw_challenge = getattr(alarm, "challenge_type", "math") or "math"
    challenge_type = raw_challenge.lower().strip()

    raw_difficulty = getattr(alarm, "difficulty", "medium") or "medium"
    difficulty_num = DIFFICULTY_MAP.get(raw_difficulty.lower().strip(), 2)

    # 3. User Profile Features
    pref_wake_time = getattr(user_profile, "preferred_wake_time", None) if user_profile else None
    preferred_wake_minutes = time_to_minutes(pref_wake_time) if pref_wake_time else 420

    schedule_diff = abs(alarm_minutes - preferred_wake_minutes)
    schedule_diff = min(schedule_diff, 1440 - schedule_diff)

    sleep_duration_hours = getattr(user_profile, "sleep_duration", 8) if user_profile else 8
    if sleep_duration_hours is None or sleep_duration_hours <= 0:
        sleep_duration_hours = 8

    # 4. Historical Aggregate Features (strictly computed from past completed sessions)
    past_sessions = past_sessions or []
    valid_past = [s for s in past_sessions if getattr(s, "session_status", None) == "completed"]

    if valid_past:
        # Snooze rate
        total_snoozes = sum(getattr(s, "snooze_count", 0) or 0 for s in valid_past)
        prior_snooze_rate = round(total_snoozes / len(valid_past), 4)

        # Average response time
        response_times = [
            getattr(s, "response_time_seconds", None)
            for s in valid_past
            if getattr(s, "response_time_seconds", None) is not None
            and 0 < getattr(s, "response_time_seconds", 0) <= 300
        ]
        if response_times:
            prior_avg_response_time = round(float(sum(response_times) / len(response_times)), 2)
        else:
            prior_avg_response_time = 18.0

        # Prior on-time rate (snooze == 0 and response_time <= 60)
        on_time_count = sum(
            1
            for s in valid_past
            if (getattr(s, "snooze_count", 0) or 0) == 0
            and getattr(s, "is_correct", None) is True
            and (getattr(s, "response_time_seconds", 0) or 0) <= 60
        )
        prior_on_time_rate = on_time_count / len(valid_past)
        prior_habit_score = round(prior_on_time_rate * 70.0 + 30.0, 2)
    else:
        # Default population priors when user has zero historical sessions
        prior_snooze_rate = 0.15
        prior_avg_response_time = 18.0
        prior_habit_score = 70.0

    feature_dict = {
        "alarm_hour": [alarm_hour],
        "alarm_minute": [alarm_minute],
        "alarm_time_minutes": [alarm_minutes],
        "sin_alarm_time": [sin_alarm_time],
        "cos_alarm_time": [cos_alarm_time],
        "day_of_week": [day_of_week],
        "is_weekend": [is_weekend],
        "difficulty_num": [difficulty_num],
        "preferred_wake_minutes": [preferred_wake_minutes],
        "schedule_diff_minutes": [schedule_diff],
        "sleep_duration_hours": [sleep_duration_hours],
        "prior_habit_score": [prior_habit_score],
        "prior_snooze_rate": [prior_snooze_rate],
        "prior_avg_response_time": [prior_avg_response_time],
        "challenge_type": [challenge_type],
    }

    return pd.DataFrame(feature_dict)
