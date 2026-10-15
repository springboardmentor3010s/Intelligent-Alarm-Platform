from app.services.verification_rules import Attempt as A
from app.services.verification_rules import evaluate


def test_puzzle():
    assert not evaluate("puzzle", [A(1, False, 2)])["satisfied"]
    assert evaluate("puzzle", [A(1, True, 2)])["satisfied"]


def test_multi_step_needs_distinct_challenges():
    assert not evaluate("multi_step", [A(1, True, 1), A(1, True, 1), A(2, True, 1)])["satisfied"]
    assert evaluate("multi_step", [A(1, True, 1), A(2, True, 1), A(3, True, 1)])["satisfied"]


def test_consecutive_resets_after_a_mistake():
    assert not evaluate("consecutive", [A(1, True, 1), A(2, True, 1), A(3, False, 1), A(4, True, 1)])["satisfied"]
    assert evaluate("consecutive", [A(1, False, 1), A(2, True, 1), A(3, True, 1), A(4, True, 1)])["satisfied"]


def test_time_based_and_accuracy():
    assert not evaluate("time_based", [A(1, True, 60)])["satisfied"]
    assert evaluate("time_based", [A(1, True, 5)])["satisfied"]
    assert not evaluate("accuracy", [A(i, i < 3, 1) for i in range(5)])["satisfied"]
    assert evaluate("accuracy", [A(i, i < 4, 1) for i in range(5)])["satisfied"]
