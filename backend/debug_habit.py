import os
os.environ["DATABASE_URL"] = "sqlite:///./cerebrokognit.db"
os.environ["ENVIRONMENT"] = "development"
os.environ["SECRET_KEY"] = "change_this_to_a_very_random_secret_key_min_32_bytes"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"
os.environ["AUTO_INIT"] = "0"

from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.Models import User, HabitScore, Alarm, ChallengeAttempt
from app.services import habit_scoring_service

# Create engine
engine = create_engine("sqlite:///./cerebrokognit.db", echo=True, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=True)

db = SessionLocal()
try:
    # Get the demo user
    user = db.query(User).filter(User.email == "demo@cerebro.com").first()
    print(f"User found: id={user.id}, email={user.email}")
    
    # Try to call get_or_compute_habit_score
    result = habit_scoring_service.get_or_compute_habit_score(db, user.id, "2026-09-18")
    print(f"Result: {result}")
except Exception as e:
    import traceback
    print(f"ERROR: {e}")
    traceback.print_exc()
finally:
    db.close()
