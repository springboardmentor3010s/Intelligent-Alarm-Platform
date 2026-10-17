# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Local (SQLite-only) bootstrap: zero-setup, fully-local operation.

On startup the app creates tables and seeds roles/challenges/role accounts ONLY
when backed by a local SQLite database (the default when DATABASE_URL is not set).
Postgres (Docker/cloud) deployments are never touched — they keep using
`alembic upgrade head` via the container entrypoint.

Disable with AUTO_INIT=0.
"""

import os

import bcrypt

from ..database import SessionLocal, engine
from ..Models import Base, Challenge, CoachAssignment, Role, User, UserRole

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


def bootstrap_local_db():
    """Create tables + seed when running against a local SQLite database."""
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
    finally:
        db.close()
