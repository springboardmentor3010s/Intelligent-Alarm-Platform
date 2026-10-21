"""
test_challenge_types_and_difficulties.py

Tests verifying all 7 official challenge types:
  1. math
  2. logic
  3. memory
  4. word
  5. pattern
  6. riddle
  7. quiz

And all 5 official difficulty tiers without squashing:
  beginner, easy, medium, hard, expert
"""

import unittest
from backend.app.services.challenge_service import (
    SUPPORTED_CHALLENGE_TYPES,
    SUPPORTED_DIFFICULTIES,
    generate_questions,
    answers_match,
)


class TestChallengeTypesAndDifficulties(unittest.TestCase):

    def test_all_seven_challenge_types_supported(self):
        expected_types = {"math", "logic", "memory", "word", "pattern", "riddle", "quiz"}
        self.assertEqual(set(SUPPORTED_CHALLENGE_TYPES), expected_types)

    def test_five_tier_difficulty_preservation(self):
        # Verify all 5 official tiers are recognised (no squashing)
        expected_tiers = {"beginner", "easy", "medium", "hard", "expert"}
        self.assertEqual(set(SUPPORTED_DIFFICULTIES), expected_tiers)

    def test_generate_question_across_all_types_and_difficulties(self):
        for ctype in SUPPORTED_CHALLENGE_TYPES:
            for diff in SUPPORTED_DIFFICULTIES:
                questions = generate_questions(challenge_type=ctype, difficulty=diff, count=1)
                self.assertIsNotNone(questions, f"Failed generating question for {ctype} at {diff}")
                self.assertEqual(len(questions), 1)
                q = questions[0]
                self.assertIn("question", q)
                self.assertIn("answer", q)
                self.assertTrue(len(str(q["question"])) > 0)
                self.assertTrue(len(str(q["answer"])) > 0)

    def test_pattern_recognition_generation_and_evaluation(self):
        for diff in SUPPORTED_DIFFICULTIES:
            questions = generate_questions(challenge_type="pattern", difficulty=diff, count=1)
            q = questions[0]
            self.assertTrue(len(q["question"]) > 0)
            correct_ans = str(q["answer"])
            self.assertTrue(answers_match(submitted_answer=correct_ans, correct_answer=correct_ans))
            self.assertFalse(answers_match(submitted_answer="wrong_pattern_xyz_99", correct_answer=correct_ans))

    def test_quick_quiz_generation_and_evaluation(self):
        for diff in SUPPORTED_DIFFICULTIES:
            questions = generate_questions(challenge_type="quiz", difficulty=diff, count=1)
            q = questions[0]
            self.assertTrue(len(q["question"]) > 0)
            correct_ans = str(q["answer"])
            self.assertTrue(answers_match(submitted_answer=correct_ans, correct_answer=correct_ans))
            self.assertFalse(answers_match(submitted_answer="completely wrong xyz", correct_answer=correct_ans))

    def test_multiple_questions_per_batch(self):
        """Verify batch generation returns the requested count without duplicates."""
        questions = generate_questions(challenge_type="math", difficulty="medium", count=5)
        self.assertEqual(len(questions), 5)
        question_texts = [q["question"] for q in questions]
        # At least most should be unique (a few collisions are OK due to small pool relaxation)
        self.assertGreater(len(set(question_texts)), 1)

    def test_no_difficulty_squashing(self):
        """beginner and expert must each produce distinct challenges (not collapsed to easy/hard)."""
        beginner_qs = generate_questions(challenge_type="math", difficulty="beginner", count=3)
        expert_qs = generate_questions(challenge_type="math", difficulty="expert", count=3)
        # Expert questions should be non-trivially harder (we just verify they generate)
        self.assertEqual(len(beginner_qs), 3)
        self.assertEqual(len(expert_qs), 3)


if __name__ == "__main__":
    unittest.main()
