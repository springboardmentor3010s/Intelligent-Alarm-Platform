from app.db.database import SessionLocal
from app.services.adaptive_difficulty import adaptive_difficulty_engine


db = SessionLocal()

try:
    result = adaptive_difficulty_engine.get_next_difficulty(
        db=db,
        user_id=1,
        current_difficulty="easy",
    )

    print("\n========== ADAPTIVE DIFFICULTY ==========")

    for key, value in result.items():
        print(f"{key}: {value}")

    print("=========================================\n")

finally:
    db.close()