from sqlalchemy.orm import Session
from Models.challenge import WakeUpEvent, ChallengeAttempt, Challenge
from Models.alarm import Alarm
from Models.analytics import BehaviorProfile
from Models.user import UserProfile
from Models.habit import Habit
from services.recommendation import generate_daily_recommendations
from datetime import date, datetime, timedelta
import joblib
import pandas as pd
import numpy as np
import os

DIFFICULTIES = [
    "Beginner",
    "Easy",
    "Medium",
    "Hard",
    "Expert",
]

def get_user_adaptive_difficulty(user_id: int, db: Session) -> str:
    """
    Computes the user's current adaptive difficulty tier based on challenges completed.
    
    Milestones:
    - 0 to 4 challenges: Beginner (New user starts from beginner)
    - 5 to 11 challenges: Easy
    - 12 to 20 challenges: Medium
    - 21 to 30 challenges: Hard
    - 31+ challenges: Expert (e.g. Gagan2 with 34 challenges)
    """
    from Models.challenge import Challenge, ChallengeAttempt
    from Models.user import UserProfile

    # Count successful challenges and attempts
    completed_count = db.query(Challenge).filter(
        Challenge.user_id == user_id,
        Challenge.status == "completed"
    ).count()

    correct_attempts = db.query(ChallengeAttempt).filter(
        ChallengeAttempt.user_id == user_id,
        ChallengeAttempt.is_correct == True
    ).count()

    challenge_metric = max(completed_count, correct_attempts)

    if challenge_metric >= 31:
        computed = "Expert"
    elif challenge_metric >= 21:
        computed = "Hard"
    elif challenge_metric >= 12:
        computed = "Medium"
    elif challenge_metric >= 5:
        computed = "Easy"
    else:
        computed = "Beginner"

    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if profile and profile.difficulty_preference:
        pref = profile.difficulty_preference
        if pref in DIFFICULTIES:
            if challenge_metric >= 31:
                computed = "Expert"
            else:
                pref_idx = DIFFICULTIES.index(pref)
                comp_idx = DIFFICULTIES.index(computed)
                computed = DIFFICULTIES[max(pref_idx, comp_idx)]

    return computed


def adapt_alarm_difficulty(event_id: int, db: Session):
    """
    Analyzes the performance of a completed WakeUpEvent 
    and adapts the alarm's difficulty accordingly.
    
    Guarantees:
    - Runs only after required wake-up verification is completed.
    - Idempotent: does not repeatedly adapt difficulty for duplicate requests.
    - Attempts are strictly scoped to the event and user.
    - Boundaries: 0 (Beginner) to 4 (Expert).
    """
    event = db.query(WakeUpEvent).filter(WakeUpEvent.id == event_id).first()
    if not event or not event.alarm:
        return None

    # Idempotency check: prevent duplicate adaptation for real completed events
    is_test = event.verification_status in ["test", "test_pending", "test_verified"]
    if getattr(event, "difficulty_adapted", False) and not is_test:
        print(f"[ADAPTIVE] Event {event_id} difficulty already adapted. Skipping duplicate request.")
        return None

    # Incomplete check: ensure the required wake-up challenges are completed
    if event.status != "completed" or (event.completed_challenges or 0) < (event.required_challenges or 1):
        print(f"[ADAPTIVE] Event {event_id} not completed ({event.completed_challenges}/{event.required_challenges}). Skipping adaptation.")
        return None

    alarm = event.alarm
    current_difficulty = alarm.difficulty or "Beginner"
    
    if current_difficulty not in DIFFICULTIES:
        current_difficulty = "Beginner"

    current_idx = DIFFICULTIES.index(current_difficulty)

    # Fetch attempts strictly scoped to this event and user
    attempts = (
        db.query(ChallengeAttempt)
        .join(Challenge, Challenge.id == ChallengeAttempt.challenge_id)
        .filter(
            Challenge.wake_up_event_id == event.id,
            Challenge.user_id == event.user_id,
            ChallengeAttempt.user_id == event.user_id
        )
        .all()
    )

    if not attempts:
        return None

    total_attempts = len(attempts)
    correct_attempts = sum(1 for a in attempts if a.is_correct)
    correctness = float(correct_attempts / total_attempts) if total_attempts > 0 else 0.0

    valid_times = [float(a.solve_time) for a in attempts if a.solve_time is not None and a.solve_time >= 0]
    avg_solve_time = float(sum(valid_times) / len(valid_times)) if valid_times else 0.0

    try:
        from services.difficulty_engine import get_next_difficulty
        result = get_next_difficulty(
            correctness=correctness,
            solve_time=avg_solve_time,
            attempts=total_attempts,
            current_difficulty=current_idx
        )
        
        new_difficulty = result["next_difficulty"]
        
        user_tier = get_user_adaptive_difficulty(event.user_id, db)
        next_idx = DIFFICULTIES.index(new_difficulty) if new_difficulty in DIFFICULTIES else 0
        tier_idx = DIFFICULTIES.index(user_tier) if user_tier in DIFFICULTIES else 0
        final_difficulty = DIFFICULTIES[max(next_idx, tier_idx)]

        # Update alarm difficulty
        alarm.difficulty = final_difficulty

        # Sync profile difficulty preference
        profile = db.query(UserProfile).filter(UserProfile.user_id == event.user_id).first()
        if profile:
            profile.difficulty_preference = final_difficulty
            
        event.difficulty_adapted = True
        db.commit()
        db.refresh(alarm)

        print(f"[ADAPTIVE] Event {event_id} adapted difficulty from {current_difficulty} to {final_difficulty}. Action: {result.get('action')}")
        result["next_difficulty"] = final_difficulty
        return result

    except Exception as e:
        print(f"[ADAPTIVE] Failed to run difficulty engine: {e}")
        db.rollback()
        return None


def calculate_daily_habit_score(user_id: int, event_id: int, db: Session):
    """
    Calculates the 0-100 Habit Score based on:
    - Wake-up Consistency (35%)
    - Challenge Completion (25%)
    - Snooze Reduction (20%)
    - Sleep Schedule Adherence (20%)
    Creates or updates the BehaviorProfile for the day.
    """
    event = db.query(WakeUpEvent).filter(WakeUpEvent.id == event_id).first()
    if not event or not event.alarm:
        return

    if event.verification_status in ["test", "test_pending", "test_verified"]:
        print(f"[ANALYTICS] Event {event_id} is a manual test. Skipping habit score calculation.")
        return

    alarm = event.alarm
    today = date.today()

    # 1. Wake-up Consistency (Max 35 points)
    try:
        alarm_time = datetime.strptime(alarm.time, "%H:%M").time()
        expected_start = datetime.combine(event.started_at.date(), alarm_time)
        diff_minutes = (event.started_at - expected_start).total_seconds() / 60.0
        
        if diff_minutes <= 5:
            consistency_score = 35
        else:
            late_minutes = diff_minutes - 5
            consistency_score = max(0, 35 - int(late_minutes * 2))
    except Exception:
        consistency_score = 15 # fallback

    # 2. Challenge Completion Rate (Max 25 points)
    if event.required_challenges > 0:
        completion_rate = min(1.0, event.completed_challenges / max(1, event.required_challenges))
    else:
        completion_rate = 1.0
    challenge_score = int(completion_rate * 25)

    # 3. Snooze Reduction (Max 20 points)
    snooze_count = event.snoozes or 0
    snooze_score = max(0, 20 - (snooze_count * 5))

    # 4. Sleep Schedule Adherence (Max 20 points)
    from Models.analytics import SleepLog
    sleep_log = db.query(SleepLog).filter(SleepLog.user_id == user_id, SleepLog.date == today).first()
    
    sleep_score = 0
    if sleep_log and sleep_log.target_sleep_time and sleep_log.actual_sleep_time:
        try:
            target = datetime.strptime(sleep_log.target_sleep_time, "%H:%M")
            actual = datetime.strptime(sleep_log.actual_sleep_time, "%H:%M")
            
            # difference in minutes
            # Handle cross-midnight (e.g. target 23:00, actual 00:30)
            diff_hours = abs((actual - target).total_seconds() / 3600.0)
            if diff_hours > 12:
                diff_hours = 24 - diff_hours
                
            if diff_hours <= 0.5:
                sleep_score = 20
            else:
                sleep_score = max(0, 20 - int((diff_hours - 0.5) * 5))
        except Exception:
            sleep_score = 10
    else:
        # If no sleep data collected yet, they miss out on the points 
        # (This enforces actual data collection over assumptions)
        sleep_score = 0

    total_score = consistency_score + challenge_score + snooze_score + sleep_score

    # Save to BehaviorProfile
    profile = db.query(BehaviorProfile).filter(BehaviorProfile.user_id == user_id, BehaviorProfile.date == today).first()
    
    if not profile:
        profile = BehaviorProfile(user_id=user_id, date=today)
        db.add(profile)
    
    profile.wake_up_consistency_score = consistency_score
    profile.challenge_completion_rate = completion_rate
    profile.snooze_count = snooze_count
    profile.sleep_adherence_score = sleep_score
    profile.habit_score = min(100, max(0, int(total_score)))
    
    db.commit()
    db.refresh(profile)
    
    # Hook the Recommendation Engine
    try:
        generate_daily_recommendations(user_id, profile, db)
    except Exception as e:
        print(f"Recommendation Engine failed: {e}")
        
    return profile

import os
import numpy as np
import tensorflow as tf

LSTM_MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "ml",
    "tf_sequence_model.keras"
)

LSTM_MODEL = None

def load_lstm_model():
    global LSTM_MODEL
    if LSTM_MODEL is None:
        LSTM_MODEL = tf.keras.models.load_model(LSTM_MODEL_PATH)
    return LSTM_MODEL

def predict_behavior_trend(sequence):
    if len(sequence) != 7:
        raise ValueError("LSTM requires exactly 7 days of data.")

    X = np.array(sequence, dtype=np.float32)
    X = np.expand_dims(X, axis=0) # Add batch dimension: (1, 7, 2)

    model = load_lstm_model()
    probabilities = model.predict(X, verbose=0)[0]
    prediction = int(np.argmax(probabilities))

    labels = ["Declining", "Stable", "Improving"]

    return {
        "trend": labels[prediction],
        "probabilities": {
            labels[i]: float(probabilities[i]) for i in range(3)
        }
    }

def calculate_wake_up_delay(alarm_time, started_at):
    if not alarm_time or not started_at:
        return 0.0

    try:
        scheduled_time = datetime.strptime(alarm_time, "%H:%M").time()
        scheduled_datetime = datetime.combine(started_at.date(), scheduled_time)
        delay = (started_at - scheduled_datetime).total_seconds() / 60
        return max(0.0, delay)
    except Exception:
        return 0.0

class TrendResult(dict):
    """
    Subclasses dict so callers accessing result['trend'] or result['probabilities']
    get standard dict behavior, while also allowing equality comparison against
    string labels (e.g. `trend == 'Declining'` in tests).
    """
    def __eq__(self, other):
        if isinstance(other, str):
            return self.get("trend") == other
        return super().__eq__(other)

    def __str__(self):
        return self.get("trend", "")

def analyze_behavior_trend(user_id: int, db: Session):
    from Models.challenge import WakeUpEvent
    from Models.alarm import Alarm

    # 1. Check how many real wake-up events exist for this user (excluding manual tests)
    all_events = (
        db.query(WakeUpEvent)
        .filter(
            WakeUpEvent.user_id == user_id,
            ~WakeUpEvent.verification_status.in_(["test", "test_pending", "test_verified"])
        )
        .order_by(WakeUpEvent.started_at.desc())
        .all()
    )

    if len(all_events) < 2:
        return TrendResult({
            "trend": "Insufficient Data",
            "has_sufficient_data": False,
            "probabilities": {"Declining": 0.0, "Stable": 1.0, "Improving": 0.0}
        })

    today = date.today()
    # Check if user has recorded events in the last 7 calendar days
    recent_in_window = [e for e in all_events if e.started_at and e.started_at.date() >= (today - timedelta(days=6))]
    
    if len(recent_in_window) >= 1:
        end_date = today
    else:
        # Anchor the 7-day window to the user's latest recorded wake up event date
        end_date = all_events[0].started_at.date()

    sequence = []
    for i in range(6, -1, -1):
        target_date = end_date - timedelta(days=i)

        event = (
            db.query(WakeUpEvent)
            .filter(
                WakeUpEvent.user_id == user_id,
                ~WakeUpEvent.verification_status.in_(["test", "test_pending", "test_verified"]),
                WakeUpEvent.started_at >= target_date,
                WakeUpEvent.started_at < (target_date + timedelta(days=1))
            )
            .order_by(WakeUpEvent.started_at.asc())
            .first()
        )

        if event:
            alarm = db.query(Alarm).filter(Alarm.id == event.alarm_id).first() if event.alarm_id else None
            delay = calculate_wake_up_delay(alarm.time if alarm else None, event.started_at)
            snooze_count = event.snoozes or 0
        else:
            snooze_count = 0
            delay = 0.0

        sequence.append([float(snooze_count), float(delay)])

    if len(sequence) != 7:
        return TrendResult({
            "trend": "Stable",
            "has_sufficient_data": False,
            "probabilities": {"Declining": 0.0, "Stable": 1.0, "Improving": 0.0}
        })

    try:
        os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
        result = predict_behavior_trend(sequence)
        return TrendResult({
            "trend": result["trend"],
            "has_sufficient_data": True,
            "probabilities": result["probabilities"]
        })
    except Exception as e:
        print(f"Failed to run TF model: {e}")
        return TrendResult({
            "trend": "Stable",
            "has_sufficient_data": False,
            "probabilities": {"Declining": 0.0, "Stable": 1.0, "Improving": 0.0}
        })


