# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Database initialization and seed script for CerebroKognit.

Creates all tables and seeds default roles plus the three role accounts
(User / Wellness Coach / Administrator).
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
    CoachAssignment,
    Role,
    User,
    UserRole,
)

DEFAULT_ROLES = [
    ("User", "Standard registered user with alarm and challenge access"),
    ("Wellness Coach", "Can view assigned user cohorts and reports"),
    ("Administrator", "Full platform access: users, analytics, reports"),
]

# (email, password, full_name, role) — seeded so every role can be demoed.
SEED_ACCOUNTS = [
    ("admin@gmail.com", "Admin@123", "Platform Administrator", "Administrator"),
    ("coach@gmail.com", "Coach@123", "Wellness Coach", "Wellness Coach"),
    ("user@gmail.com", "User@123", "Demo User", "User"),
]

# (coach_email, member_email): one cohort assignment so the coach view has data.
SEED_COHORT = ("coach@gmail.com", "user@gmail.com")

# Pre-seed account from older builds; removed on sight so it stops lingering.
LEGACY_DEMO_EMAIL = "demo@cerebro.com"


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


def seed_accounts(db):
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
        if role and not db.query(UserRole).filter(
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
        seed_accounts(db)
        print("Roles seeded: User, Wellness Coach, Administrator")
        print("Challenges seeded: full 7-type x 5-difficulty grid")
        print("Accounts seeded:")
        for email, password, _full_name, role_name in SEED_ACCOUNTS:
            print(f"  {role_name:<15} {email} / {password}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
