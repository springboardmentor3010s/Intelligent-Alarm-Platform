"""Small in-memory limiter used to slow down password guessing.

It is per process. Behind several workers or servers, move this to a shared
store such as Redis.
"""
import threading
import time
from collections import defaultdict, deque


class FailureLimiter:
    def __init__(self, max_failures: int = 5, window_seconds: int = 900):
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self._failures: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _trim(self, key: str, now: float) -> deque[float]:
        entries = self._failures[key]
        while entries and now - entries[0] > self.window_seconds:
            entries.popleft()
        return entries

    def is_blocked(self, key: str) -> bool:
        with self._lock:
            return len(self._trim(key, time.monotonic())) >= self.max_failures

    def record_failure(self, key: str) -> None:
        with self._lock:
            now = time.monotonic()
            self._trim(key, now).append(now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)


login_limiter = FailureLimiter()
