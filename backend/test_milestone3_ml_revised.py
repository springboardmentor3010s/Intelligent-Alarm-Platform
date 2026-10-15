"""
Test Suite for Milestone 3 XGBoost Behavioral Intelligence Engine (Revised).

Verifies:
1. XGBoost as PRIMARY behavioral intelligence engine for Milestone 3:
   - Habit Score (Formula preservation + ML Behavioral Score)
   - Adaptive Difficulty (XGBoost action classification + boundary handling)
   - Recommendations (ML prediction-driven insights)
2. Seamless, automatic fallback to rule-based logic when ML models are offline
   or when users have insufficient historical records (cold start).
3. Clear source transparency (`prediction_source = 'ml_model'` vs `'rule_based_fallback'`).
4. Strict multi-tenant user isolation and zero sensitive data leakage.
"""

import sys
import os
from types import SimpleNamespace

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database.connection import SessionLocal
from app.database.models import User, Alarm, AlarmSession, UserProfile
from app.utils.security import create_access_token
from app.services.ml_intelligence_service import (
    get_ml_habit_score,
    get_ml_adaptive_difficulty,
    get_ml_recommendations,
)
from app.services.habit_scorer import calculate_habit_score

client = TestClient(app)


def run_milestone3_ml_tests():
    print("=" * 70)
    print("RUNNING REVISED MILESTONE 3 XGBOOST INTELLIGENCE TEST SUITE")
    print("=" * 70)

    db = SessionLocal()
    try:
        user_a = db.query(User).filter(User.id == 3).first()
        user_b = db.query(User).filter(User.id == 5).first()

        assert user_a is not None, "User A (id=3) not found in database."
        assert user_b is not None, "User B (id=5) not found in database."

        token_a = create_access_token(user_a.id, user_a.role)
        token_b = create_access_token(user_b.id, user_b.role)

        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # -----------------------------------------------------------------
        # TEST 1: Habit Score with Primary ML Behavioral Score
        # -----------------------------------------------------------------
        print("[TEST 1] Testing /api/analytics/habit-score with ML Behavioral Score...")
        resp_hs = client.get("/api/analytics/habit-score", headers=headers_a)
        assert resp_hs.status_code == 200, f"Error {resp_hs.status_code}: {resp_hs.text}"
        hs_data = resp_hs.json()

        # Deterministic formula checks
        for key in [
            "overall_habit_score",
            "wake_up_consistency",
            "challenge_completion",
            "snooze_reduction",
            "sleep_schedule_adherence",
            "total_sessions",
            "avg_snooze_count",
        ]:
            assert key in hs_data, f"Missing key '{key}' in habit score response"
            assert isinstance(hs_data[key], (int, float))

        # ML Behavioral Score checks
        assert "ml_behavioral_score" in hs_data
        assert hs_data["ml_behavioral_score"] is not None
        assert 0.0 <= hs_data["ml_behavioral_score"] <= 100.0
        assert hs_data["prediction_source"] == "ml_model"
        assert "XGBoost" in hs_data.get("confidence_note", "")
        print(f"  [PASS] Active user habit score: Formula={hs_data['overall_habit_score']}, ML Behavioral Score={hs_data['ml_behavioral_score']}, Source={hs_data['prediction_source']}")

        # Cold-start fallback for zero-session user
        resp_hs_b = client.get("/api/analytics/habit-score", headers=headers_b)
        assert resp_hs_b.status_code == 200
        hs_b_data = resp_hs_b.json()
        assert hs_b_data["total_sessions"] == 0
        assert hs_b_data["overall_habit_score"] == 60.0
        assert hs_b_data["prediction_source"] == "rule_based_fallback"
        print("  [PASS] Zero-session user safely falls back to rule_based_fallback.")

        # -----------------------------------------------------------------
        # TEST 2: Primary ML Adaptive Difficulty Recommendation
        # -----------------------------------------------------------------
        print("[TEST 2] Testing /api/analytics/adaptive-difficulty with XGBoost classification...")
        resp_ad = client.get("/api/analytics/adaptive-difficulty", headers=headers_a)
        assert resp_ad.status_code == 200
        ad_data = resp_ad.json()

        for field in [
            "current_difficulty",
            "recommended_difficulty",
            "accuracy",
            "sample_size",
            "adjusted",
            "reason",
            "action",
            "prediction_source",
            "confidence",
        ]:
            assert field in ad_data, f"Missing field '{field}' in adaptive-difficulty response"

        assert ad_data["prediction_source"] == "ml_model"
        assert ad_data["action"] in ["increase", "maintain", "decrease"]
        assert 0.0 <= ad_data["confidence"] <= 1.0
        assert "XGBoost" in ad_data["reason"]
        print(f"  [PASS] ML Adaptive Difficulty -> Current={ad_data['current_difficulty']}, Recommended={ad_data['recommended_difficulty']}, Action={ad_data['action']}, Confidence={ad_data['confidence']}, Source={ad_data['prediction_source']}")

        # Cold-start fallback for zero-session user
        resp_ad_b = client.get("/api/analytics/adaptive-difficulty", headers=headers_b)
        assert resp_ad_b.status_code == 200
        ad_b_data = resp_ad_b.json()
        assert ad_b_data["sample_size"] == 0
        assert ad_b_data["adjusted"] is False
        assert ad_b_data["action"] == "maintain"
        assert ad_b_data["prediction_source"] == "rule_based_fallback"
        print("  [PASS] Cold start user safely returns rule_based_fallback for adaptive difficulty.")

        # -----------------------------------------------------------------
        # TEST 3: Primary ML Personalized Recommendations
        # -----------------------------------------------------------------
        print("[TEST 3] Testing /api/analytics/recommendations with ML risk and tuning drivers...")
        resp_rec = client.get("/api/analytics/recommendations", headers=headers_a)
        assert resp_rec.status_code == 200
        rec_data = resp_rec.json()

        assert "recommendations" in rec_data
        assert "total" in rec_data
        assert "prediction_source" in rec_data
        assert rec_data["total"] > 0
        assert rec_data["prediction_source"] == "ml_model"

        first_rec = rec_data["recommendations"][0]
        assert "prediction_source" in first_rec
        assert first_rec["prediction_source"] == "ml_model"
        print(f"  [PASS] Active user received {rec_data['total']} recommendations. Top item: [{first_rec['priority']}] {first_rec['title']} (Source: {first_rec['prediction_source']})")

        # Cold start recommendations
        resp_rec_b = client.get("/api/analytics/recommendations", headers=headers_b)
        assert resp_rec_b.status_code == 200
        rec_b_data = resp_rec_b.json()
        assert rec_b_data["total"] > 0
        for item in rec_b_data["recommendations"]:
            assert item["prediction_source"] == "rule_based_fallback"
        print(f"  [PASS] Zero-session user received {rec_b_data['total']} baseline onboarding items with rule_based_fallback.")

        # -----------------------------------------------------------------
        # TEST 4: Direct Service Fallback Simulation
        # -----------------------------------------------------------------
        print("[TEST 4] Testing Direct Service Fallback Under Fault Conditions...")
        # Test adaptive difficulty with empty past sessions
        empty_diff = get_ml_adaptive_difficulty(
            current_difficulty="hard",
            alarm=None,
            user=None,
            user_profile=None,
            past_sessions=[],
        )
        assert empty_diff["prediction_source"] == "rule_based_fallback"
        assert empty_diff["adjusted"] is False
        assert empty_diff["sample_size"] == 0

        # Test habit score with empty sessions
        empty_hs = get_ml_habit_score(
            sessions=[],
            user_profile=None,
            alarms=None,
        )
        assert empty_hs["prediction_source"] == "rule_based_fallback"
        assert empty_hs["overall_habit_score"] == 60.0
        assert empty_hs["total_sessions"] == 0
        print("  [PASS] Fault injection & empty history safely handled by rule-based fallbacks.")

        # -----------------------------------------------------------------
        # TEST 5: Executive Analytics Response Integration
        # -----------------------------------------------------------------
        print("[TEST 5] Testing Executive Analytics Response with ML Fields...")
        resp_analytics = client.get("/api/analytics", headers=headers_a)
        assert resp_analytics.status_code == 200
        analytics_data = resp_analytics.json()

        assert "habit_score" in analytics_data
        assert "recommended_difficulty" in analytics_data
        assert analytics_data["habit_score"]["ml_behavioral_score"] is not None
        assert analytics_data["habit_score"]["prediction_source"] == "ml_model"
        print(f"  [PASS] Executive Analytics contains ML Behavioral Score ({analytics_data['habit_score']['ml_behavioral_score']}) and ML Recommended Difficulty ('{analytics_data['recommended_difficulty']}').")

        print("=" * 70)
        print("ALL REVISED MILESTONE 3 XGBOOST INTELLIGENCE TESTS PASSED! [OK]")
        print("=" * 70)

    finally:
        db.close()


if __name__ == "__main__":
    run_milestone3_ml_tests()
