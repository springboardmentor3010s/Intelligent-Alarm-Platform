"""Local (SQLite-only) bootstrap: zero-setup, fully-local operation.

On startup the app creates tables and seeds roles/challenges/demo user ONLY when
backed by a local SQLite database (the default when DATABASE_URL is not set).
Postgres (Docker/cloud) deployments are never touched — they keep using
`alembic upgrade head` via the container entrypoint.

Disable with AUTO_INIT=0.
"""

import os

import bcrypt

from ..database import SessionLocal, engine
from ..Models import Base, Challenge, Role, User, UserRole

DEFAULT_ROLES = [
    ("User", "Standard registered user with alarm and challenge access"),
    ("Wellness Coach", "Can view assigned user cohorts and reports"),
    ("Administrator", "Full platform access: users, analytics, reports"),
]

CHALLENGE_TYPES = ["Math", "Logic", "Memory", "Word", "Pattern", "Riddle", "QuickQuiz"]
CHALLENGE_DIFFICULTIES = ["Beginner", "Easy", "Medium", "Hard", "Expert"]

DEMO_EMAIL = "demo@cerebro.com"
DEMO_PASSWORD = "password123"


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


def _seed_demo_user(db):
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
        if role is not None:
            db.add(UserRole(user_id=user.id, role_id=role.id))
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
        _seed_demo_user(db)
    finally:
        db.close()
