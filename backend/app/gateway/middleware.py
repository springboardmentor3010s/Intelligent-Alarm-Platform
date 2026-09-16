"""API Gateway middleware: request/trace IDs, rate limiting, structured logging."""

import logging
import time
import uuid
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from .rate_limit import AUTH_LIMITER, GLOBAL_LIMITER

logger = logging.getLogger("gateway")

# Path prefixes that get the tighter auth rate limit. Everything else uses the
# global limiter.
AUTH_PATH_PREFIXES = (
    "/api/v1/auth/register",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/api/v1/auth/password-reset/request",
)

# Limiter buckets keyed by (scope, client_ip).
RATE_LIMIT_SCOPES = ("auth", "global")


def _client_ip(request) -> str:
    return request.client.host if request.client else "unknown"


def _too_many_requests(request_id: str) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please slow down and try again.",
            "error_code": "ERR_RATE_LIMIT",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status_code": 429,
        },
        headers={"X-Request-ID": request_id, "Retry-After": "60"},
    )


class GatewayMiddleware(BaseHTTPMiddleware):
    """Adds X-Request-ID/X-Trace-ID, rate limits auth endpoints, and logs every
    request with duration. Uses a global sliding-window limiter for the whole
    API and a tighter one for /api/v1/auth/{register,login}."""

    async def dispatch(self, request, call_next):
        request_id = (
            request.headers.get("X-Request-ID") or request.headers.get("X-Trace-ID") or ""
        )
        if not request_id:
            request_id = uuid.uuid4().hex[:12]
        request.state.request_id = request_id

        client = _client_ip(request)
        path = request.url.path
        limit_scope = (
            "auth" if path.startswith(AUTH_PATH_PREFIXES) else "global"
        )
        limiter = AUTH_LIMITER if limit_scope == "auth" else GLOBAL_LIMITER
        if not limiter.allow(f"{limit_scope}:{client}"):
            logger.warning(
                "rate_limited request_id=%s method=%s path=%s client=%s",
                request_id,
                request.method,
                path,
                client,
            )
            return _too_many_requests(request_id)

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.exception(
                "unhandled_exception request_id=%s method=%s path=%s duration_ms=%.1f client=%s",
                request_id,
                request.method,
                path,
                duration_ms,
                client,
            )
            raise
        duration_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Trace-ID"] = request_id
        if request.method != "GET":
            logger.info(
                "request request_id=%s method=%s path=%s status=%s duration_ms=%.1f client=%s",
                request_id,
                request.method,
                path,
                response.status_code,
                duration_ms,
                client,
            )
        return response
