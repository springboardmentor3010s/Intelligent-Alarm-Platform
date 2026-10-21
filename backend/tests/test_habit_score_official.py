"""
test_habit_score_official.py

Unit tests verifying the official Habit Scoring formula from the specification:
  Habit Score =
    0.35 * Wake-Up Consistency
    + 0.25 * Challenge Completion Success
    + 0.20 * Snooze Reduction
    + 0.20 * Sleep Schedule Adherence
"""

import unittest
from backend.app.ai.priority_engine import (
    calculate_habit_score,
    HABIT_SCORE_WEIGHTS,
)


class TestOfficialHabitScore(unittest.TestCase):

    def test_habit_score_weights_specification(self):
        self.assertEqual(HABIT_SCORE_WEIGHTS["wake_up_consistency"], 0.35)
        self.assertEqual(HABIT_SCORE_WEIGHTS["challenge_completion_success"], 0.25)
        self.assertEqual(HABIT_SCORE_WEIGHTS["snooze_reduction"], 0.20)
        self.assertEqual(HABIT_SCORE_WEIGHTS["sleep_schedule_adherence"], 0.20)
        total_weight = sum(HABIT_SCORE_WEIGHTS.values())
        self.assertAlmostEqual(total_weight, 1.0, places=4)

    def test_perfect_score(self):
        score = calculate_habit_score(
            wake_consistency=1.0,
            challenge_completion=1.0,
            snooze_reduction=1.0,
            sleep_adherence=1.0,
        )
        self.assertEqual(score, 100.0)

    def test_zero_score(self):
        score = calculate_habit_score(
            wake_consistency=0.0,
            challenge_completion=0.0,
            snooze_reduction=0.0,
            sleep_adherence=0.0,
        )
        self.assertEqual(score, 0.0)

    def test_exact_weighted_calculation(self):
        # 0.35 * 0.8 + 0.25 * 0.6 + 0.20 * 0.9 + 0.20 * 0.7
        # = 0.280 + 0.150 + 0.180 + 0.140 = 0.750 -> 75.0
        score = calculate_habit_score(
            wake_consistency=0.8,
            challenge_completion=0.6,
            snooze_reduction=0.9,
            sleep_adherence=0.7,
        )
        self.assertEqual(score, 75.0)

    def test_clamping_out_of_bounds_inputs(self):
        # Above 1.0 should clamp to 1.0
        score_high = calculate_habit_score(
            wake_consistency=1.5,
            challenge_completion=2.0,
            snooze_reduction=1.2,
            sleep_adherence=1.1,
        )
        self.assertEqual(score_high, 100.0)

        # Below 0.0 should clamp to 0.0
        score_low = calculate_habit_score(
            wake_consistency=-0.5,
            challenge_completion=-1.0,
            snooze_reduction=-0.2,
            sleep_adherence=-0.1,
        )
        self.assertEqual(score_low, 0.0)


if __name__ == "__main__":
    unittest.main()
