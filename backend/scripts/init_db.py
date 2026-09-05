"""Database initialization and seed script for CerebroKognit.

Creates all tables and seeds default roles plus a demo user + sample alarm.
Usage (from backend/):
    python scripts/init_db.py            # create tables + seed
    python scripts/init_db.py --reset    # drop all tables first, then recreate + seed
"""

import os
import sys
from datetime import datetime, timedelta, timezone

import bcrypt

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine  # noqa: E402
from app.Models import (  # noqa: E402
    Alarm,
    Base,
    Challenge,
    Role,
    User,
    UserRole,
)

DEFAULT_ROLES = [
    ("User", "Standard registered user with alarm and challenge access"),
    ("Wellness Coach", "Can view assigned user cohorts and reports"),
    ("Administrator", "Full platform access: users, analytics, reports"),
]

DEMO_EMAIL = "demo@cerebro.com"
DEMO_PASSWORD = "password123"


def seed_roles(db):
    for name, description in DEFAULT_ROLES:
        if not db.query(Role).filter(Role.name == name).first():
            db.add(Role(name=name, description=description))
    db.commit()


def seed_demo_user(db):
    user = db.query(User).filter(User.email == DEMO_EMAIL).first()
    if user is None:
        hashed = bcrypt.hashpw(DEMO_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        user = User(
            email=DEMO_EMAIL,
            hashed_password=hashed,
            full_name="Demo User",
            timezone="UTC",
            difficulty_preference="Medium",
        )
        db.add(user)
        db.flush()
        role = db.query(Role).filter(Role.name == "User").first()
        if role:
            db.add(UserRole(user_id=user.id, role_id=role.id))
        db.commit()

    # Seed a sample daily challenge-linked alarm if the user has none
    if not db.query(Alarm).filter(Alarm.user_id == user.id).first():
        challenge = (
            db.query(Challenge)
            .filter(Challenge.challenge_type == "Math", Challenge.difficulty == "Medium")
            .first()
        )
        if challenge is None:
            challenge = Challenge(
                title="Morning Math Warm-up",
                description="Solve simple arithmetic to dismiss the alarm",
                challenge_type="Math",
                difficulty="Medium",
                is_active=True,
            )
            db.add(challenge)
            db.flush()

        now = datetime.now(timezone.utc)
        next_trigger = (now + timedelta(days=1)).replace(hour=7, minute=0, second=0, microsecond=0)
        db.add(
            Alarm(
                user_id=user.id,
                title="Morning Boost",
                alarm_type="Daily",
                next_trigger=next_trigger,
                is_enabled=True,
                challenge_id=challenge.id,
                times_snoozed=0,
            )
        )
        db.commit()


def main():
    reset = "--reset" in sys.argv
    if reset:
        print("Dropping all tables...")
        Base.metadata.drop_all(bind=engine)

    print("Creating tables (create_all)...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_roles(db)
        seed_demo_user(db)
        print("Roles seeded: User, Wellness Coach, Administrator")
        print(f"Demo user ready: {DEMO_EMAIL} / {DEMO_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()