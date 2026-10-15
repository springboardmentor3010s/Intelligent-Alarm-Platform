from app.db.database import SessionLocal
from app.services.habit_score import (
    habit_score_service,
)


db = SessionLocal()

try:
    result = habit_score_service.calculate_habit_score(
        db=db,
        user_id=1,
    )

    print("\n========== HABIT SCORE ==========")

    print(
        f"\nHabit Score: "
        f"{result['habit_score']} / 100"
    )

    print("\nComponents:")

    for key, value in result["components"].items():
        print(f"  {key}: {value}")

    print("\nWeights:")

    for key, value in result["weights"].items():
        print(f"  {key}: {value}")

    print(
        f"\nAnalysis Period: "
        f"{result['analysis_period_days']} days"
    )

    print("\n=================================\n")

finally:
    db.close()