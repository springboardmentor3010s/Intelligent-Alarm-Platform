# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Database initialization and seed script for CerebroKognit.

Creates all tables and seeds default roles plus a demo user.
Usage (from backend/):
    python scripts/init_db.py            # create tables + seed
    python scripts/init_db.py --reset    # drop all tables first, then recreate + seed
"""

import os
import sys

import bcrypt

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine  # noqa: E402
from app.Models import (  # noqa: E402
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


CHALLENGE_TYPES = ["Math", "Logic", "Memory", "Word", "Pattern", "Riddle", "QuickQuiz"]
CHALLENGE_DIFFICULTIES = ["Beginner", "Easy", "Medium", "Hard", "Expert"]


def seed_challenges(db):
    """Seed the full 7-type x 5-difficulty challenge grid so /challenges/next always works."""
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
        seed_challenges(db)
        seed_demo_user(db)
        print("Roles seeded: User, Wellness Coach, Administrator")
        print("Challenges seeded: 7 types x 5 difficulties")
        print(f"Demo user ready: {DEMO_EMAIL} / {DEMO_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
