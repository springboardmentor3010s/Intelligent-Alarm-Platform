"""Main FastAPI application for Intelligent Cognitive Alarm Platform."""

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .api.auth import router as auth_router
from .api.alarms import router as alarms_router
from .api.challenges import router as challenges_router
from .api.habits import router as habits_router
from .api.sync import router as sync_router
from .api.dashboard import router as dashboard_router
from .api.analytics import router as analytics_router
from .api.users import router as users_router
from .api.notifications import router as notifications_router
from .api.feedback import router as feedback_router
from .gateway import GatewayMiddleware, SecurityHeadersMiddleware, configure_logging
from .services.bootstrap import bootstrap_local_db
from .core.config import get_cors_origins


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Local mode only (SQLite, no DATABASE_URL): auto-create tables + seed so the
    # app runs fully self-contained with no database server. Postgres (Docker/cloud)
    # is left to `alembic upgrade head` and is never modified here.
    bootstrap_local_db()
    yield


configure_logging()

app = FastAPI(
    title="Intelligent Cognitive Alarm Platform API",
    description="AI-powered cognitive alarm platform with adaptive difficulty and habit formation",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration from env (comma-separated). The allowlist is explicit:
# production fails fast on an empty list and a wildcard is never used.
allow_origins = get_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gateway middleware: request/trace IDs, rate limiting, structured logging.
app.add_middleware(GatewayMiddleware)

# Security headers: added last so Starlette places it outermost (sets headers
# after all other middleware has finished processing).
app.add_middleware(SecurityHeadersMiddleware)

# OAuth2 password bearer token for JWT authentication
# Defined in deps module and imported here for use in protected endpoints

# Include API routers
app.include_router(auth_router, prefix="/api/v1", tags=["auth"])
app.include_router(alarms_router, prefix="/api/v1", tags=["alarms"])
app.include_router(challenges_router, prefix="/api/v1", tags=["challenges"])
app.include_router(habits_router, prefix="/api/v1", tags=["habits"])
app.include_router(sync_router, prefix="/api/v1", tags=["sync"])
app.include_router(dashboard_router, prefix="/api/v1", tags=["dashboard"])
app.include_router(analytics_router, prefix="/api/v1", tags=["analytics"])
app.include_router(users_router, prefix="/api/v1", tags=["users"])
app.include_router(notifications_router, prefix="/api/v1", tags=["notifications"])
app.include_router(feedback_router, prefix="/api/v1", tags=["feedback"])

# ---------------------------------------------------------------------------
# Structured error envelope (Level 8): {detail, error_code, timestamp}
# `detail` is preserved from the original exception for backward compatibility,
# so existing clients (web/mobile) and smoke assertions keep working.
# ---------------------------------------------------------------------------


def _error_body(detail, error_code, status):
    return {
        "detail": detail,
        "error_code": error_code,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status_code": status,
    }


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(str(exc.detail), f"ERR_{exc.status_code}", exc.status_code),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=_error_body("Request validation failed", "ERR_VALIDATION", 422),
    )


@app.get("/", include_in_schema=False)
async def root():
    return {"message": "Intelligent Cognitive Alarm Platform API is running"}


@app.get("/health", include_in_schema=False)
async def health_check():
    return {"status": "healthy"}
