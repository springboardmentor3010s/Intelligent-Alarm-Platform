import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

from datetime import date, datetime, timedelta
import numpy as np
import torch
import sys
from sqlalchemy.orm import Session

from Models.analytics import BehaviorProfile, Recommendation, SleepLog
from Models.user import UserProfile
from Models.habit import Habit

# Load PyTorch model definition
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from ml.train_pytorch_rec import RecommendationNet, CHALLENGE_TYPES

def load_pytorch_model():
    model_path = os.path.join(os.path.dirname(__file__), '..', 'ml', 'pytorch_rec_model.pth')
    model = RecommendationNet(input_size=6, hidden_size=32, num_classes=7)
    if os.path.exists(model_path):
        model.load_state_dict(torch.load(model_path, weights_only=True))
    model.eval()
    return model

# Cache the model globally for production performance
MODEL = load_pytorch_model()

def predict_challenge(profile, trend_label):
    model = MODEL
    
    # Map trend to int
    trend_map = {"Declining": -1, "Stable": 0, "Improving": 1}
    trend_val = trend_map.get(trend_label, 0)
    
    # Features: [habit_score, wake_up_score, challenge_rate, snooze_count, sleep_score, trend]
    features = np.array([
        profile.habit_score,
        profile.wake_up_consistency_score,
        profile.challenge_completion_rate,
        profile.snooze_count,
        profile.sleep_adherence_score,
        trend_val
    ], dtype=np.float32)
    
    tensor_features = torch.from_numpy(features).unsqueeze(0)
    with torch.no_grad():
        outputs = model(tensor_features)
        _, predicted = torch.max(outputs, 1)
        
    return CHALLENGE_TYPES[predicted.item()]

def build_user_recommendations(user_id: int, profile: BehaviorProfile, db: Session) -> dict:
    """
    Evaluates a user's BehaviorProfile, habits, sleep logs, and user profile
    against heuristic rules and the PyTorch neural network model.
    """
    from services.analytics import analyze_behavior_trend

    today = date.today()

    # 1. Trend from LSTM
    trend_result = analyze_behavior_trend(user_id, db)
    trend_label = trend_result["trend"]

    # 2. PyTorch model prediction
    best_challenge = predict_challenge(profile, trend_label)

    # ------------------------------------------------------------------
    # Category 1: Wake-up Optimization
    # ------------------------------------------------------------------
    if profile.wake_up_consistency_score < 15:
        wake_msg = "Your wake-up time is inconsistent. Try setting a strict bedtime alarm to regulate your circadian rhythm."
        wake_pri = "High"
    elif profile.snooze_count > 0:
        wake_msg = f"You snoozed {profile.snooze_count} time(s). Aim for an immediate out-of-bed transition to prevent morning grogginess."
        wake_pri = "Medium"
    elif profile.wake_up_consistency_score >= 30:
        wake_msg = "Excellent wake-up consistency! Keep up the great morning routine."
        wake_pri = "Low"
    else:
        wake_msg = "Maintain your wake-up window within 10 minutes of your alarm to solidify your circadian rhythm."
        wake_pri = "Medium"

    # ------------------------------------------------------------------
    # Category 2: Sleep Improvement
    # ------------------------------------------------------------------
    # Check valid sleep logs for the user in the requested period (last 7 days)
    recent_sleep_logs = db.query(SleepLog).filter(
        SleepLog.user_id == user_id,
        SleepLog.date >= today - timedelta(days=7)
    ).all()

    valid_sleep_logs = [
        s for s in recent_sleep_logs
        if s.actual_sleep_time and s.actual_wake_time
    ]

    if not valid_sleep_logs:
        # Crucial fix: Do not claim the user missed their sleep target without supporting records!
        sleep_msg = "No sleep logs recorded for this period. Log your bedtime and wake-up times to receive personalized sleep insights."
        sleep_pri = "Low"
    else:
        durations = []
        for s in valid_sleep_logs:
            try:
                t_sleep = datetime.strptime(s.actual_sleep_time, "%H:%M")
                t_wake = datetime.strptime(s.actual_wake_time, "%H:%M")
                dur = (t_wake - t_sleep).total_seconds() / 3600.0
                if dur <= 0:
                    dur += 24.0
                durations.append(dur)
            except Exception:
                pass

        avg_dur = sum(durations) / len(durations) if durations else 0
        user_prof = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        target_dur = user_prof.sleep_duration if user_prof and user_prof.sleep_duration else 7.5

        if profile.snooze_count >= 2:
            sleep_msg = "You've been relying on the snooze button. Try moving your phone across the room to encourage waking up immediately."
            sleep_pri = "High"
        elif avg_dur > 0 and avg_dur < (target_dur - 0.5):
            sleep_msg = f"Your average sleep duration ({avg_dur:.1f}h) is below your target of {target_dur:.1f}h. Focus on winding down earlier tonight."
            sleep_pri = "Medium"
        else:
            sleep_msg = f"Great sleep schedule! You are meeting your target of {target_dur:.1f} hours of rest."
            sleep_pri = "Low"

    # ------------------------------------------------------------------
    # Category 3: Habit Improvement
    # ------------------------------------------------------------------
    user_habits = db.query(Habit).filter(Habit.user_id == user_id).all()
    if not user_habits:
        habit_msg = "You haven't set any daily habits yet. Add habits in the Habit Manager to track your daily progress."
        habit_pri = "Medium"
    else:
        pending_habits = [h for h in user_habits if not h.completed]
        if pending_habits:
            pending_names = [h.name for h in pending_habits[:2]]
            habit_msg = f"You have {len(pending_habits)} pending habit(s) today: {', '.join(pending_names)}. Focus on checking them off before the day ends."
            habit_pri = "Medium"
        else:
            habit_msg = "All daily habits completed! Fantastic discipline maintaining your daily routines."
            habit_pri = "Low"

    # ------------------------------------------------------------------
    # Category 4: Productivity
    # ------------------------------------------------------------------
    user_prof = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    goals = user_prof.productivity_goals if user_prof and user_prof.productivity_goals else None

    if goals:
        if profile.habit_score >= 85:
            prod_msg = f"High morning momentum! Channel this energy into your productivity goals: {goals}."
            prod_pri = "Low"
        else:
            prod_msg = f"To support your goals ({goals}), establish a consistent morning focus block right after waking."
            prod_pri = "Medium"
    else:
        if profile.habit_score >= 85:
            prod_msg = "Outstanding performance! You are mastering your morning routine and primed for deep focus."
            prod_pri = "Low"
        else:
            prod_msg = "Focus on consistent daily habits. A steady morning routine is the foundation of a productive day."
            prod_pri = "Medium"

    # ------------------------------------------------------------------
    # Category 5: Personalized Challenge
    # ------------------------------------------------------------------
    chall_msg = f"Based on your recent cognitive performance trends, your recommended challenge type is {best_challenge}."
    if profile.challenge_completion_rate < 0.5:
        chall_msg += f" Let's build your confidence with {best_challenge} challenges."
    chall_pri = "Medium"

    # Persist or update in Recommendation table for today
    recs_to_save = [
        ("Wake-up Optimization", wake_msg, wake_pri),
        ("Sleep Improvement", sleep_msg, sleep_pri),
        ("Habit Improvement", habit_msg, habit_pri),
        ("Productivity", prod_msg, prod_pri),
        ("Personalized Challenge", chall_msg, chall_pri),
    ]

    for category, message, priority in recs_to_save:
        add_or_update_recommendation(db, user_id, today, category, message, priority)

    try:
        from services.notification_service import create_notification
        create_notification(
            db=db,
            user_id=user_id,
            title="Personalized Recommendations Ready",
            message="New AI recommendations are available based on your recent habit score and wake-up trend.",
            category="recommendation",
            priority="normal",
            link="/cognitive-analytics",
            prevent_duplicate=True
        )
    except Exception as e:
        print(f"Failed to create recommendation notification: {e}")

    return {
        "wake_up_optimization": wake_msg,
        "sleep_improvement": sleep_msg,
        "habit_improvement": habit_msg,
        "productivity": prod_msg,
        "personalized_challenge": chall_msg
    }

def add_or_update_recommendation(db: Session, user_id: int, today: date, category: str, message: str, priority: str):
    # Check if a similar recommendation was already given today to avoid duplicates
    existing = db.query(Recommendation).filter(
        Recommendation.user_id == user_id,
        Recommendation.date == today,
        Recommendation.category == category
    ).first()
    
    if existing:
        existing.message = message
        existing.priority = priority
    else:
        new_rec = Recommendation(
            user_id=user_id,
            date=today,
            category=category,
            message=message,
            priority=priority
        )
        db.add(new_rec)
    db.commit()

def generate_daily_recommendations(user_id: int, profile: BehaviorProfile, db: Session):
    return build_user_recommendations(user_id, profile, db)

