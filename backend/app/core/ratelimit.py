"""Small in-memory sliding-window rate limiter (single-process deployment)."""
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.core.config import settings

_hits: dict[str, deque] = defaultdict(deque)


def client_ip(request: Request) -> str:
    # nginx overwrites X-Real-IP; the backend port is not published to the host.
    return request.headers.get("x-real-ip") or (request.client.host if request.client else "unknown")


def limit(name: str, max_calls: int, per_seconds: int):
    def dependency(request: Request):
        if settings.ENV == "test":
            return
        key = f"{name}:{client_ip(request)}"
        now = time.monotonic()
        q = _hits[key]
        while q and now - q[0] > per_seconds:
            q.popleft()
        if len(q) >= max_calls:
            raise HTTPException(status_code=429, detail="Too many requests. Please slow down and try again shortly.")
        q.append(now)
    return dependency
