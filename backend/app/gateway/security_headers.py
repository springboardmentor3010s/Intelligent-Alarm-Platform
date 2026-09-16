"""Security headers middleware (Phase 2).

Sets standard security headers on every response.  HSTS is only emitted in
production to avoid browser warnings on local HTTP.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from ..core.config import is_production


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        headers = response.headers

        # Prevent MIME-type sniffing
        headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking
        headers["X-Frame-Options"] = "DENY"

        # Basic content-security-policy (allow self; adjust if CDN assets are added)
        headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none'"

        # Prevent referrer leakage
        headers["Referrer-Policy"] = "no-referrer"

        # Block cross-domain plugin access
        headers["X-Permitted-Cross-Domain-Policies"] = "none"

        # Strict-Transport-Security (production only; local HTTP causes warnings)
        if is_production():
            headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"

        return response
