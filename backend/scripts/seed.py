"""Create the first administrator, a wellness coach and a demo user.

Run from the backend folder:   python -m scripts.seed

Passwords come from SEED_*_PASSWORD in .env. If one is empty, a random
password is generated and printed once. Existing accounts are not changed.
"""
import os
import secrets

from dotenv import load_dotenv
from sqlalchemy import func, select

load_dotenv()

from app.core.security import hash_password  # noqa: E402
from app.db.database import SessionLocal, engine  # noqa: E402
from app.db.init_db import init_db  # noqa: E402
from app.models.alarm import Alarm  # noqa: E402
from app.models.coach_assignment import CoachAssignment  # noqa: E402
from app.models.notification_preference import NotificationPreference  # noqa: E402
from app.models.profile import UserProfile  # noqa: E402
from app.models.user import User  # noqa: E402

ACCOUNTS = [
    ("admin", "Platform Admin", "SEED_ADMIN_EMAIL", "admin@example.com", "SEED_ADMIN_PASSWORD"),
    ("coach", "Wellness Coach", "SEED_COACH_EMAIL", "coach@example.com", "SEED_COACH_PASSWORD"),
    ("user", "Demo User", "SEED_DEMO_EMAIL", "demo@example.com", "SEED_DEMO_PASSWORD"),
]


def main() -> None:
    init_db(engine)
    db = SessionLocal()
    created: dict[str, tuple[str, str]] = {}
    users: dict[str, User] = {}

    try:
        for role, name, email_key, default_email, password_key in ACCOUNTS:
            email = os.getenv(email_key, default_email).strip().lower()
            existing = db.execute(
                select(User).where(func.lower(User.email) == email)
            ).scalar_one_or_none()
            if existing:
                users[role] = existing
                print(f"[skip] {role}: {email} already exists")
                continue

            password = os.getenv(password_key, "").strip() or secrets.token_urlsafe(12) + "9a"
            user = User(full_name=name, email=email, role=role,
                        password_hash=hash_password(password))
            db.add(user)
            db.flush()
            db.add(UserProfile(user_id=user.id))
            db.add(NotificationPreference(user_id=user.id))
            users[role] = user
            created[role] = (email, password)

        if "user" in created and "coach" in users:
            demo = users["user"]
            db.add(CoachAssignment(coach_id=users["coach"].id, user_id=demo.id))
            from datetime import time
            db.add(Alarm(user_id=demo.id, title="Morning Wake-up", alarm_time=time(7, 0),
                         recurrence="weekdays", challenge_type="math", difficulty="easy",
                         snooze_limit=2, enabled=True))

        db.commit()
    finally:
        db.close()

    if created:
        print("\nAccounts created. Save these passwords now, they are not shown again:\n")
        for role, (email, password) in created.items():
            print(f"  {role:<6} {email:<28} {password}")
        print("\nChange them after the first login (Settings > Change password).")


if __name__ == "__main__":
    main()
