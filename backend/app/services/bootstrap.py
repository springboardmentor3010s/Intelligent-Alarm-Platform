"""First-run setup: initial administrator (from environment) and optional demo data."""
import logging
import random
from datetime import datetime, time, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password, password_problem
from app.core.timeutil import local_to_utc, local_now, utcnow
from app.models import (Alarm, ChallengeInstance, CoachLink, Notification, SleepLog, User, UserProfile, WakeSession)
from app.services import analytics as A, challenge_gen, verification

log = logging.getLogger("wakeful.bootstrap")
DEMO_DOMAIN = "demo.example.com"


def ensure_admin(db: Session) -> None:
    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        return
    if db.query(User.id).filter(User.role == "admin").first():
        return
    problem = password_problem(settings.ADMIN_PASSWORD)
    if problem:
        log.error("ADMIN_PASSWORD rejected (%s) - first administrator NOT created.", problem)
        return
    u = User(full_name=settings.ADMIN_NAME, email=settings.ADMIN_EMAIL.lower(), role="admin",
             hashed_password=hash_password(settings.ADMIN_PASSWORD))
    u.profile = UserProfile(onboarded=True)
    db.add(u)
    db.commit()
    log.info("Created first administrator account: %s", u.email)


def _mk_user(db, name, email, role, pw):
    u = User(full_name=name, email=email, role=role, hashed_password=hash_password(pw))
    u.profile = UserProfile(preferred_wake_time=time(6, 45), bedtime=time(23, 0), sleep_duration_minutes=450,
                            timezone="Asia/Kolkata", onboarded=True, productivity_goal="Deep-work block before 9am")
    db.add(u)
    db.flush()
    return u


def seed_demo(db: Session) -> None:
    """28 days of realistic history for 3 members + 1 coach so every dashboard has something to show."""
    if not settings.SEED_DEMO_DATA or password_problem(settings.DEMO_PASSWORD or ""):
        return
    if db.query(User.id).filter(User.email == f"coach@{DEMO_DOMAIN}").first():
        return
    rnd = random.Random(2024)
    pw = settings.DEMO_PASSWORD
    coach = _mk_user(db, "Priya Nair (Demo Coach)", f"coach@{DEMO_DOMAIN}", "wellness_coach", pw)
    people = [  # name, email, success prob start->end, snooze mean, accuracy, bedtime drift
        ("Aarav Mehta (Demo)", f"aarav@{DEMO_DOMAIN}", 0.55, 0.95, 1.6, 0.6, 0.85),
        ("Meera Iyer (Demo)", f"meera@{DEMO_DOMAIN}", 0.92, 0.97, 0.5, 0.9, 0.2),
        ("Rohan Gupta (Demo)", f"rohan@{DEMO_DOMAIN}", 0.45, 0.4, 2.0, 0.5, 1.0),
    ]
    methods = ["puzzle", "multi_step", "consecutive", "timed", "accuracy_check"]
    real_today = A.today_of
    for name, email, p0, p1, snz, acc, jitter in people:
        m = _mk_user(db, name, email, "user", pw)
        db.add(CoachLink(coach_id=coach.id, member_id=m.id, status="active", invited_by="admin"))
        alarm = Alarm(user_id=m.id, label="Morning", time=time(6, 45), alarm_type="daily", repeat_days="0,1,2,3,4,5,6",
                      verification_method=rnd.choice(methods), created_at=utcnow() - timedelta(days=40))
        db.add(alarm)
        db.flush()
        today = local_now("Asia/Kolkata").date()
        diff = "easy"
        for k in range(28, 0, -1):
            day = today - timedelta(days=k)
            frac = (28 - k) / 27
            p_ok = p0 + (p1 - p0) * frac
            ring = local_to_utc(day, time(6, 45), "Asia/Kolkata")
            ok = rnd.random() < p_ok
            sn = min(2, max(0, round(rnd.gauss(snz * (1.3 - frac * 0.6), 0.7))))
            s = WakeSession(user_id=m.id, alarm_id=alarm.id, label="Morning", local_date=day, scheduled_at=ring,
                            started_at=ring, last_ring_at=ring, status="dismissed" if ok else "missed",
                            verification_method=alarm.verification_method, difficulty=diff, snooze_count=sn if ok else 0,
                            max_snoozes=2, wrong_count=0)
            verification.init_session(s, alarm.verification_method)
            db.add(s)
            db.flush()
            if ok:
                s.dismissed_at = ring + timedelta(seconds=rnd.randint(40, 180) + sn * 300)
                total_q = rnd.randint(1, 3)
                good = 0
                for _ in range(total_q):
                    ctype = rnd.choice(challenge_gen_types(rnd))
                    g = challenge_gen.generate(ctype, diff, rnd)
                    correct = rnd.random() < acc
                    good += correct
                    t = rnd.uniform(6, 0.7 * g["time_limit"])
                    db.add(ChallengeInstance(user_id=m.id, session_id=s.id, challenge_type=ctype, difficulty=diff,
                                             prompt=g["prompt"], correct_answer=g["answer"], time_limit_seconds=g["time_limit"],
                                             issued_at=ring, answered_at=ring + timedelta(seconds=t), is_correct=correct,
                                             time_taken_seconds=round(t, 1)))
                s.wrong_count = total_q - good
                s.alertness_score = round(min(98, 55 + 40 * acc + rnd.uniform(-8, 8) - sn * 6), 1)
            bed = (datetime.combine(day, time(23, 0)) + timedelta(minutes=rnd.gauss(0, 35 * jitter) + 20 * jitter)).time()
            dur = int(max(300, min(600, rnd.gauss(450 - 50 * jitter + 30 * frac * (1 - jitter), 35))))
            db.add(SleepLog(user_id=m.id, log_date=day, bedtime=bed, wake_time=time(6, 45), duration_minutes=dur,
                            quality=max(1, min(5, round(dur / 100 + rnd.uniform(-1, 0.8)))),
                            productivity=max(1, min(5, round(2 + dur / 150 + (1 if ok else -1) * 0.7 + rnd.uniform(-0.8, 0.8))))))
            db.flush()
            A.today_of = lambda _db, _uid, d=day: d  # score as-of that day so the trend chart has real history
            A.store_habit_score(db, m.id)
            A.today_of = real_today
        db.add(Notification(user_id=m.id, kind="progress", title="Welcome to Wakeful",
                            body="This is demo data so you can explore every dashboard."))
    db.commit()
    log.info("Demo data seeded (coach + 3 members).")


def challenge_gen_types(rnd):
    return ["math", "pattern", "memory", "word", "logic", "riddle", "quiz"]
