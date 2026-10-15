"""
Unit tests for Milestone 3 — Phase 2: Core Intelligence Services.

Tests:
1. Habit Scorer Engine (Formula, Clamping, Weights, Missing Data)
2. Behavioral Metrics Extractor
3. Recommendation Engine (Thresholds, Priority, Categories, Multi-rule)
4. Adaptive Difficulty Service (History Window, Accuracy Thresholds, Boundaries)
"""

import sys
import os
from datetime import datetime, time
from types import SimpleNamespace

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.habit_scorer import (
    calculate_habit_score,
    compute_behavioral_metrics,
    evaluate_user_habit,
    WEIGHT_WAKE_UP_CONSISTENCY,
    WEIGHT_CHALLENGE_COMPLETION,
    WEIGHT_SNOOZE_REDUCTION,
    WEIGHT_SLEEP_SCHEDULE_ADHERENCE,
)
from app.services.recommendation_engine import (
    generate_recommendations,
    THRESHOLD_SNOOZE_ALERT,
    THRESHOLD_CONSISTENCY_ALERT,
    THRESHOLD_CHALLENGE_LOW,
    THRESHOLD_CHALLENGE_HIGH,
    THRESHOLD_HABIT_MASTERY,
)
from app.services.adaptive_service import (
    get_next_difficulty,
    calculate_adaptive_difficulty_from_sessions,
)


def test_habit_scorer_weights():
    """Verify exact formula weights conform to specification."""
    total_weight = (
        WEIGHT_WAKE_UP_CONSISTENCY
        + WEIGHT_CHALLENGE_COMPLETION
        + WEIGHT_SNOOZE_REDUCTION
        + WEIGHT_SLEEP_SCHEDULE_ADHERENCE
    )
    assert round(total_weight, 2) == 1.0, f"Weights must sum to 1.0, got {total_weight}"
    assert WEIGHT_WAKE_UP_CONSISTENCY == 0.35
    assert WEIGHT_CHALLENGE_COMPLETION == 0.25
    assert WEIGHT_SNOOZE_REDUCTION == 0.20
    assert WEIGHT_SLEEP_SCHEDULE_ADHERENCE == 0.20
    print("[PASS] test_habit_scorer_weights")


def test_habit_scorer_perfect_metrics():
    """Verify that perfect metrics (all 100) yield an overall score of 100.0."""
    result = calculate_habit_score(100.0, 100.0, 100.0, 100.0)
    assert result["overall_habit_score"] == 100.0
    assert result["wake_up_consistency"] == 100.0
    assert result["challenge_completion"] == 100.0
    assert result["snooze_reduction"] == 100.0
    assert result["sleep_schedule_adherence"] == 100.0
    print("[PASS] test_habit_scorer_perfect_metrics")


def test_habit_scorer_zero_metrics():
    """Verify that zero metrics yield an overall score of 0.0."""
    result = calculate_habit_score(0.0, 0.0, 0.0, 0.0)
    assert result["overall_habit_score"] == 0.0
    print("[PASS] test_habit_scorer_zero_metrics")


def test_habit_scorer_mixed_metrics():
    """Verify weighted calculation for mixed inputs."""
    # 0.35*80 + 0.25*90 + 0.20*60 + 0.20*70 = 28 + 22.5 + 12 + 14 = 76.5
    result = calculate_habit_score(
        wake_up_consistency=80.0,
        challenge_completion=90.0,
        snooze_reduction=60.0,
        sleep_schedule_adherence=70.0,
    )
    assert result["overall_habit_score"] == 76.5
    print("[PASS] test_habit_scorer_mixed_metrics")


def test_habit_scorer_clamping():
    """Verify scores outside 0-100 are strictly clamped."""
    result = calculate_habit_score(-20.0, 150.0, -5.0, 120.0)
    assert result["wake_up_consistency"] == 0.0
    assert result["challenge_completion"] == 100.0
    assert result["snooze_reduction"] == 0.0
    assert result["sleep_schedule_adherence"] == 100.0
    # 0.35*0 + 0.25*100 + 0.20*0 + 0.20*100 = 25 + 20 = 45.0
    assert result["overall_habit_score"] == 45.0
    print("[PASS] test_habit_scorer_clamping")


def test_habit_scorer_empty_sessions():
    """Verify safe fallback when no sessions exist."""
    metrics = compute_behavioral_metrics([])
    assert metrics["total_sessions"] == 0
    assert 0 <= metrics["overall_habit_score"] if "overall_habit_score" in metrics else True
    evaluated = evaluate_user_habit([])
    assert evaluated["total_sessions"] == 0
    assert 0 <= evaluated["overall_habit_score"] <= 100
    print("[PASS] test_habit_scorer_empty_sessions")


def test_behavioral_metrics_calculation():
    """Verify extraction of metrics from mock session objects."""
    # Mock sessions: 4 sessions, 3 correct, avg snooze = 1.0 (4 total snoozes)
    mock_sessions = [
        SimpleNamespace(
            started_at=datetime(2026, 9, 19, 7, 2),
            completed_at=datetime(2026, 9, 19, 7, 3),
            session_status="completed",
            is_correct=True,
            snooze_count=1,
            response_time_seconds=25,
            alarm=SimpleNamespace(alarm_time=time(7, 0)),
        ),
        SimpleNamespace(
            started_at=datetime(2026, 9, 18, 7, 1),
            completed_at=datetime(2026, 9, 18, 7, 2),
            session_status="completed",
            is_correct=True,
            snooze_count=0,
            response_time_seconds=20,
            alarm=SimpleNamespace(alarm_time=time(7, 0)),
        ),
        SimpleNamespace(
            started_at=datetime(2026, 9, 17, 7, 5),
            completed_at=datetime(2026, 9, 17, 7, 6),
            session_status="completed",
            is_correct=False,
            snooze_count=2,
            response_time_seconds=45,
            alarm=SimpleNamespace(alarm_time=time(7, 0)),
        ),
        SimpleNamespace(
            started_at=datetime(2026, 9, 16, 7, 0),
            completed_at=datetime(2026, 9, 16, 7, 1),
            session_status="completed",
            is_correct=True,
            snooze_count=1,
            response_time_seconds=15,
            alarm=SimpleNamespace(alarm_time=time(7, 0)),
        ),
    ]
    mock_profile = SimpleNamespace(preferred_wake_time=time(7, 0))

    metrics = compute_behavioral_metrics(mock_sessions, user_profile=mock_profile)
    assert metrics["total_sessions"] == 4
    # 3 correct out of 4 = 75.0%
    assert metrics["challenge_completion"] == 75.0
    # 4 snoozes / 4 = 1.0 avg snooze -> 100 - (1.0 * 25) = 75.0
    assert metrics["snooze_reduction"] == 75.0
    # Sessions all within 5 minutes of alarm -> 100 consistency
    assert metrics["wake_up_consistency"] == 100.0
    # Sessions all within 15 minutes of profile -> 100 adherence
    assert metrics["sleep_schedule_adherence"] == 100.0

    eval_result = evaluate_user_habit(mock_sessions, user_profile=mock_profile)
    # Expected: 0.35*100 + 0.25*75 + 0.20*75 + 0.20*100 = 35 + 18.75 + 15 + 20 = 88.75
    assert eval_result["overall_habit_score"] == 88.75
    print("[PASS] test_behavioral_metrics_calculation")


def test_recommendation_high_snooze():
    """Verify recommendation generated for high snooze behavior."""
    habit_data = {
        "total_sessions": 5,
        "snooze_reduction": 45.0,  # Below threshold 70
        "avg_snooze_count": 2.2,
        "wake_up_consistency": 85.0,
        "challenge_completion": 80.0,
        "sleep_schedule_adherence": 80.0,
        "overall_habit_score": 75.0,
    }
    recs = generate_recommendations(habit_data)
    categories = [r["category"] for r in recs]
    assert "wake_up_optimization" in categories
    snooze_rec = next(r for r in recs if r["category"] == "wake_up_optimization")
    assert snooze_rec["priority"] == "high"
    print("[PASS] test_recommendation_high_snooze")


def test_recommendation_low_consistency():
    """Verify recommendation generated for low wake-up consistency."""
    habit_data = {
        "total_sessions": 5,
        "wake_up_consistency": 55.0,  # Below threshold 65
        "challenge_completion": 80.0,
        "snooze_reduction": 90.0,
        "sleep_schedule_adherence": 80.0,
        "overall_habit_score": 72.0,
    }
    recs = generate_recommendations(habit_data)
    categories = [r["category"] for r in recs]
    assert "habit_improvement" in categories
    cons_rec = next(r for r in recs if r["category"] == "habit_improvement")
    assert cons_rec["priority"] == "high"
    print("[PASS] test_recommendation_low_consistency")


def test_recommendation_low_challenge_accuracy():
    """Verify recommendation for low challenge accuracy proposes difficulty easing."""
    habit_data = {
        "total_sessions": 4,
        "challenge_completion": 40.0,  # Below threshold 60
        "wake_up_consistency": 80.0,
        "snooze_reduction": 90.0,
        "sleep_schedule_adherence": 80.0,
        "overall_habit_score": 68.0,
    }
    recs = generate_recommendations(habit_data)
    categories = [r["category"] for r in recs]
    assert "challenge_recommendation" in categories
    ch_rec = next(r for r in recs if r["category"] == "challenge_recommendation")
    assert "Beginner" in ch_rec["message"] or "Easy" in ch_rec["message"]
    print("[PASS] test_recommendation_low_challenge_accuracy")


def test_recommendation_strong_performance():
    """Verify recommendation for high performance prompts challenge upgrade & productivity."""
    habit_data = {
        "total_sessions": 6,
        "challenge_completion": 95.0,
        "wake_up_consistency": 90.0,
        "snooze_reduction": 95.0,
        "sleep_schedule_adherence": 90.0,
        "overall_habit_score": 92.5,
    }
    recs = generate_recommendations(habit_data)
    categories = [r["category"] for r in recs]
    assert "challenge_recommendation" in categories
    assert "productivity" in categories
    ch_rec = next(r for r in recs if r["category"] == "challenge_recommendation")
    assert "Hard" in ch_rec["message"] or "Expert" in ch_rec["message"]
    print("[PASS] test_recommendation_strong_performance")


def test_recommendation_multiple_conditions():
    """Verify engine handles multiple simultaneous alerts gracefully."""
    habit_data = {
        "total_sessions": 5,
        "wake_up_consistency": 50.0,      # alert
        "challenge_completion": 45.0,     # alert
        "snooze_reduction": 40.0,         # alert
        "sleep_schedule_adherence": 50.0, # alert
        "overall_habit_score": 46.75,
    }
    recs = generate_recommendations(habit_data)
    assert len(recs) >= 4
    categories = {r["category"] for r in recs}
    assert "wake_up_optimization" in categories
    assert "habit_improvement" in categories
    assert "challenge_recommendation" in categories
    assert "sleep_improvement" in categories
    print("[PASS] test_recommendation_multiple_conditions")


def test_adaptive_difficulty_no_history():
    """Verify adaptive service maintains difficulty when no history is provided."""
    result = calculate_adaptive_difficulty_from_sessions("medium", [])
    assert result["current_difficulty"] == "medium"
    assert result["recommended_difficulty"] == "medium"
    assert result["adjusted"] is False
    assert result["sample_size"] == 0
    print("[PASS] test_adaptive_difficulty_no_history")


def test_adaptive_difficulty_promotion():
    """Verify promotion from medium to hard when recent sessions are correct."""
    sessions = [
        SimpleNamespace(is_correct=True),
        SimpleNamespace(is_correct=True),
        SimpleNamespace(is_correct=True),
    ]
    result = calculate_adaptive_difficulty_from_sessions("medium", sessions)
    assert result["current_difficulty"] == "medium"
    assert result["recommended_difficulty"] == "hard"
    assert result["adjusted"] is True
    assert result["performance"]["accuracy"] == 100.0
    print("[PASS] test_adaptive_difficulty_promotion")


def test_adaptive_difficulty_demotion():
    """Verify demotion from hard to medium when recent sessions are incorrect."""
    sessions = [
        SimpleNamespace(is_correct=False),
        SimpleNamespace(is_correct=False),
        SimpleNamespace(is_correct=True),
    ]
    # 1/3 = 33.33% accuracy (<= 40%)
    result = calculate_adaptive_difficulty_from_sessions("hard", sessions)
    assert result["current_difficulty"] == "hard"
    assert result["recommended_difficulty"] == "medium"
    assert result["adjusted"] is True
    print("[PASS] test_adaptive_difficulty_demotion")


def test_adaptive_difficulty_boundaries():
    """Verify boundary conditions for beginner and expert."""
    # Expert cannot promote further
    high_sessions = [SimpleNamespace(is_correct=True), SimpleNamespace(is_correct=True)]
    expert_result = calculate_adaptive_difficulty_from_sessions("expert", high_sessions)
    assert expert_result["recommended_difficulty"] == "expert"
    assert expert_result["adjusted"] is False

    # Beginner cannot demote further
    low_sessions = [SimpleNamespace(is_correct=False), SimpleNamespace(is_correct=False)]
    beg_result = calculate_adaptive_difficulty_from_sessions("beginner", low_sessions)
    assert beg_result["recommended_difficulty"] == "beginner"
    assert beg_result["adjusted"] is False
    print("[PASS] test_adaptive_difficulty_boundaries")


def test_adaptive_difficulty_window():
    """Verify adaptive service honors window_size (evaluates only recent N)."""
    # 4 old incorrect answers, followed by 3 recent correct answers
    sessions = [
        SimpleNamespace(is_correct=False),
        SimpleNamespace(is_correct=False),
        SimpleNamespace(is_correct=False),
        SimpleNamespace(is_correct=False),
        SimpleNamespace(is_correct=True),
        SimpleNamespace(is_correct=True),
        SimpleNamespace(is_correct=True),
    ]
    # If window_size=3, only the last 3 (100% correct) are considered
    result = calculate_adaptive_difficulty_from_sessions("easy", sessions, window_size=3)
    assert result["sample_size"] == 3
    assert result["performance"]["accuracy"] == 100.0
    assert result["recommended_difficulty"] == "medium"
    print("[PASS] test_adaptive_difficulty_window")


def run_all_tests():
    print("==================================================")
    print("RUNNING PHASE 2 UNIT TESTS")
    print("==================================================")
    test_habit_scorer_weights()
    test_habit_scorer_perfect_metrics()
    test_habit_scorer_zero_metrics()
    test_habit_scorer_mixed_metrics()
    test_habit_scorer_clamping()
    test_habit_scorer_empty_sessions()
    test_behavioral_metrics_calculation()
    test_recommendation_high_snooze()
    test_recommendation_low_consistency()
    test_recommendation_low_challenge_accuracy()
    test_recommendation_strong_performance()
    test_recommendation_multiple_conditions()
    test_adaptive_difficulty_no_history()
    test_adaptive_difficulty_promotion()
    test_adaptive_difficulty_demotion()
    test_adaptive_difficulty_boundaries()
    test_adaptive_difficulty_window()
    print("==================================================")
    print("ALL 16 PHASE 2 UNIT TESTS PASSED SUCCESSFULLY!")
    print("==================================================")


if __name__ == "__main__":
    run_all_tests()
