from app.core.rate_limit import FailureLimiter


def test_blocks_after_max_failures_and_resets():
    limiter = FailureLimiter(max_failures=3, window_seconds=60)
    for _ in range(3):
        assert not limiter.is_blocked("a")
        limiter.record_failure("a")
    assert limiter.is_blocked("a")
    assert not limiter.is_blocked("b")
    limiter.reset("a")
    assert not limiter.is_blocked("a")
