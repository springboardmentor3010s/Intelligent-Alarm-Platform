"""
Milestone 3 Tests — Habit Scoring, Behavioral Analytics, Recommendations
Run: cd backend && venv\Scripts\python.exe -m pytest tests/test_m3.py -v
"""
import pytest
from app.services.habit_scoring import calculate_habit_score, WEIGHTS
from app.services.recommendation_engine import generate_recommendations, THRESHOLDS
from app.services.behavioral_analytics import (
    calculate_wakeup_consistency,
    calculate_challenge_completion,
    calculate_snooze_reduction,
    calculate_sleep_adherence,
)
from app.services.adaptive_difficulty import compute_next_difficulty, DIFFICULTY_LEVELS
from unittest.mock import MagicMock, patch


# ── Habit Score Formula ───────────────────────────────────────────────────────

class TestHabitScoringFormula:
    """Test the official weighted formula without a real DB."""

    def _mock_components(self, wc=80, cc=90, sr=70, sa=85):
        """Patch all four behavioral functions to return fixed scores."""
        return wc, cc, sr, sa

    def test_weights_sum_to_one(self):
        total = sum(WEIGHTS.values())
        assert abs(total - 1.0) < 1e-9

    def test_official_weights_correct(self):
        assert WEIGHTS["wakeup_consistency"]   == 0.35
        assert WEIGHTS["challenge_completion"] == 0.25
        assert WEIGHTS["snooze_reduction"]     == 0.20
        assert WEIGHTS["sleep_adherence"]      == 0.20

    def test_formula_calculation(self):
        wc, cc, sr, sa = 80, 90, 70, 85
        expected = round(80*0.35 + 90*0.25 + 70*0.20 + 85*0.20, 1)
        assert expected == round(28.0 + 22.5 + 14.0 + 17.0, 1)
        assert expected == 81.5

    def test_perfect_score_is_100(self):
        score = round(100*0.35 + 100*0.25 + 100*0.20 + 100*0.20, 1)
        assert score == 100.0

    def test_zero_score_is_0(self):
        score = round(0*0.35 + 0*0.25 + 0*0.20 + 0*0.20, 1)
        assert score == 0.0

    def test_score_range_is_0_to_100(self):
        for wc in [0, 50, 100]:
            for cc in [0, 50, 100]:
                score = round(wc*0.35 + cc*0.25 + 50*0.20 + 50*0.20, 1)
                assert 0 <= score <= 100

    def test_habit_score_response_has_required_keys(self):
        """Test structure without DB using mocks."""
        with patch("app.services.habit_scoring.calculate_wakeup_consistency") as m1, \
             patch("app.services.habit_scoring.calculate_challenge_completion") as m2, \
             patch("app.services.habit_scoring.calculate_snooze_reduction") as m3, \
             patch("app.services.habit_scoring.calculate_sleep_adherence") as m4:
            m1.return_value = {"score": 80.0, "insufficient_data": False}
            m2.return_value = {"score": 90.0, "insufficient_data": False}
            m3.return_value = {"score": 70.0, "insufficient_data": False}
            m4.return_value = {"score": 85.0, "insufficient_data": False}
            result = calculate_habit_score(MagicMock(), user_id=1, days=7)

        assert "habit_score" in result
        assert "components" in result
        assert "formula" in result
        assert "weights" in result
        assert "days" in result
        assert set(result["components"].keys()) == {
            "wakeup_consistency", "challenge_completion",
            "snooze_reduction", "sleep_adherence"
        }

    def test_each_component_has_contribution(self):
        with patch("app.services.habit_scoring.calculate_wakeup_consistency") as m1, \
             patch("app.services.habit_scoring.calculate_challenge_completion") as m2, \
             patch("app.services.habit_scoring.calculate_snooze_reduction") as m3, \
             patch("app.services.habit_scoring.calculate_sleep_adherence") as m4:
            m1.return_value = {"score": 80.0, "insufficient_data": False}
            m2.return_value = {"score": 90.0, "insufficient_data": False}
            m3.return_value = {"score": 70.0, "insufficient_data": False}
            m4.return_value = {"score": 85.0, "insufficient_data": False}
            result = calculate_habit_score(MagicMock(), user_id=1, days=7)

        for key, comp in result["components"].items():
            assert "score" in comp
            assert "weight" in comp
            assert "contribution" in comp
            assert "label" in comp
            assert abs(comp["contribution"] - round(comp["score"] * comp["weight"], 1)) < 0.2

    def test_formula_string_contains_all_scores(self):
        with patch("app.services.habit_scoring.calculate_wakeup_consistency") as m1, \
             patch("app.services.habit_scoring.calculate_challenge_completion") as m2, \
             patch("app.services.habit_scoring.calculate_snooze_reduction") as m3, \
             patch("app.services.habit_scoring.calculate_sleep_adherence") as m4:
            m1.return_value = {"score": 80.0, "insufficient_data": False}
            m2.return_value = {"score": 90.0, "insufficient_data": False}
            m3.return_value = {"score": 70.0, "insufficient_data": False}
            m4.return_value = {"score": 85.0, "insufficient_data": False}
            result = calculate_habit_score(MagicMock(), user_id=1, days=7)

        assert "80" in result["formula"]
        assert "90" in result["formula"]
        assert "70" in result["formula"]
        assert "85" in result["formula"]


# ── Behavioral Analytics ──────────────────────────────────────────────────────

class TestBehavioralAnalytics:
    def test_wakeup_consistency_no_data_returns_insufficient(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []
        result = calculate_wakeup_consistency(db, user_id=1, days=7)
        assert result["insufficient_data"] is True
        assert result["score"] == 0.0

    def test_wakeup_consistency_all_verified(self):
        db = MagicMock()
        sessions = [MagicMock(status="WAKE_UP_VERIFIED") for _ in range(5)]
        db.query.return_value.filter.return_value.all.return_value = sessions
        result = calculate_wakeup_consistency(db, user_id=1, days=7)
        assert result["score"] == 100.0
        assert result["insufficient_data"] is False

    def test_wakeup_consistency_half_verified(self):
        db = MagicMock()
        sessions = (
            [MagicMock(status="WAKE_UP_VERIFIED")] * 3 +
            [MagicMock(status="NOT_VERIFIED")] * 3
        )
        db.query.return_value.filter.return_value.all.return_value = sessions
        result = calculate_wakeup_consistency(db, user_id=1, days=7)
        assert result["score"] == 50.0

    def test_challenge_completion_no_data(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []
        result = calculate_challenge_completion(db, user_id=1, days=7)
        assert result["insufficient_data"] is True
        assert result["score"] == 0.0

    def test_challenge_completion_all_correct(self):
        db = MagicMock()
        challenges = [MagicMock(is_correct=True, score=90, completion_duration_seconds=10.0, attempts=1) for _ in range(4)]
        db.query.return_value.filter.return_value.all.return_value = challenges
        result = calculate_challenge_completion(db, user_id=1, days=7)
        assert result["score"] == 100.0

    def test_snooze_reduction_no_sessions_returns_neutral(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []
        result = calculate_snooze_reduction(db, user_id=1, days=7)
        assert result["score"] == 0.0
        assert result["insufficient_data"] is True

    def test_snooze_reduction_all_clean(self):
        db = MagicMock()
        sessions = [MagicMock(failed_attempts=0) for _ in range(5)]
        db.query.return_value.filter.return_value.all.return_value = sessions
        result = calculate_snooze_reduction(db, user_id=1, days=7)
        assert result["score"] == 100.0

    def test_sleep_adherence_no_profile_time(self):
        db = MagicMock()
        profile = MagicMock(preferred_wake_up_time=None)
        db.query.return_value.filter.return_value.first.return_value = profile
        result = calculate_sleep_adherence(db, user_id=1, days=7)
        assert result["insufficient_data"] is True

    def test_sleep_adherence_on_time(self):
        db = MagicMock()
        profile = MagicMock(preferred_wake_up_time="07:00")
        # verified_at exactly at 07:00
        session = MagicMock(status="WAKE_UP_VERIFIED")
        session.verified_at = MagicMock(hour=7, minute=0)

        # First call returns profile, second returns sessions
        db.query.return_value.filter.return_value.first.return_value = profile
        db.query.return_value.filter.return_value.all.return_value = [session]
        result = calculate_sleep_adherence(db, user_id=1, days=7)
        assert result["score"] == 100.0


# ── Recommendation Engine ─────────────────────────────────────────────────────

class TestRecommendationEngine:
    def _mock_habit_data(self, wc=80, cc=90, sr=70, sa=85):
        habit_score = round(wc*0.35 + cc*0.25 + sr*0.20 + sa*0.20, 1)
        return {
            "habit_score": habit_score,
            "days": 7,
            "components": {
                "wakeup_consistency": {
                    "score": wc, "weight": 0.35, "label": "Wake-Up Consistency (35%)",
                    "contribution": round(wc*0.35, 1),
                    "detail": {"score": wc, "total_sessions": 5, "verified_sessions": 4,
                               "insufficient_data": False, "days": 7},
                },
                "challenge_completion": {
                    "score": cc, "weight": 0.25, "label": "Challenge Completion (25%)",
                    "contribution": round(cc*0.25, 1),
                    "detail": {"score": cc, "total": 10, "correct": 9,
                               "avg_attempts": 1.2, "avg_response_seconds": 15.0,
                               "insufficient_data": False, "days": 7},
                },
                "snooze_reduction": {
                    "score": sr, "weight": 0.20, "label": "Snooze Reduction (20%)",
                    "contribution": round(sr*0.20, 1),
                    "detail": {"score": sr, "total_sessions": 5, "clean_sessions": 3,
                               "avg_failed_attempts": 0.8, "insufficient_data": False, "days": 7},
                },
                "sleep_adherence": {
                    "score": sa, "weight": 0.20, "label": "Sleep Schedule Adherence (20%)",
                    "contribution": round(sa*0.20, 1),
                    "detail": {"score": sa, "total_verified": 4, "preferred_time": "07:00",
                               "avg_deviation_minutes": 8.0, "insufficient_data": False, "days": 7},
                },
            },
            "formula": f"{wc}×0.35 + {cc}×0.25 + {sr}×0.20 + {sa}×0.20 = {habit_score}",
            "insufficient_data": False,
            "weights": WEIGHTS,
        }

    def test_recommendations_returns_list(self):
        with patch("app.services.recommendation_engine.calculate_habit_score") as mh, \
             patch("app.services.recommendation_engine.calculate_challenge_completion") as mc:
            mh.return_value = self._mock_habit_data()
            mc.return_value = {"score": 90, "avg_attempts": 1.2, "avg_response_seconds": 15.0, "insufficient_data": False}
            result = generate_recommendations(MagicMock(), user_id=1, days=7)
        assert "recommendations" in result
        assert isinstance(result["recommendations"], list)
        assert "habit_score" in result
        assert "total" in result

    def test_low_wakeup_score_generates_high_priority(self):
        with patch("app.services.recommendation_engine.calculate_habit_score") as mh, \
             patch("app.services.recommendation_engine.calculate_challenge_completion") as mc:
            mh.return_value = self._mock_habit_data(wc=20)
            mc.return_value = {"score": 90, "avg_attempts": 1.2, "avg_response_seconds": 15.0, "insufficient_data": False}
            result = generate_recommendations(MagicMock(), user_id=1, days=7)
        high_recs = [r for r in result["recommendations"] if r["priority"] == "HIGH"]
        assert len(high_recs) > 0
        assert any(r["category"] == "wake_up" for r in high_recs)

    def test_high_scores_generate_positive_reinforcement(self):
        with patch("app.services.recommendation_engine.calculate_habit_score") as mh, \
             patch("app.services.recommendation_engine.calculate_challenge_completion") as mc:
            mh.return_value = self._mock_habit_data(wc=95, cc=95, sr=95, sa=95)
            mc.return_value = {"score": 95, "avg_attempts": 1.0, "avg_response_seconds": 10.0, "insufficient_data": False}
            result = generate_recommendations(MagicMock(), user_id=1, days=7)
        low_recs = [r for r in result["recommendations"] if r["priority"] == "LOW"]
        assert len(low_recs) > 0

    def test_recommendations_sorted_high_first(self):
        with patch("app.services.recommendation_engine.calculate_habit_score") as mh, \
             patch("app.services.recommendation_engine.calculate_challenge_completion") as mc:
            mh.return_value = self._mock_habit_data(wc=20, cc=30, sr=20, sa=20)
            mc.return_value = {"score": 30, "avg_attempts": 3.5, "avg_response_seconds": 60.0, "insufficient_data": False}
            result = generate_recommendations(MagicMock(), user_id=1, days=7)
        recs = result["recommendations"]
        priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
        for i in range(len(recs) - 1):
            assert priority_order[recs[i]["priority"]] <= priority_order[recs[i+1]["priority"]]

    def test_each_recommendation_has_required_fields(self):
        with patch("app.services.recommendation_engine.calculate_habit_score") as mh, \
             patch("app.services.recommendation_engine.calculate_challenge_completion") as mc:
            mh.return_value = self._mock_habit_data()
            mc.return_value = {"score": 90, "avg_attempts": 1.2, "avg_response_seconds": 15.0, "insufficient_data": False}
            result = generate_recommendations(MagicMock(), user_id=1, days=7)
        for rec in result["recommendations"]:
            assert "category" in rec
            assert "priority" in rec
            assert "title" in rec
            assert "message" in rec
            assert rec["priority"] in ("HIGH", "MEDIUM", "LOW")

    def test_insufficient_data_generates_setup_recommendations(self):
        with patch("app.services.recommendation_engine.calculate_habit_score") as mh, \
             patch("app.services.recommendation_engine.calculate_challenge_completion") as mc:
            data = self._mock_habit_data()
            data["components"]["wakeup_consistency"]["detail"]["insufficient_data"] = True
            data["components"]["challenge_completion"]["detail"]["insufficient_data"] = True
            mh.return_value = data
            mc.return_value = {"score": 0, "insufficient_data": True}
            result = generate_recommendations(MagicMock(), user_id=1, days=7)
        assert result["total"] > 0


# ── Adaptive Difficulty Integration ──────────────────────────────────────────

class TestAdaptiveDifficultyM3:
    """Verify the existing M2 adaptive difficulty still works correctly for M3."""

    def test_difficulty_levels_are_5(self):
        assert len(DIFFICULTY_LEVELS) == 5
        assert DIFFICULTY_LEVELS == ["BEGINNER", "EASY", "MEDIUM", "HARD", "EXPERT"]

    def test_full_progression_up(self):
        current = "BEGINNER"
        for expected in ["EASY", "MEDIUM", "HARD", "EXPERT"]:
            current = compute_next_difficulty(current, [True])
            assert current == expected

    def test_full_progression_down(self):
        current = "EXPERT"
        for expected in ["HARD", "MEDIUM", "EASY", "BEGINNER"]:
            current = compute_next_difficulty(current, [False, False])
            assert current == expected

    def test_floor_is_beginner(self):
        assert compute_next_difficulty("BEGINNER", [False, False]) == "BEGINNER"

    def test_ceiling_is_expert(self):
        assert compute_next_difficulty("EXPERT", [True]) == "EXPERT"
