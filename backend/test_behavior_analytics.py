from app.db.database import SessionLocal
from app.services.behavior_analytics import (
    behavior_analytics_service,
)


db = SessionLocal()

try:
    result = behavior_analytics_service.get_user_behavior(
        db=db,
        user_id=1,
    )

    print("\n========== BEHAVIOR ANALYTICS ==========")

    print("\nWake-up Behavior:")
    for key, value in result["wake_up_behavior"].items():
        print(f"  {key}: {value}")

    print("\nCognitive Behavior:")
    for key, value in result["cognitive_behavior"].items():
        print(f"  {key}: {value}")

    print("\nAlarm Behavior:")
    for key, value in result["alarm_behavior"].items():
        print(f"  {key}: {value}")

    print(
        f"\nConsistency Score: "
        f"{result['consistency_score']}"
    )

    print(
        f"Behavior Score: "
        f"{result['behavior_score']}"
    )

    print("\n==========================================\n")

finally:
    db.close()