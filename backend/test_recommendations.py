from database import SessionLocal
import main # Ensure models are loaded
from Models.user import User
from Models.analytics import BehaviorProfile, Recommendation
from services.recommendation import generate_daily_recommendations
from services.analytics import calculate_daily_habit_score
from datetime import date

def test_hybrid_recommendation_engine():
    db = SessionLocal()
    try:
        print("--- Testing Phase 4 (Hybrid Recommendation Engine) ---")
        user = db.query(User).first()
        if not user:
            print("No user found. Run seed_users.py first.")
            return

        # Clear old recommendations for today
        today = date.today()
        db.query(Recommendation).filter(Recommendation.user_id == user.id, Recommendation.date == today).delete()
        db.commit()

        # Step 1: Mock a profile for a struggling user
        print("\n[>] Simulating user profile (Struggling, High Snoozes, Poor Wake-up)...")
        profile = BehaviorProfile(
            user_id=user.id,
            date=today,
            wake_up_consistency_score=10.0, # Poor
            challenge_completion_rate=0.3,  # Poor
            snooze_count=4,                 # High
            sleep_adherence_score=5.0,      # Poor
            habit_score=35.0                # Poor
        )

        # Step 2: Run Recommendation Engine
        print("[>] Running PyTorch + LSTM Recommendation Engine...")
        generate_daily_recommendations(user.id, profile, db)
        
        # Step 3: Fetch Results
        recs = db.query(Recommendation).filter(Recommendation.user_id == user.id, Recommendation.date == today).all()
        
        print(f"\n[=] Generated {len(recs)} Recommendations:")
        for r in recs:
            print(f"  - [{r.category}] ({r.priority} Priority): {r.message}")

    finally:
        db.close()

if __name__ == "__main__":
    test_hybrid_recommendation_engine()
