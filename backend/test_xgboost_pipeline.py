"""
Automated Test Suite for XGBoost Machine Learning Pipeline and Prediction Endpoints.

Validates:
1. Synthetic benchmark dataset structure, integrity, and class balance.
2. Model artifact and metadata serialization (ROC-AUC, Precision, Recall, Brier score, Log-Loss).
3. Zero data leakage in feature extraction (strictly prediction-time features).
4. Robustness of feature extractor to missing profiles and cold-start histories.
5. Probabilistic inference service, probability range [0, 1], and human-readable risk drivers.
6. Graceful rule-based fallback when model is unavailable or uncalibrated.
7. Authenticated FastAPI prediction endpoints with JWT enforcement.
8. Strict multi-tenant user isolation (User A cannot predict or view User B's alarms).
9. Invalid alarm handling (404 for nonexistent alarms).
"""

import os
import sys
import json
from datetime import time, datetime, timezone
import pandas as pd
import joblib

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database.connection import SessionLocal
from app.database.models import User, Alarm, AlarmSession, UserProfile
from app.utils.security import create_access_token
from app.services.ml_feature_extractor import extract_prediction_features
from app.services.ml_prediction_service import (
    predict_wake_up_outcome,
    get_model_pipeline_and_metadata,
    _rule_based_fallback,
)
from app.ml.train_xgboost import ALL_FEATURES, FEATURE_NUMERICAL, FEATURE_CATEGORICAL

client = TestClient(app)


def test_benchmark_dataset():
    print("[TEST 1] Verifying Synthetic Benchmark Dataset Integrity...")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(base_dir, "app", "ml", "data", "synthetic_benchmark_dataset.csv")

    assert os.path.exists(csv_path), f"Benchmark dataset not found at {csv_path}"
    df = pd.read_csv(csv_path)

    assert len(df) == 1200, f"Expected 1,200 records, got {len(df)}"
    assert "on_time_wakeup" in df.columns, "Target column 'on_time_wakeup' missing"
    assert df["on_time_wakeup"].isin([0, 1]).all(), "Target contains non-binary values"
    assert "data_provenance" in df.columns, "Column 'data_provenance' missing"
    assert (df["data_provenance"] == "SYNTHETIC_BENCHMARK_DATA").all(), "Provenance marker missing or altered"

    for feat in ALL_FEATURES:
        assert feat in df.columns, f"Required feature '{feat}' missing from dataset"

    # Confirm no null values
    assert df[ALL_FEATURES + ["on_time_wakeup"]].isnull().sum().sum() == 0, "Dataset contains null values"
    print(f"  [OK] 1,200 benchmark records verified with SYNTHETIC_BENCHMARK_DATA provenance.")


def test_model_artifact_and_metadata():
    print("[TEST 2] Verifying Model Artifact and Evaluation Metadata...")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base_dir, "app", "ml", "models", "xgb_wake_model.joblib")
    meta_path = os.path.join(base_dir, "app", "ml", "models", "model_metadata.json")

    assert os.path.exists(model_path), f"Model artifact missing at {model_path}"
    assert os.path.exists(meta_path), f"Metadata missing at {meta_path}"

    pipeline = joblib.load(model_path)
    assert pipeline is not None, "Failed to load model pipeline"
    assert hasattr(pipeline, "predict_proba"), "Pipeline lacks predict_proba method"

    with open(meta_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    assert metadata["model_version"] == "1.0.0"
    assert "XGBoost" in metadata["algorithm"]
    assert metadata["dataset_origin"] == "synthetic_circadian_benchmark"
    assert "synthetic" in metadata["dataset_notice"].lower()

    metrics = metadata["metrics"]
    assert metrics["roc_auc"] >= 0.70, f"ROC-AUC below 0.70 threshold: {metrics['roc_auc']}"
    assert metrics["precision"] >= 0.70, f"Precision below 0.70: {metrics['precision']}"
    assert metrics["recall"] >= 0.70, f"Recall below 0.70: {metrics['recall']}"
    assert metrics["brier_score"] <= 0.25, f"Brier score unexpectedly high: {metrics['brier_score']}"
    assert metrics["log_loss"] < 0.60, f"Log loss unexpectedly high: {metrics['log_loss']}"
    assert "feature_importances" in metadata and len(metadata["feature_importances"]) > 0

    print(f"  [OK] Model artifact loaded successfully.")
    print(f"  [OK] Metrics -> ROC-AUC: {metrics['roc_auc']:.4f}, Prec: {metrics['precision']:.4f}, Rec: {metrics['recall']:.4f}, Brier: {metrics['brier_score']:.4f}, Log-Loss: {metrics['log_loss']:.4f}")


def test_feature_extractor_zero_leakage():
    print("[TEST 3] Verifying Feature Extraction & Zero Data Leakage...")

    # Mock alarm object
    class MockAlarm:
        id = 99
        alarm_time = time(6, 45)
        challenge_type = "math"
        difficulty = "hard"

    class MockProfile:
        preferred_wake_time = time(7, 0)
        sleep_duration = 7

    class MockSession:
        session_status = "completed"
        snooze_count = 0
        is_correct = True
        response_time_seconds = 18.5

    df_feat = extract_prediction_features(
        alarm=MockAlarm(),
        user_profile=MockProfile(),
        past_sessions=[MockSession(), MockSession()],
        target_date=datetime(2026, 10, 5, 6, 45, tzinfo=timezone.utc),  # Monday
    )

    assert isinstance(df_feat, pd.DataFrame)
    assert len(df_feat) == 1

    # Check all required model features are present
    for col in ALL_FEATURES:
        assert col in df_feat.columns, f"Feature '{col}' missing from extractor output"

    # STRICT ZERO LEAKAGE: Ensure outcome columns are NOT present
    leakage_cols = [
        "completed_at",
        "actual_wake_time",
        "response_time_seconds",
        "snooze_count",
        "is_correct",
        "on_time_wakeup",
        "session_status",
    ]
    for col in leakage_cols:
        assert col not in df_feat.columns, f"LEAKAGE DETECTED: Column '{col}' found in prediction features!"

    # Verify cyclic sine/cosine properties
    assert -1.0 <= df_feat["sin_alarm_time"].iloc[0] <= 1.0
    assert -1.0 <= df_feat["cos_alarm_time"].iloc[0] <= 1.0

    # Cold start test: missing profile and empty sessions
    df_cold = extract_prediction_features(
        alarm=MockAlarm(),
        user_profile=None,
        past_sessions=[],
    )
    assert not df_cold.isnull().values.any(), "Cold-start feature extraction produced NaNs"
    assert df_cold["sleep_duration_hours"].iloc[0] == 8
    assert df_cold["prior_habit_score"].iloc[0] == 70.0
    print("  [OK] Zero data leakage confirmed. Cold-start resilience verified.")


def test_ml_prediction_service_logic():
    print("[TEST 4] Verifying Prediction Service Inference & Probability Ranges...")

    class MockAlarm:
        id = 1
        name = "Early Flight Alarm"
        alarm_time = time(5, 15)  # Early morning nadir
        challenge_type = "logic"
        difficulty = "hard"

    class MockProfile:
        preferred_wake_time = time(7, 30)
        sleep_duration = 6

    # 1. Pipeline inference
    result = predict_wake_up_outcome(
        alarm=MockAlarm(),
        user=None,
        user_profile=MockProfile(),
        past_sessions=[],
    )

    assert result["prediction"] in ["ON_TIME", "DELAYED_RISK"]
    assert result["prediction_source"] == "synthetic_benchmark_model"
    # Probability in range 0 to 1
    assert 0.0 <= result["on_time_probability"] <= 1.0, f"on_time_probability out of bounds: {result['on_time_probability']}"
    assert 0.0 <= result["risk_probability"] <= 1.0, f"risk_probability out of bounds: {result['risk_probability']}"
    assert abs((result["on_time_probability"] + result["risk_probability"]) - 1.0) <= 0.02
    assert result["risk_level"] in ["Low", "Moderate", "High"]
    assert isinstance(result["risk_factors"], list) and len(result["risk_factors"]) >= 1
    assert isinstance(result["recommendation"], str) and len(result["recommendation"]) > 0
    assert "disclaimer" in result and "benchmark" in result["disclaimer"].lower()

    # 2. Rule-based fallback test
    fallback = _rule_based_fallback(MockAlarm(), None, MockProfile(), None)
    assert fallback["prediction"] in ["ON_TIME", "DELAYED_RISK"]
    assert fallback["prediction_source"] == "rule_based_fallback"
    assert fallback["model_version"] == "0.0.0"
    assert 0.0 <= fallback["on_time_probability"] <= 1.0
    print(f"  [OK] Inference valid -> Prediction: {result['prediction']}, On-Time: {result['on_time_probability']:.2f}, Risk: {result['risk_probability']:.2f}")
    print(f"  [OK] Rule-based fallback verified with valid 0–1 probability ranges.")


def test_authenticated_prediction_api():
    print("[TEST 5] Verifying FastAPI Prediction Endpoints, User Isolation & Error Handling...")

    # 1. Unauthenticated 401 Check
    resp_unauth = client.get("/api/predictions/wake-up")
    assert resp_unauth.status_code == 401, f"Expected 401 for unauthenticated request, got {resp_unauth.status_code}"

    resp_unauth_alarm = client.get("/api/predictions/wake-up/1")
    assert resp_unauth_alarm.status_code == 401, f"Expected 401 for unauthenticated alarm request, got {resp_unauth_alarm.status_code}"

    db = SessionLocal()
    try:
        users = db.query(User).all()
        assert len(users) >= 2, "Test requires at least 2 users in DB for multi-tenant isolation testing"
        user_a = users[0]
        user_b = users[1]

        token_a = create_access_token(user_a.id, user_a.role)
        token_b = create_access_token(user_b.id, user_b.role)
        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 2. Model Info Endpoint
        resp_info = client.get("/api/predictions/model-info", headers=headers_a)
        assert resp_info.status_code == 200
        info_json = resp_info.json()
        assert info_json["status"] == "online"
        assert info_json["model_version"] == "1.0.0"
        assert "synthetic" in info_json["dataset_notice"].lower()

        # 3. Next/Primary Wake-Up Prediction Endpoint
        resp_pred = client.get("/api/predictions/wake-up", headers=headers_a)
        assert resp_pred.status_code == 200
        pred_json = resp_pred.json()
        assert pred_json["prediction"] in ["ON_TIME", "DELAYED_RISK"]
        assert pred_json["prediction_source"] == "synthetic_benchmark_model"
        assert 0.0 <= pred_json["on_time_probability"] <= 1.0
        assert 0.0 <= pred_json["risk_probability"] <= 1.0
        assert "risk_factors" in pred_json
        assert "recommendation" in pred_json
        assert "confidence_note" in pred_json

        # 4. Specific Alarm Prediction & Multi-Tenant User Isolation
        alarms_a = db.query(Alarm).filter(Alarm.user_id == user_a.id).all()

        if alarms_a:
            alarm_a_id = alarms_a[0].id
            # User A predicts User A's alarm -> 200 OK
            resp_a_own = client.get(f"/api/predictions/wake-up/{alarm_a_id}", headers=headers_a)
            assert resp_a_own.status_code == 200
            assert resp_a_own.json()["alarm_id"] == alarm_a_id

            # User B attempts to predict User A's alarm -> 404 NOT FOUND (Strict Isolation!)
            resp_b_cross = client.get(f"/api/predictions/wake-up/{alarm_a_id}", headers=headers_b)
            assert resp_b_cross.status_code == 404, (
                f"SECURITY VIOLATION: User B accessed User A's alarm! Code: {resp_b_cross.status_code}"
            )

        # 5. Invalid / Non-Existent Alarm Handling -> 404
        resp_invalid = client.get("/api/predictions/wake-up/999999", headers=headers_a)
        assert resp_invalid.status_code == 404, f"Expected 404 for non-existent alarm, got {resp_invalid.status_code}"

        print("  [OK] JWT Authentication validated (401 on missing token).")
        print("  [OK] Invalid alarm ID returns 404 cleanly.")
        print("  [OK] Strict multi-tenant user isolation verified (cross-tenant alarm access returns 404).")

    finally:
        db.close()


def run_all_tests():
    print("=" * 70)
    print("XGBOOST ML PIPELINE & PREDICTION VERIFICATION TEST SUITE")
    print("=" * 70)

    test_benchmark_dataset()
    test_model_artifact_and_metadata()
    test_feature_extractor_zero_leakage()
    test_ml_prediction_service_logic()
    test_authenticated_prediction_api()

    print("=" * 70)
    print("ALL ML PIPELINE & ENDPOINT TESTS PASSED SUCCESSFULLY! [OK]")
    print("=" * 70)


if __name__ == "__main__":
    run_all_tests()
