"""
Creates a demo Administrator account (cannot be created via public registration).
Run once after reset_db.py:

    python seed_admin.py

Credentials:
    Email:    admin@cognitivealarm.com
    Password: Admin@1234
"""
import sys
sys.path.insert(0, ".")

from app.db.database import SessionLocal, Base, engine
from app.models.models import User, UserProfile
from app.core.security import hash_password
import app.models.models

Base.metadata.create_all(bind=engine)

ADMIN_EMAIL = "admin@cognitivealarm.com"
ADMIN_PASSWORD = "Admin@1234"

db = SessionLocal()
try:
    existing = db.query(User).filter(User.email == ADMIN_EMAIL).first()
    if existing:
        print(f"Admin already exists: {ADMIN_EMAIL}")
    else:
        admin = User(
            name="Administrator",
            email=ADMIN_EMAIL,
            password_hash=hash_password(ADMIN_PASSWORD),
            role="ADMINISTRATOR",
        )
        db.add(admin)
        db.flush()
        db.add(UserProfile(user_id=admin.id))
        db.commit()
        print(f"Admin created.")
        print(f"  Email:    {ADMIN_EMAIL}")
        print(f"  Password: {ADMIN_PASSWORD}")
finally:
    db.close()
