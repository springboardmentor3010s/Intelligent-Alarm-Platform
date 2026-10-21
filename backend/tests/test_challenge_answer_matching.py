import unittest

from app.services.challenge_service import answers_match


class ChallengeAnswerMatchingTests(unittest.TestCase):
    def test_numeric_answers_match_when_equivalent(self):
        self.assertTrue(answers_match("180", "180.0"))
        self.assertTrue(answers_match("4.5", "4.50"))
        self.assertTrue(answers_match("APPLE", "apple"))

    def test_common_answer_formatting_still_matches(self):
        self.assertTrue(answers_match(" clock. ", "clock"))
        self.assertTrue(answers_match("APPLE!", "apple"))
        self.assertTrue(answers_match(" 1,200 ", "1200"))

    def test_non_numeric_answers_still_require_exact_match(self):
        self.assertFalse(answers_match("clock", "time"))


if __name__ == "__main__":
    unittest.main()
