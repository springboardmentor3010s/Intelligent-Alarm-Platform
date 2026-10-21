import sys
from database import SessionLocal
from Models.user import User
from Models.alarm import Alarm
from Models.habit import Habit
from Models.analytics import BehaviorProfile
from Models.challenge import Challenge, ChallengeAttempt, WakeUpEvent
from routers.analytics import get_analytics_dashboard
from routers.challenges import get_analytics, get_history

db = SessionLocal()
user = db.query(User).filter_by(email="Gagan2@gmail.com").first()
print(f"User found: {user.id}, {user.name}, {user.email}, role={user.role}")

user_dict = {"user_id": user.id, "email": user.email, "role": user.role}

print("\n--- HABITS ---")
habits = db.query(Habit).filter_by(user_id=user.id).all()
print(f"Habits count: {len(habits)}")
for h in habits:
    print(f"  Habit #{h.id}: {h.name}, completed={h.completed}, category={h.category}")

print("\n--- ALARMS ---")
alarms = db.query(Alarm).filter_by(user_id=user.id).all()
print(f"Alarms count: {len(alarms)}")
for a in alarms:
    print(f"  Alarm #{a.id}: time={a.time}, title={a.title}, active={a.is_active}, challenge={a.challenge_type}")

print("\n--- CHALLENGES STATS ---")
stats = get_analytics(current_user=user_dict, db=db)
print("Challenge stats:", stats)

print("\n--- CHALLENGE HISTORY ALL ---")
hist = get_history(current_user=user_dict, db=db)
print(f"History count: {len(hist)}")

print("\n--- ANALYTICS DASHBOARD ---")
dash = get_analytics_dashboard(current_user=user_dict, db=db)
print("Current profile:", dash.get("current"))
if dash.get("current"):
    cp = dash["current"]
    print(f"  date={cp.date}, habit_score={cp.habit_score}, wake_score={cp.wake_up_consistency_score}, challenge_rate={cp.challenge_completion_rate}, snoozes={cp.snooze_count}")
print(f"History profiles count: {len(dash.get('history', []))}")
print(f"Events count: {len(dash.get('events', []))}")
print(f"Sleep logs count: {len(dash.get('sleep_logs', []))}")
print(f"Behavior trend: {dash.get('behavior_trend')}")
print(f"Current difficulty: {dash.get('current_difficulty')}")

db.close()
