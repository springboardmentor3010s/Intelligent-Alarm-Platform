"""
test_xgboost_ml.py

Unit and integration tests for the XGBoost Machine Learning module:
- Model loading and feature verification
- Cognitive wake-up readiness inference
- Simulation query parameters
- Training metrics verification
"""

import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.main import app
from backend.app.database import Base, get_db
from backend.app.models.user import User
from backend.app.utils.security import hash_password, create_access_token
from ml.xgboost_model import (
    predict_wake_readiness,
    get_model_status,
    FEATURE_NAMES,
)


class TestXGBoostML(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # StaticPool ensures all sessions share the same in-memory connection
        from sqlalchemy.pool import StaticPool
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

        # Create test user
        db = cls.Session()
        test_user = User(
            name="ML User",
            email="ml_user@example.com",
            password_hash=hash_password("mlpass123"),
            role="user",
            difficulty_preference="medium",
            preferred_wake_time="07:00",
            sleep_duration=8.0,
        )
        db.add(test_user)
        db.commit()
        db.refresh(test_user)

        # Store scalar values before closing session
        cls.test_user_id = test_user.id
        db.close()

        cls.token = create_access_token({"sub": str(cls.test_user_id), "role": "user"})

        def override_get_db():
            session = cls.Session()
            try:
                yield session
            finally:
                session.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)

    def test_feature_names_match_specification(self):
        expected = [
            "challenge_accuracy",
            "response_time_seconds",
            "snooze_frequency",
            "wake_consistency_rate",
            "sleep_adherence_ratio",
            "consecutive_streak",
            "difficulty_tier",
        ]
        self.assertEqual(FEATURE_NAMES, expected)

    def test_predict_wake_readiness_alert_profile(self):
        # Strong performance profile
        result = predict_wake_readiness(
            challenge_accuracy=0.95,
            response_time=15.0,
            snooze_count=0.0,
            wake_consistency=1.0,
            sleep_adherence=1.0,
            consecutive_streak=7,
            difficulty_tier=4,
        )
        self.assertIn("readiness_score", result)
        self.assertIn("is_alert", result)
        self.assertIn("confidence", result)
        self.assertIn("feature_importances", result)
        self.assertIn("recommendation", result)

        self.assertGreaterEqual(result["readiness_score"], 80.0)
        self.assertTrue(result["is_alert"])
        self.assertGreater(result["confidence"], 0.8)

    def test_predict_wake_readiness_sleep_inertia_profile(self):
        # Struggling profile: low accuracy, slow response, high snoozes
        result = predict_wake_readiness(
            challenge_accuracy=0.30,
            response_time=65.0,
            snooze_count=4.0,
            wake_consistency=0.20,
            sleep_adherence=0.40,
            consecutive_streak=0,
            difficulty_tier=2,
        )
        self.assertLess(result["readiness_score"], 60.0)
        self.assertFalse(result["is_alert"])
        self.assertIn("sleep inertia", result["recommendation"].lower())

    def test_model_metrics_file(self):
        metrics = get_model_status()
        # get_model_status() returns a flat dict with the model metrics directly
        self.assertIn("accuracy", metrics)
        self.assertIn("roc_auc", metrics)
        self.assertIn("features", metrics)
        # Model should meet or exceed 85% accuracy on test set
        self.assertGreaterEqual(metrics.get("accuracy", 0), 0.85)
        self.assertGreaterEqual(metrics.get("roc_auc", 0), 0.90)

    def test_ml_readiness_api_endpoint(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        response = self.client.get("/api/ml/readiness", headers=headers)
        self.assertEqual(response.status_code, 422)
        self.assertIn("actual sleep adherence", response.json()["detail"])

    def test_ml_readiness_api_with_simulation_params(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        params = {
            "accuracy": 0.99,
            "response_time": 10.0,
            "snooze_count": 0,
            "wake_consistency": 1.0,
            "sleep_adherence": 1.0,
            "consecutive_streak": 14,
            "difficulty_tier": 5,
        }
        response = self.client.get("/api/ml/readiness", headers=headers, params=params)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["is_simulated"], True)
        self.assertGreaterEqual(data["readiness_score"], 85.0)

    def test_ml_metrics_api_endpoint(self):
        response = self.client.get("/api/ml/metrics")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("metrics", data)
        self.assertIn("feature_importance", data)


if __name__ == "__main__":
    unittest.main()
