import logging
import os

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.database.connection import Base, engine
from app.database import models
from app.utils.limiter import limiter

from app.routes.auth import router as auth_router
from app.routes.profile import router as profile_router
from app.routes.habits import router as habits_router
from app.routes.alarms import router as alarms_router
from app.routes.challenges import router as challenges_router
from app.routes.sessions import router as sessions_router
from app.routes.admin import router as admin_router
from app.routes.dashboard import router as dashboard_router
from app.routes.analytics import router as analytics_router
from app.routes.reports import router as reports_router
from app.routes.predictions import router as predictions_router
from app.routes.coach import router as coach_router
from app.routes.notifications import router as notifications_router, announcements_router
from app.database.models import User
from app.utils.dependencies import get_current_user

logger = logging.getLogger("app.main")

# Environment & Documentation toggle
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT == "production"

# In development, create missing tables automatically; in production, use Alembic migrations
if not IS_PRODUCTION:
    Base.metadata.create_all(bind=engine)

# Create FastAPI application
app = FastAPI(
    title="Intelligent Cognitive Alarm Platform",
    description="Backend API for the Intelligent Cognitive Alarm Platform",
    version="1.0.0",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

# Register rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if IS_PRODUCTION or request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# CORS configuration
allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
if allowed_origins_env:
    origins = [orig.strip() for orig in allowed_origins_env.split(",") if orig.strip()]
else:
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register routers
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(habits_router)
app.include_router(alarms_router)
app.include_router(challenges_router)
app.include_router(sessions_router)
app.include_router(admin_router)
app.include_router(dashboard_router)
app.include_router(analytics_router)
app.include_router(reports_router)
app.include_router(predictions_router)
app.include_router(coach_router)
app.include_router(notifications_router)
app.include_router(announcements_router)
# Root endpoint
@app.get("/")   
def root():
    return {
        "message": "Intelligent Cognitive Alarm API is running"
    }
# Health check
@app.get("/health")
def health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "healthy",
            "database": "connected",
        }

    except Exception as error:
        logger.error(f"Database health check error: {error}")
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": "Database connection unavailable",
        }


# Protected user endpoint
@app.get("/api/auth/me")
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
    }