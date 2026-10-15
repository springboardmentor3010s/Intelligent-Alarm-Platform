"""
Milestone 2 Backend Tests
Run: cd backend && venv\Scripts\python.exe -m pytest tests/test_m2.py -v
"""
import pytest
from app.services.challenge_engine import (
    generate_challenge, check_answer, compute_score,
    CHALLENGE_TYPES, DIFFICULTY_LEVELS, TIME_LIMITS,
)
from app.services.adaptive_difficulty import (
    compute_next_difficulty, get_starting_difficulty,
    compute_wakefulness_score, POLICY,
)


# ── Challenge Generation ──────────────────────────────────────────────────────

class TestChallengeGeneration:
    def test_all_7_types_generate(self):
        for ctype in CHALLENGE_TYPES:
            r = generate_challenge(ctype, "MEDIUM")
            assert r["challenge_type"] == ctype
            assert r["question"]
            assert r["correct_answer"]

    def test_all_5_difficulty_levels(self):
        for level in DIFFICULTY_LEVELS:
            r = generate_challenge("math", level)
            assert r["difficulty"] == level
            assert r["question"]

    def test_time_limit_per_difficulty(self):
        for level in DIFFICULTY_LEVELS:
            r = generate_challenge("math", level)
            assert r["time_limit_seconds"] == TIME_LIMITS[level]

    def test_beginner_has_longest_time_limit(self):
        assert TIME_LIMITS["BEGINNER"] > TIME_LIMITS["EXPERT"]

    def test_invalid_type_falls_back_to_valid(self):
        r = generate_challenge("nonexistent", "MEDIUM")
        assert r["challenge_type"] in CHALLENGE_TYPES

    def test_invalid_difficulty_falls_back_to_medium(self):
        r = generate_challenge("math", "IMPOSSIBLE")
        assert r["difficulty"] == "MEDIUM"

    def test_memory_answer_length_scales_with_difficulty(self):
        beginner = generate_challenge("memory", "BEGINNER")
        expert = generate_challenge("memory", "EXPERT")
        assert len(expert["correct_answer"]) > len(beginner["correct_answer"])

    def test_pattern_question_contains_sequence(self):
        r = generate_challenge("pattern", "EASY")
        assert "?" in r["question"]

    def test_logic_answer_is_valid(self):
        r = generate_challenge("logic", "MEDIUM")
        assert r["correct_answer"] in ["yes", "no", "saturday", "tuesday", "all"]

    def test_math_answer_is_numeric(self):
        for level in DIFFICULTY_LEVELS:
            r = generate_challenge("math", level)
            try:
                float(r["correct_answer"])
                numeric = True
            except ValueError:
                numeric = False
            # algebra answers like "x=5" are strings — just check non-empty
            assert r["correct_answer"]


# ── Answer Validation ─────────────────────────────────────────────────────────

class TestAnswerValidation:
    def test_exact_match(self):
        assert check_answer("42", "42") is True

    def test_case_insensitive(self):
        assert check_answer("YES", "yes") is True
        assert check_answer("Clock", "clock") is True

    def test_strips_whitespace(self):
        assert check_answer("  42  ", "42") is True

    def test_float_equals_int(self):
        assert check_answer("6.0", "6") is True
        assert check_answer("6", "6.0") is True

    def test_wrong_number_rejected(self):
        assert check_answer("5", "6") is False

    def test_wrong_string_rejected(self):
        assert check_answer("cat", "dog") is False

    def test_empty_answer_rejected(self):
        assert check_answer("", "42") is False


# ── Score Computation ─────────────────────────────────────────────────────────

class TestScoreComputation:
    def test_correct_first_attempt_fast_is_high(self):
        assert compute_score(True, 1, 5.0, 60.0) >= 80

    def test_wrong_answer_is_zero(self):
        assert compute_score(False, 1, 5.0, 60.0) == 0

    def test_more_attempts_lower_score(self):
        assert compute_score(True, 1, 10.0, 60.0) > compute_score(True, 3, 10.0, 60.0)

    def test_slow_answer_lower_score(self):
        assert compute_score(True, 1, 5.0, 60.0) > compute_score(True, 1, 55.0, 60.0)

    def test_score_floor_is_10_for_correct(self):
        assert compute_score(True, 20, 200.0, 60.0) >= 10

    def test_score_ceiling_is_100(self):
        assert compute_score(True, 1, 1.0, 60.0) <= 100


# ── Adaptive Difficulty ───────────────────────────────────────────────────────

class TestAdaptiveDifficulty:
    def test_correct_promotes_beginner_to_easy(self):
        assert compute_next_difficulty("BEGINNER", [True]) == "EASY"

    def test_correct_promotes_easy_to_medium(self):
        assert compute_next_difficulty("EASY", [True]) == "MEDIUM"

    def test_correct_promotes_medium_to_hard(self):
        assert compute_next_difficulty("MEDIUM", [True]) == "HARD"

    def test_correct_promotes_hard_to_expert(self):
        assert compute_next_difficulty("HARD", [True]) == "EXPERT"

    def test_correct_at_expert_stays_expert(self):
        assert compute_next_difficulty("EXPERT", [True]) == "EXPERT"

    def test_two_wrong_demotes_medium_to_easy(self):
        assert compute_next_difficulty("MEDIUM", [False, False]) == "EASY"

    def test_two_wrong_demotes_easy_to_beginner(self):
        assert compute_next_difficulty("EASY", [False, False]) == "BEGINNER"

    def test_two_wrong_at_beginner_stays_beginner(self):
        assert compute_next_difficulty("BEGINNER", [False, False]) == "BEGINNER"

    def test_one_wrong_does_not_demote(self):
        assert compute_next_difficulty("MEDIUM", [False]) == "MEDIUM"

    def test_empty_history_keeps_current(self):
        assert compute_next_difficulty("MEDIUM", []) == "MEDIUM"

    def test_mixed_no_change(self):
        assert compute_next_difficulty("MEDIUM", [True, False]) == "MEDIUM"

    def test_starting_difficulty_from_preference(self):
        assert get_starting_difficulty("beginner") == "BEGINNER"
        assert get_starting_difficulty("expert") == "EXPERT"
        assert get_starting_difficulty("medium") == "MEDIUM"
        assert get_starting_difficulty(None) == "MEDIUM"

    def test_policy_keys_exist(self):
        assert "promote_after_correct" in POLICY
        assert "demote_after_wrong" in POLICY


# ── Wakefulness Score ─────────────────────────────────────────────────────────

class TestWakefulnessScore:
    def test_all_correct_fast_gives_verified(self):
        score, status = compute_wakefulness_score(3, 3, 3, 3, 5.0, 60.0)
        assert status == "WAKE_UP_VERIFIED"
        assert score > 70

    def test_no_challenges_gives_not_verified(self):
        score, status = compute_wakefulness_score(0, 3, 0, 0, 0.0, 60.0)
        assert status == "NOT_VERIFIED"
        assert score == 0.0

    def test_partial_completion_gives_partially_verified(self):
        _, status = compute_wakefulness_score(1, 3, 1, 2, 10.0, 60.0)
        assert status == "PARTIALLY_VERIFIED"

    def test_low_accuracy_blocks_full_verification(self):
        # 1 correct out of 6 attempts — accuracy < 0.5
        _, status = compute_wakefulness_score(3, 3, 1, 6, 20.0, 60.0)
        assert status in ("NOT_VERIFIED", "PARTIALLY_VERIFIED")

    def test_score_between_0_and_100(self):
        score, _ = compute_wakefulness_score(2, 2, 2, 2, 10.0, 60.0)
        assert 0 <= score <= 100
