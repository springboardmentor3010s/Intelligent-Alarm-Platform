import logging
from contextlib import asynccontextmanager
from app.routes.wake_up_verification import router as wake_up_verification_router
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.routes.alarms import router as alarm_router
from app.core.config import get_settings
from app.db.database import engine
from app.db.init_db import init_db
from app.routes.auth import router as auth_router
from app.routes.profile import router as profile_router
from app.routes.tracking import router as tracking_router
from app.routes.challenges import router as challenges_router
from app.routes.analytics import router as analytics_router
from app.routes.ml import router as ml_router
from app.routes.recommendations import (
    router as recommendations_router,
)
from app.routes.notifications import router as notifications_router
from app.routes.reports import router as reports_router
from app.routes.wellness import router as wellness_router
from app.routes.admin import router as admin_router
from app.routes.dashboards import router as dashboards_router
from app.services import request_metrics
import time
from fastapi import Request

logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Create missing tables and columns so a new database works at once.
    if settings.auto_create_tables:
        try:
            init_db(engine)
        except SQLAlchemyError:
            logger.exception("Could not prepare the database on startup")
    yield


app = FastAPI(
    lifespan=lifespan,
    title="Intelligent Cognitive Alarm Platform API",
    description=(
        "Backend API for cognitive alarms, challenges, "
        "habit scores and performance analytics."
    ),
    version="1.0.0",
)


# ---------------------------------------------------------
# CORS CONFIGURATION
# ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# API TIMING (feeds the admin "System performance" section)
# ---------------------------------------------------------

@app.middleware("http")
async def time_requests(request: Request, call_next):
    started = time.perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        route = request.scope.get("route")
        path = getattr(route, "path", None)
        if path and request.method != "OPTIONS":
            request_metrics.record(
                f"{request.method} {path}",
                (time.perf_counter() - started) * 1000,
                status_code,
            )


# ---------------------------------------------------------
# API ROUTERS
# ---------------------------------------------------------
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(tracking_router)
app.include_router(alarm_router)
app.include_router(challenges_router)
app.include_router(wake_up_verification_router)
app.include_router(analytics_router)
app.include_router(ml_router)
app.include_router(
    recommendations_router
)
app.include_router(notifications_router)
app.include_router(reports_router)
app.include_router(wellness_router)
app.include_router(admin_router)
app.include_router(dashboards_router)

# ---------------------------------------------------------
# ROOT ENDPOINT
# ---------------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "Intelligent Cognitive Alarm Platform API is running"
    }


# ---------------------------------------------------------
# HEALTH CHECK
# ---------------------------------------------------------

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "cognitive-alarm-backend",
        "version": "1.0.0",
    }


# ---------------------------------------------------------
# DATABASE HEALTH CHECK
# ---------------------------------------------------------

@app.get("/health/database")
def database_health_check():
    try:
        with engine.connect() as connection:
            database_name = connection.execute(
                text("SELECT current_database()")
            ).scalar_one()

        return {
            "status": "healthy",
            "database": database_name,
        }

    except SQLAlchemyError as error:
        logger.exception("Database connection failed")

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed",
        ) from error