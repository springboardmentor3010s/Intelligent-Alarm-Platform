# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""In-memory sliding-window rate limiter (API Gateway responsibility).

Production can swap this for a Redis-backed limiter without changing call sites.
"""

import threading
import time
from collections import defaultdict, deque


class SlidingWindowRateLimiter:
    """Thread-safe sliding-window rate limiter keyed by arbitrary string."""

    def __init__(self, max_requests: int = 60, window_seconds: float = 60.0):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        """Record a hit for `key`; return True if within the limit."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > self.window_seconds:
                hits.popleft()
            if len(hits) >= self.max_requests:
                return False
            hits.append(now)
            return True

    def reset(self, key: str | None = None) -> None:
        """Clear the limiter (all keys, or a single key when given)."""
        with self._lock:
            if key is None:
                self._hits.clear()
            else:
                self._hits.pop(key, None)


# Shared limiters used by the gateway middleware. Auth endpoints are the most
# abused surface but still generous enough for normal/dev/test flows.
GLOBAL_LIMITER = SlidingWindowRateLimiter(max_requests=300, window_seconds=60.0)
AUTH_LIMITER = SlidingWindowRateLimiter(max_requests=60, window_seconds=60.0)


def reset_limiters() -> None:
    """Clear all limiter state (used by tests for deterministic isolation)."""
    GLOBAL_LIMITER.reset()
    AUTH_LIMITER.reset()
