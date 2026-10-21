from database import SessionLocal
from Models.user import User
from Models.alarm import Alarm
from Models.habit import Habit
from Models.analytics import BehaviorProfile
from Models.challenge import Challenge, ChallengeAttempt, WakeUpEvent

db = SessionLocal()

user = db.query(User).filter_by(email="Gagan2@gmail.com").first()
print(f"User: ID={user.id}, Name={user.name}, Email={user.email}")

alarms = db.query(Alarm).filter_by(user_id=user.id).all()
active_alarms = [a for a in alarms if a.is_active]
print(f"Total alarms in PG: {len(alarms)}, Active alarms: {len(active_alarms)}")
for a in active_alarms:
    print(f"  Alarm #{a.id}: {a.time} - {a.title} (Challenge: {a.challenge_type}, Diff: {a.difficulty})")

habits = db.query(Habit).filter_by(user_id=user.id).all()
completed_habits = [h for h in habits if h.completed]
print(f"Total habits in PG: {len(habits)}, Completed habits: {len(completed_habits)}")
for h in habits:
    print(f"  Habit #{h.id}: {h.name} (category: {h.category}, completed: {h.completed})")

# Challenges stats for Gagan2
user_challenges = db.query(Challenge).filter_by(user_id=user.id).all()
completed_ch = [c for c in user_challenges if c.status == "completed"]
failed_ch = [c for c in user_challenges if c.status == "failed"]
pending_ch = [c for c in user_challenges if c.status == "pending"]
print(f"Challenges: Total={len(user_challenges)}, Completed={len(completed_ch)}, Failed={len(failed_ch)}, Pending={len(pending_ch)}")

# Behavior profiles
profiles = db.query(BehaviorProfile).filter_by(user_id=user.id).order_by(BehaviorProfile.date.desc()).all()
print(f"Behavior profiles in PG: {len(profiles)}")
if profiles:
    latest = profiles[0]
    print(f"  Latest profile ({latest.date}): Habit Score={latest.habit_score}, Wake consistency={latest.wake_up_consistency_score}, Challenge completion rate={latest.challenge_completion_rate}, Snoozes={latest.snooze_count}")

# Wake up events
events = db.query(WakeUpEvent).filter_by(user_id=user.id).order_by(WakeUpEvent.started_at.desc()).all()
print(f"Wake-up events in PG: {len(events)}")
if events:
    print(f"  Latest event: ID={events[0].id}, started={events[0].started_at}, status={events[0].status}, snoozes={events[0].snoozes}")

db.close()
