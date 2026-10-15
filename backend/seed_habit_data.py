"""
Seeds ~14 days of realistic wake-up / challenge history for a demo user so the
Habit Score, Behavioral Analytics, and Recommendation Engine have enough real
data to exercise against the actual configured database (see backend/.env).

Run (after alembic upgrade head):
    cd backend
    venv\\Scripts\\activate
    python seed_habit_data.py

Credentials:
    Email:    demo@cognitivealarm.com
    Password: Demo@1234

Safe to re-run — clears and re-seeds only this demo user's alarm/session/challenge
history each time (does not touch other users).
"""
import sys
sys.path.insert(0, ".")

from datetime import datetime, timedelta

from app.db.database import SessionLocal, Base, engine
from app.models.models import User, UserProfile, Alarm, WakeUpSession, CognitiveChallenge
from app.core.security import hash_password

Base.metadata.create_all(bind=engine)

DEMO_EMAIL = "demo@cognitivealarm.com"
DEMO_PASSWORD = "Demo@1234"
PREFERRED_WAKE_TIME = "07:00"
DAYS_OF_HISTORY = 14

# (days_ago_offset_applies_per_loop) — each entry describes one simulated morning
# verified_minute_offset: minutes after 07:00 the user actually verified (None = never verified)
# attempts/failed_attempts: verification struggle; is_correct/attempts/score: challenge outcome
DAY_PROFILES = [
    # Good week: on-time, first-try correct
    {"verified_offset": 5,  "failed_attempts": 0, "challenge_attempts": 1, "is_correct": True,  "score": 95, "response_s": 12},
    {"verified_offset": 8,  "failed_attempts": 0, "challenge_attempts": 1, "is_correct": True,  "score": 90, "response_s": 15},
    {"verified_offset": -3, "failed_attempts": 0, "challenge_attempts": 1, "is_correct": True,  "score": 92, "response_s": 10},
    {"verified_offset": 10, "failed_attempts": 1, "challenge_attempts": 2, "is_correct": True,  "score": 80, "response_s": 20},
    # Rough patch: late, snoozed, wrong answers
    {"verified_offset": None, "failed_attempts": 3, "challenge_attempts": 3, "is_correct": False, "score": 30, "response_s": 70},
    {"verified_offset": 75,   "failed_attempts": 3, "challenge_attempts": 3, "is_correct": False, "score": 25, "response_s": 85},
    {"verified_offset": None, "failed_attempts": 2, "challenge_attempts": 2, "is_correct": False, "score": 35, "response_s": 65},
    # Recovering: a bit late, mixed results
    {"verified_offset": 25, "failed_attempts": 1, "challenge_attempts": 2, "is_correct": True,  "score": 60, "response_s": 40},
    {"verified_offset": 30, "failed_attempts": 1, "challenge_attempts": 2, "is_correct": False, "score": 50, "response_s": 45},
    {"verified_offset": 20, "failed_attempts": 1, "challenge_attempts": 1, "is_correct": True,  "score": 70, "response_s": 30},
    # Back to good
    {"verified_offset": 2,  "failed_attempts": 0, "challenge_attempts": 1, "is_correct": True,  "score": 98, "response_s": 8},
    {"verified_offset": 6,  "failed_attempts": 0, "challenge_attempts": 1, "is_correct": True,  "score": 94, "response_s": 11},
    {"verified_offset": -5, "failed_attempts": 0, "challenge_attempts": 1, "is_correct": True,  "score": 96, "response_s": 9},
    {"verified_offset": 12, "failed_attempts": 0, "challenge_attempts": 1, "is_correct": True,  "score": 88, "response_s": 18},
]
assert len(DAY_PROFILES) == DAYS_OF_HISTORY

db = SessionLocal()
try:
    user = db.query(User).filter(User.email == DEMO_EMAIL).first()
    if not user:
        user = User(
            name="Demo User",
            email=DEMO_EMAIL,
            password_hash=hash_password(DEMO_PASSWORD),
            role="USER",
        )
        db.add(user)
        db.flush()
        db.add(UserProfile(user_id=user.id, preferred_wake_up_time=PREFERRED_WAKE_TIME))
        db.flush()
        print(f"Created demo user: {DEMO_EMAIL}")
    else:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        if profile:
            profile.preferred_wake_up_time = PREFERRED_WAKE_TIME
        print(f"Reusing existing demo user: {DEMO_EMAIL}")

    # Clear prior demo history so re-running this script gives a clean, current window
    old_alarms = db.query(Alarm).filter(Alarm.user_id == user.id).all()
    old_alarm_ids = [a.id for a in old_alarms]
    if old_alarm_ids:
        db.query(CognitiveChallenge).filter(CognitiveChallenge.alarm_id.in_(old_alarm_ids)).delete(synchronize_session=False)
        db.query(WakeUpSession).filter(WakeUpSession.alarm_id.in_(old_alarm_ids)).delete(synchronize_session=False)
        db.query(Alarm).filter(Alarm.id.in_(old_alarm_ids)).delete(synchronize_session=False)
        db.flush()

    alarm = Alarm(
        user_id=user.id, alarm_name="Morning Alarm", alarm_time=PREFERRED_WAKE_TIME,
        challenge_difficulty="MEDIUM", challenge_count=1, challenge_type="random",
    )
    db.add(alarm)
    db.flush()

    ph, pm = map(int, PREFERRED_WAKE_TIME.split(":"))
    # Naive local wall-clock time — these DateTime columns are "timestamp without
    # time zone"; the app's real runtime writes aware datetime.now(timezone.utc)
    # which Postgres converts to the session TimeZone (Asia/Calcutta) on storage,
    # so stored values end up as local wall-clock. Building naive local times
    # here directly reproduces that, instead of drifting by the UTC/IST offset.
    now = datetime.now()

    for i, profile_data in enumerate(DAY_PROFILES):
        day_offset = DAYS_OF_HISTORY - i  # oldest first
        target_day = (now - timedelta(days=day_offset)).replace(hour=ph, minute=pm, second=0, microsecond=0)
        started_at = target_day - timedelta(minutes=2)

        verified_offset = profile_data["verified_offset"]
        if verified_offset is None:
            verified_at = None
            status = "NOT_VERIFIED"
            completed = 0
        else:
            verified_at = target_day + timedelta(minutes=verified_offset)
            status = "WAKE_UP_VERIFIED"
            completed = 1

        db.add(WakeUpSession(
            alarm_id=alarm.id, user_id=user.id,
            status=status, challenges_required=1, challenges_completed=completed,
            total_attempts=profile_data["challenge_attempts"],
            failed_attempts=profile_data["failed_attempts"],
            wakefulness_score=float(profile_data["score"]),
            started_at=started_at, verified_at=verified_at,
        ))

        db.add(CognitiveChallenge(
            alarm_id=alarm.id, user_id=user.id, challenge_type="math", difficulty="MEDIUM",
            question="What is 7 + 6?", correct_answer="13",
            user_answer="13" if profile_data["is_correct"] else "12",
            is_correct=profile_data["is_correct"],
            attempts=profile_data["challenge_attempts"], score=profile_data["score"],
            started_at=started_at,
            completed_at=started_at + timedelta(seconds=profile_data["response_s"]),
            completion_duration_seconds=float(profile_data["response_s"]),
        ))

    db.commit()
    print(f"Seeded {DAYS_OF_HISTORY} days of wake-up sessions + challenges for {DEMO_EMAIL}")
    print(f"  Email:    {DEMO_EMAIL}")
    print(f"  Password: {DEMO_PASSWORD}")
    print("Log in and visit /habits/dashboard, or GET /analytics/recommendations as this user.")
finally:
    db.close()
