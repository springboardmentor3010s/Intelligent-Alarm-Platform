# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Phase 6: AI feature contracts — normalization, inference, fallback, gates.

Every assertion ties to `AI_FEATURES.md`: feature vectors are clamped/scaled,
the rule engine is monotonic with explanations, the synthetic-trained model is
measured (never described as production learning), fallbacks work without
torch/weights, and the baseline detectors/forecasters gate on real history.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.ai_engine import difficulty as engine
from app.ai_engine.difficulty import MLInferenceService, explain_difficulty
from app.ai_engine.features import build_rule_signals, normalize_model_features
from app.Models import Alarm, ChallengeAttempt, HabitScore
from conftest import TestingSession


@pytest.fixture(autouse=True)
def _clean_model_cache():
    MLInferenceService.reset_cache()
    yield
    MLInferenceService.reset_cache()


def _neutral_kwargs(**overrides):
    base = {
        "recent_accuracy": 0.6,
        "avg_time_seconds": 45.0,
        "snooze_frequency": 1.0,
        "failed_attempts": 0,
        "recent_difficulty": "Medium",
        "wake_up_consistency": 60.0,
    }
    base.update(overrides)
    return base


# ------------------------------------------------------------------
# Feature normalization
# ------------------------------------------------------------------

def test_model_features_scale_and_clamp():
    assert normalize_model_features(0.5, 120.0, 10, 25) == [0.5, 2.0, 2.0, 1.0]
    # Out-of-range and malformed inputs can never produce NaN/inf.
    vec = normalize_model_features(9.9, -5, 10**6, float("nan"))
    assert vec[0] == 1.0 and vec[1] == 0.0
    assert all(v == v and abs(v) != float("inf") for v in vec)
    vec = normalize_model_features(None, "fast", None, None)
    assert vec == [0.0, 0.0, 0.0, 0.0]


def test_rule_signals_default_and_sanitize():
    signals = build_rule_signals()
    assert signals["recent_difficulty"] == "Medium"
    signals = build_rule_signals(recent_difficulty="Impossible", failed_attempts=-4)
    assert signals["recent_difficulty"] == "Medium"
    assert signals["failed_attempts"] == 0


# ------------------------------------------------------------------
# Rule engine: neutral stability + per-signal monotonicity + explanations
# ------------------------------------------------------------------

def test_neutral_signals_hold_the_anchor():
    for anchor in ("Beginner", "Easy", "Medium", "Hard", "Expert"):
        out = engine._rule_based_difficulty(0.6, anchor, **_neutral_kwargs())
        assert out == anchor


def test_accuracy_monotonicity():
    levels = ["Beginner", "Easy", "Medium", "Hard", "Expert"]
    prev = -1
    for acc in (0.0, 0.2, 0.4, 0.55, 0.7, 0.9, 1.0):
        out = engine._rule_based_difficulty(acc, "Medium", **_neutral_kwargs(recent_accuracy=acc))
        assert levels.index(out) >= prev
        prev = levels.index(out)
    assert engine._rule_based_difficulty(1.0, "Medium", **_neutral_kwargs(recent_accuracy=1.0)) == "Expert"
    assert engine._rule_based_difficulty(0.0, "Medium", **_neutral_kwargs(recent_accuracy=0.0)) == "Beginner"


def test_each_worsening_signal_steps_down():
    assert engine._rule_based_difficulty(0.6, "Hard", **_neutral_kwargs(snooze_frequency=2.5)) == "Medium"
    assert engine._rule_based_difficulty(0.6, "Hard", **_neutral_kwargs(snooze_frequency=5.0)) == "Easy"
    assert engine._rule_based_difficulty(0.6, "Hard", **_neutral_kwargs(failed_attempts=2)) == "Medium"
    assert engine._rule_based_difficulty(0.6, "Hard", **_neutral_kwargs(failed_attempts=4)) == "Easy"
    assert engine._rule_based_difficulty(0.6, "Hard", **_neutral_kwargs(wake_up_consistency=10.0)) == "Medium"
    assert engine._rule_based_difficulty(0.6, "Hard", **_neutral_kwargs(avg_time_seconds=300.0)) == "Medium"
    # And improving signals step up.
    assert engine._rule_based_difficulty(0.6, "Medium", **_neutral_kwargs(snooze_frequency=0.0)) == "Hard"


def test_explanations_name_the_driving_signal():
    text = explain_difficulty(0.95, "Medium", predicted="Hard", method="rule_based_v2",
                              **_neutral_kwargs(recent_accuracy=0.95))
    assert "Hard" in text and "accuracy 95%" in text and "transparent performance rules" in text
    ml_text = explain_difficulty(0.5, "Medium", predicted="Medium", method="ml")
    assert "synthetic-trained" in ml_text


def test_legacy_bare_call_preserved():
    assert engine._rule_based_difficulty(0.9, "Medium") == "Hard"
    assert engine._rule_based_difficulty(0.1, "Medium") == "Easy"
    assert engine._rule_based_difficulty(0.5, "Medium") == "Medium"


# ------------------------------------------------------------------
# Inference + fallback
# ------------------------------------------------------------------

def test_fallback_when_weights_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(engine, "MODEL_PATH", tmp_path / "nope.pt")
    MLInferenceService.reset_cache()
    predicted, method = MLInferenceService.predict_difficulty(0.9, 20.0, 0, 5, "Medium")
    assert method == "rule_based"
    assert predicted in engine.DIFFICULTY_LABELS


def test_fallback_when_torch_missing(monkeypatch):
    monkeypatch.setattr(engine, "_torch_available", False)
    MLInferenceService.reset_cache()
    predicted, method = MLInferenceService.predict_difficulty(0.1, 200.0, 9, 0, "Hard")
    assert method == "rule_based"
    assert predicted in engine.DIFFICULTY_LABELS


def test_inference_when_model_present():
    pytest.importorskip("torch")
    assert engine.MODEL_PATH.exists(), "weights file required for the inference test"
    MLInferenceService.reset_cache()
    predicted, method = MLInferenceService.predict_difficulty(0.9, 25.0, 0, 8, "Medium")
    assert method == "ml"
    assert predicted in engine.DIFFICULTY_LABELS


def test_ml_status_contract(client, user_headers):
    body = client.get("/api/v1/analytics/ml-status", headers=user_headers).json()
    assert body["model_version"] == engine.MODEL_VERSION
    assert body["training_data"] == "synthetic"
    assert body["fallback"] == engine.FALLBACK_NAME
    assert body["fallback_available"] is True
    assert body["feature_contract"] == ["success_rate", "avg_time_minutes", "snooze_rate", "streak_norm"]
    assert body["last_training"]["model_version"] == engine.MODEL_VERSION


# ------------------------------------------------------------------
# DB-backed recommendation over measured signals
# ------------------------------------------------------------------

def _seed_attempts(user_id, specs):
    session = TestingSession()
    try:
        now = datetime.now(timezone.utc)
        for i, (completed, correct, total, seconds) in enumerate(specs):
            session.add(ChallengeAttempt(
                user_id=user_id,
                challenge_id=1,
                attempt_number=i + 1,
                completed=completed,
                correct_answers=correct,
                total_questions=total,
                start_time=now - timedelta(hours=i + 1),
                end_time=now - timedelta(hours=i + 1),
                time_taken_seconds=seconds,
                created_at=now - timedelta(hours=i + 1),
            ))
        session.commit()
    finally:
        session.close()


def test_recommend_difficulty_uses_measured_signals(client, registered_user):
    _, _, user_id, _ = registered_user
    _seed_attempts(user_id, [(True, 2, 2, 18)] * 5)

    from app.ai_engine.difficulty import recommend_difficulty

    session = TestingSession()
    try:
        predicted, method, explanation = recommend_difficulty(session, user_id, "Easy")
    finally:
        session.close()
    assert predicted in engine.DIFFICULTY_LABELS
    assert method in ("ml", "rule_based")
    assert explanation and "Easy" in explanation


def test_recommend_difficulty_without_history_holds_anchor(db):
    session = TestingSession()
    try:
        predicted, method, explanation = engine.recommend_difficulty(session, 987654321, "Hard")
    finally:
        session.close()
    assert (predicted, method) == ("Hard", "rule_based")
    assert "no answered attempts" in explanation


# ------------------------------------------------------------------
# Anomaly + forecast gates and detections
# ------------------------------------------------------------------

def _seed_scores(user_id, values):
    session = TestingSession()
    try:
        today = datetime.now(timezone.utc).date()
        for i, overall in enumerate(values):
            target = (today - timedelta(days=len(values) - 1 - i)).strftime("%Y-%m-%d")
            session.add(HabitScore(
                user_id=user_id,
                date=target,
                wake_up_consistency=overall,
                challenge_completion=overall,
                snooze_reduction=overall,
                sleep_schedule_adherence=overall,
                overall_score=overall,
            ))
        session.commit()
    finally:
        session.close()


def test_anomaly_gate_blocks_thin_history(client, registered_user):
    _, _, _, headers = registered_user
    body = client.get("/api/v1/analytics/anomalies", headers=headers).json()
    assert body["available"] is False
    assert "at least 5 scored days" in body["reason"]
    assert body["anomalies"] == []


def test_anomaly_flags_snooze_spike(client, registered_user):
    _, _, user_id, headers = registered_user
    _seed_scores(user_id, [60, 62, 61, 63, 64])
    session = TestingSession()
    try:
        session.add(Alarm(
            user_id=user_id, title="Spike", alarm_type="One-Time",
            next_trigger=datetime.now(timezone.utc), is_enabled=False, times_snoozed=5,
        ))
        session.commit()
    finally:
        session.close()

    body = client.get("/api/v1/analytics/anomalies", headers=headers).json()
    assert body["available"] is True
    assert body["method"] == "baseline"
    assert [a["type"] for a in body["anomalies"]] == ["snooze_spike"]


def test_forecast_gate_and_trend(client, registered_user):
    _, _, user_id, headers = registered_user
    assert client.get("/api/v1/analytics/forecast", headers=headers).json()["available"] is False

    _seed_scores(user_id, [40, 45, 50, 55, 60, 65, 70])
    rising = client.get("/api/v1/analytics/forecast", headers=headers).json()
    assert rising["available"] is True
    assert rising["trend"] == "improving"
    assert rising["confidence"] == "high"
    assert rising["horizon_days"] == 7
    assert rising["method"] == "baseline-linear"
    assert rising["predicted_next_week"] == 100.0


# ------------------------------------------------------------------
# Recommendations explain themselves
# ------------------------------------------------------------------

def test_recommendations_carry_reason_and_source(client, registered_user):
    _, _, user_id, headers = registered_user
    session = TestingSession()
    try:
        session.add(Alarm(
            user_id=user_id, title="Snoozy", alarm_type="Daily",
            next_trigger=datetime.now(timezone.utc), is_enabled=True, times_snoozed=4,
        ))
        session.commit()
    finally:
        session.close()

    recs = client.get("/api/v1/analytics/recommendations", headers=headers).json()
    assert len(recs) >= 1
    for rec in recs:
        assert rec["reason"], rec
        assert rec["source_metric"] and rec["source_metric"].get("key"), rec
