"""Main FastAPI application for Intelligent Cognitive Alarm Platform."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.auth import router as auth_router
from .api.alarms import router as alarms_router
from .api.challenges import router as challenges_router
from .api.habits import router as habits_router
from .api.sync import router as sync_router
from .api.dashboard import router as dashboard_router
from .api.analytics import router as analytics_router
from .api.users import router as users_router

app = FastAPI(
    title="Intelligent Cognitive Alarm Platform API",
    description="AI-powered cognitive alarm platform with adaptive difficulty and habit formation",
    version="1.0.0",
)

# CORS configuration from env (comma-separated), with a local-dev fallback
_cors_env = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173",
)
allow_origins = [origin.strip() for origin in _cors_env.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OAuth2 password bearer token for JWT authentication
# Defined in deps module and imported here for use in protected endpoints
from .api.deps import oauth2_scheme

# Include API routers
app.include_router(auth_router, prefix="/api/v1", tags=["auth"])
app.include_router(alarms_router, prefix="/api/v1", tags=["alarms"])
app.include_router(challenges_router, prefix="/api/v1", tags=["challenges"])
app.include_router(habits_router, prefix="/api/v1", tags=["habits"])
app.include_router(sync_router, prefix="/api/v1", tags=["sync"])
app.include_router(dashboard_router, prefix="/api/v1", tags=["dashboard"])
app.include_router(analytics_router, prefix="/api/v1", tags=["analytics"])
app.include_router(users_router, prefix="/api/v1", tags=["users"])


@app.get("/", include_in_schema=False)
async def root():
    return {"message": "Intelligent Cognitive Alarm Platform API is running"}


@app.get("/health", include_in_schema=False)
async def health_check():
    return {"status": "healthy"}