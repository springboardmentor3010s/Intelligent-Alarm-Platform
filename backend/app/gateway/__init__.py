# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""API Gateway package.

Central FastAPI-gateway responsibilities implemented here:
- request/trace ID + structured logging middleware
- rate limiting (in-memory sliding window)

The gateway implements: routing (via `app.api` routers), authentication/RBAC
(`app.api.deps`), request validation (`app.schemas`), CORS (`app.main`),
error handling (`app.main`), health checks, and OpenAPI docs (FastAPI).
"""

from .logging import configure_logging
from .middleware import GatewayMiddleware
from .security_headers import SecurityHeadersMiddleware
from .rate_limit import (
    AUTH_LIMITER,
    GLOBAL_LIMITER,
    SlidingWindowRateLimiter,
    reset_limiters,
)

__all__ = [
    "configure_logging",
    "GatewayMiddleware",
    "SecurityHeadersMiddleware",
    "AUTH_LIMITER",
    "GLOBAL_LIMITER",
    "SlidingWindowRateLimiter",
    "reset_limiters",
]
