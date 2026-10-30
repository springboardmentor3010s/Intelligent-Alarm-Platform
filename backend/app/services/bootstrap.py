# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Local (SQLite-only) bootstrap: zero-setup, fully-local operation.

On startup the app creates tables and seeds roles/challenges/role accounts ONLY
when backed by a local SQLite database (the default when DATABASE_URL is not set).
Postgres (Docker/cloud) deployments are never touched — they keep using
`alembic upgrade head` via the container entrypoint.

Disable with AUTO_INIT=0.
"""

import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import bcrypt

from ..database import SessionLocal, engine
from ..Models import (
    Alarm,
    Announcement,
    Base,
    Challenge,
    ChallengeAttempt,
    CoachAssignment,
    HabitScore,
    ProductivityLog,
    Role,
    User,
    UserRole,
)

DEFAULT_ROLES = [
    ("User", "Standard registered user with alarm and challenge access"),
    ("Wellness Coach", "Can view assigned user cohorts and reports"),
    ("Administrator", "Full platform access: users, analytics, reports"),
]

CHALLENGE_TYPES = ["Math", "Logic", "Memory", "Word", "Pattern", "Riddle", "QuickQuiz"]
CHALLENGE_DIFFICULTIES = ["Beginner", "Easy", "Medium", "Hard", "Expert"]

# (email, password, full_name, role) — seeded so every role can be demoed.
# Registration always grants "User", so an Administrator must exist up front
# before the admin-only role-change endpoint can promote anyone.
SEED_ACCOUNTS = [
    ("admin@gmail.com", "Admin@123", "Platform Administrator", "Administrator"),
    ("coach@gmail.com", "Coach@123", "Wellness Coach", "Wellness Coach"),
    ("user@gmail.com", "User@123", "Demo User", "User"),
]

# (coach_email, member_email): one cohort assignment so the coach view has data.
SEED_COHORT = ("coach@gmail.com", "user@gmail.com")

# Pre-seed account from older builds; removed on sight so it stops lingering.
LEGACY_DEMO_EMAIL = "demo@cerebro.com"

# Days of sample history created per account so dashboards are not blank.
DEMO_HISTORY_DAYS = 10


def _is_local_sqlite() -> bool:
    return engine.url.get_backend_name() == "sqlite"


def _seed_roles(db):
    for name, description in DEFAULT_ROLES:
        if db.query(Role).filter(Role.name == name).first() is None:
            db.add(Role(name=name, description=description))
    db.commit()


def _seed_challenges(db):
    """Seed the 7-type x 5-difficulty grid so /challenges/next always works."""
    existing = {
        (c.challenge_type, c.difficulty)
        for c in db.query(Challenge).filter(Challenge.is_active).all()
    }
    for ctype in CHALLENGE_TYPES:
        for diff in CHALLENGE_DIFFICULTIES:
            if (ctype, diff) not in existing:
                db.add(
                    Challenge(
                        title=f"{ctype} challenge",
                        description=f"{ctype} challenge at {diff} difficulty",
                        challenge_type=ctype,
                        difficulty=diff,
                        is_active=True,
                    )
                )
    db.commit()


def _seed_accounts(db):
    """Create the three role accounts, link the User into the Coach's cohort,
    and delete the legacy demo account if it is still present."""
    accounts = {}
    for email, password, full_name, role_name in SEED_ACCOUNTS:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            user = User(
                email=email,
                hashed_password=hashed,
                full_name=full_name,
                timezone="UTC",
                difficulty_preference="Medium",
            )
            db.add(user)
            db.flush()
        accounts[email] = user

        role = db.query(Role).filter(Role.name == role_name).first()
        if role is not None and not db.query(UserRole).filter(
            UserRole.user_id == user.id, UserRole.role_id == role.id
        ).first():
            db.add(UserRole(user_id=user.id, role_id=role.id))

    coach = accounts.get(SEED_COHORT[0])
    member = accounts.get(SEED_COHORT[1])
    if coach is not None and member is not None and not db.query(CoachAssignment).filter(
        CoachAssignment.coach_id == coach.id,
        CoachAssignment.user_id == member.id,
    ).first():
        db.add(CoachAssignment(coach_id=coach.id, user_id=member.id))

    legacy = db.query(User).filter(User.email == LEGACY_DEMO_EMAIL).first()
    if legacy is not None:
        db.query(UserRole).filter(UserRole.user_id == legacy.id).delete()
        db.delete(legacy)

    db.commit()


def _clamp(value: int, low: int = 55, high: int = 98) -> int:
    return max(low, min(high, value))


def _overall(wake: int, challenge: int, snooze: int, sleep: int) -> int:
    # Same weighting the scoring service uses for the composite habit score.
    return round(0.35 * wake + 0.25 * challenge + 0.2 * snooze + 0.2 * sleep)


def seed_demo_data(db):
    """Give each role account sample history so no dashboard demos blank.

    Fills gaps only (idempotent): existing rows for a user/date are left alone,
    alarms are added only when the user has none, and announcements only when the
    table is empty. Only reached for local SQLite.
    """
    emails = [email for email, *_ in SEED_ACCOUNTS]
    accounts = db.query(User).filter(User.email.in_(emails)).all()
    by_type = defaultdict(list)
    for challenge in db.query(Challenge).filter(Challenge.is_active).all():
        by_type[challenge.challenge_type].append(challenge)

    now = datetime.now(timezone.utc)
    days = [(now - timedelta(days=offset)).date().isoformat() for offset in range(DEMO_HISTORY_DAYS)]
    for idx, user in enumerate(sorted(accounts, key=lambda u: u.email)):
        if db.query(Alarm).filter(Alarm.user_id == user.id).first() is None:
            for offset, (title, alarm_type, hour) in enumerate(
                [
                    ("Morning Wake-Up", "Daily", 6),
                    ("Work Day Start", "Weekday", 7),
                    ("Weekend Long Run", "One-Time", 8),
                ]
            ):
                pool = by_type[CHALLENGE_TYPES[offset % len(CHALLENGE_TYPES)]] or [None]
                trigger = (now + timedelta(days=1)).replace(
                    hour=hour, minute=30, second=0, microsecond=0
                )
                db.add(
                    Alarm(
                        user_id=user.id,
                        title=title,
                        alarm_type=alarm_type,
                        next_trigger=trigger,
                        is_enabled=True,
                        challenge_id=pool[0].id if pool[0] else None,
                        question_count=3,
                        times_snoozed=offset,
                        recurrence="FREQ=DAILY" if alarm_type != "One-Time" else None,
                    )
                )

        have_scores = {
            row[0] for row in db.query(HabitScore.date).filter(HabitScore.user_id == user.id)
        }
        have_days = {
            row[0].date().isoformat()
            for row in db.query(ChallengeAttempt.start_time).filter(
                ChallengeAttempt.user_id == user.id, ChallengeAttempt.start_time.isnot(None)
            )
        }
        have_logs = {
            row[0] for row in db.query(ProductivityLog.date).filter(ProductivityLog.user_id == user.id)
        }

        for day_offset, day in enumerate(days):
            if day not in have_scores:
                base = 84 - idx * 3 - (day_offset % 4)
                wake = _clamp(base + 3)
                challenge = _clamp(base - 2)
                snooze = _clamp(base - 7 + (day_offset % 5))
                sleep = _clamp(base + 1 - (day_offset % 3))
                db.add(
                    HabitScore(
                        user_id=user.id,
                        date=day,
                        wake_up_consistency=wake,
                        challenge_completion=challenge,
                        snooze_reduction=snooze,
                        sleep_schedule_adherence=sleep,
                        overall_score=_overall(wake, challenge, snooze, sleep),
                    )
                )

            if day not in have_days:
                ctype = CHALLENGE_TYPES[(day_offset + idx) % len(CHALLENGE_TYPES)]
                pool = by_type.get(ctype) or []
                if pool:
                    total = 3
                    correct = total if day_offset % 3 else total - 1
                    start = (now - timedelta(days=day_offset)).replace(
                        hour=6, minute=35, second=0, microsecond=0
                    )
                    db.add(
                        ChallengeAttempt(
                            user_id=user.id,
                            challenge_id=pool[day_offset % len(pool)].id,
                            attempt_number=1,
                            completed=correct == total,
                            correct_answers=correct,
                            total_questions=total,
                            start_time=start,
                            end_time=start + timedelta(seconds=90 + day_offset * 5),
                            time_taken_seconds=90 + day_offset * 5,
                        )
                    )

            if day_offset < 5 and day not in have_logs:
                db.add(
                    ProductivityLog(
                        user_id=user.id,
                        date=day,
                        score=_clamp(68 + ((day_offset * 7 + idx * 5) % 26)),
                        note="Deep work block" if day_offset % 2 == 0 else "Meeting-heavy day",
                        source="user-entered",
                    )
                )

    admin = next((u for u in accounts if u.email == "admin@gmail.com"), None)
    if admin is not None and db.query(Announcement).first() is None:
        db.add(
            Announcement(
                title="Welcome to CerebroKognit",
                body=(
                    "Set a wake-up alarm and let the adaptive engine sharpen your "
                    "focus with a short cognitive challenge each morning."
                ),
                is_active=True,
                priority=10,
                created_by=admin.id,
            )
        )
        db.add(
            Announcement(
                title="Personalized recommendations are live",
                body="Open Analytics to see guidance tuned to your sleep and challenge history.",
                is_active=True,
                priority=5,
                created_by=admin.id,
            )
        )

    db.commit()


def bootstrap_local_db():
    """Create tables and seed demo data for a local SQLite database."""
    if os.getenv("AUTO_INIT", "1").lower() in ("0", "false", "no"):
        return
    if not _is_local_sqlite():
        return

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _seed_roles(db)
        _seed_challenges(db)
        _seed_accounts(db)
        seed_demo_data(db)
    finally:
        db.close()

