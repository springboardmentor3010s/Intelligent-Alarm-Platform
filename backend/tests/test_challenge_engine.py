import pytest

from app.services.challenge_engine.engine import (
    CHALLENGE_TYPES,
    DIFFICULTY_LEVELS,
    challenge_engine,
)


@pytest.mark.parametrize("challenge_type", CHALLENGE_TYPES)
@pytest.mark.parametrize("difficulty", DIFFICULTY_LEVELS)
def test_every_type_and_level_generates(challenge_type, difficulty):
    for _ in range(25):
        challenge = challenge_engine.generate_challenge(challenge_type, difficulty)
        assert challenge["challenge_type"] == challenge_type
        assert challenge["difficulty"] == difficulty
        assert challenge["question"] and challenge["correct_answer"]
        if challenge["options"]:
            lowered = [o.casefold() for o in challenge["options"]]
            assert challenge["correct_answer"].casefold() in lowered


def test_unknown_values_are_rejected():
    with pytest.raises(ValueError):
        challenge_engine.generate_challenge("math", "impossible")
    with pytest.raises(ValueError):
        challenge_engine.generate_challenge("dance", "easy")


def test_math_answers_are_correct():
    import re

    for _ in range(200):
        challenge = challenge_engine.generate_challenge("math", "expert")
        expression = challenge["question"].replace("Solve:", "")
        assert re.fullmatch(r"[\d\s()+\-*]+", expression)
        assert eval(expression) == int(challenge["correct_answer"])  # noqa: S307
