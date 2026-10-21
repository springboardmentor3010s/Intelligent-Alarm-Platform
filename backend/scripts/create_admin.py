import os
import sys

from app.database import Base, SessionLocal, engine
from app.models.user import User
from app.utils.security import hash_password


def main():
    name = os.getenv("ADMIN_NAME", "").strip()
    email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD", "")
    if not name or not email or not password:
        raise SystemExit("Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD before provisioning.")
    if len(password) < 12:
        raise SystemExit("ADMIN_PASSWORD must contain at least 12 characters.")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing is not None:
            raise SystemExit("An account with ADMIN_EMAIL already exists; no changes were made.")
        admin = User(
            name=name,
            email=email,
            password_hash=hash_password(password),
            role="admin",
        )
        db.add(admin)
        db.commit()
        print(f"Provisioned administrator account for {email}.")
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
