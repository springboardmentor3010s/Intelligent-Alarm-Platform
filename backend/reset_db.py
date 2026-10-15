"""
Resets the PostgreSQL database â€” deletes all data and recreates tables.
Run this ONCE before your demo to start clean:

    python reset_db.py

After running this, use seed_admin.py to create the demo admin account.
"""
import sys, os
sys.path.insert(0, ".")

from app.db.database import Base, engine
import app.models.models  # register all models

print("Dropping all tables...")
Base.metadata.drop_all(bind=engine)
print("Recreating all tables...")
Base.metadata.create_all(bind=engine)
print("Done. Database is clean.")
print()
print("Next step: python seed_admin.py")
