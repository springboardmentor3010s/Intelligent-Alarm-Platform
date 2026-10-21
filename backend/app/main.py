"""
main.py

FastAPI Application Entry Point for the
AI Intelligent Cognitive Alarm Platform.
"""

from contextlib import asynccontextmanager
from pathlib import Path
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

# Ensure project root is available in sys.path for ML modules
_proj_root = Path(__file__).resolve().parent.parent.parent
if str(_proj_root) not in sys.path:
    sys.path.insert(0, str(_proj_root))

from .database import Base, engine
from .routers import (
    auth,
    alarms,
    challenges,
    profile,
    dashboard,
    reports,
    notifications,
    users,
    ml,
    admin,
    coach,
    system_metrics,
)


# ============================================================
# CREATE DATABASE TABLES
# ============================================================

Base.metadata.create_all(bind=engine)


def _allow_automatic_coach_assignments():
    if not inspect(engine).has_table("coach_assignments"):
        return
    assigner = next(
        column for column in inspect(engine).get_columns("coach_assignments")
        if column["name"] == "assigned_by_id"
    )
    if assigner["nullable"]:
        return

    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            connection.execute(text(
                "ALTER TABLE coach_assignments "
                "ALTER COLUMN assigned_by_id DROP NOT NULL"
            ))
        return

    if engine.dialect.name == "sqlite":
        with engine.begin() as connection:
            connection.execute(text(
                "CREATE TABLE coach_assignments_new ("
                "id INTEGER NOT NULL PRIMARY KEY, "
                "coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
                "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
                "assigned_by_id INTEGER NULL REFERENCES users(id), "
                "created_at DATETIME NOT NULL, "
                "CONSTRAINT uq_coach_assignment UNIQUE (coach_id, user_id))"
            ))
            connection.execute(text(
                "INSERT INTO coach_assignments_new "
                "(id, coach_id, user_id, assigned_by_id, created_at) "
                "SELECT id, coach_id, user_id, assigned_by_id, created_at "
                "FROM coach_assignments"
            ))
            connection.execute(text("DROP TABLE coach_assignments"))
            connection.execute(text(
                "ALTER TABLE coach_assignments_new RENAME TO coach_assignments"
            ))
            connection.execute(text(
                "CREATE INDEX ix_coach_assignments_coach_id "
                "ON coach_assignments(coach_id)"
            ))
            connection.execute(text(
                "CREATE INDEX ix_coach_assignments_user_id "
                "ON coach_assignments(user_id)"
            ))
        return

    raise RuntimeError(
        "Automatic coach assignments require a nullable coach_assignments.assigned_by_id column."
    )


_allow_automatic_coach_assignments()


# ============================================================
# LIFESPAN MANAGEMENT
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist
    yield
    # Shutdown: cleanly dispose database engine connection pool
    engine.dispose()


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="AI Intelligent Cognitive Alarm Platform API",
    version="1.0.0",
    lifespan=lifespan,
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROUTERS WITH EXPLICIT PREFIX
# ============================================================

app.include_router(
    auth.router,
    prefix="/api/auth",
    tags=["Authentication"],
)

app.include_router(
    alarms.router,
    prefix="/api/alarms",
    tags=["Alarms"],
)

app.include_router(
    challenges.router,
    prefix="/api/challenges",
    tags=["Challenges"],
)


# ============================================================
# SELF-PREFIXED ROUTERS
# ============================================================

app.include_router(profile.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(notifications.router)
app.include_router(users.router)
app.include_router(ml.router)
app.include_router(admin.router)
app.include_router(coach.router)
app.include_router(system_metrics.router)


# ============================================================
# ROOT & HEALTH CHECK
# ============================================================

@app.get("/")
def root():
    return {
        "message": "AI Intelligent Cognitive Alarm Platform API is running",
        "status": "success",
        "docs_url": "/docs",
    }


@app.get("/api/health")
def health():
    db_ok = True
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        db_ok = False

    ml_ok = False
    try:
        from ml.xgboost_model import load_xgboost_model
        load_xgboost_model()
        ml_ok = True
    except Exception:
        ml_ok = False

    rl_ok = False
    try:
        from ml.reinforcement_learning import rl_agent
        rl_ok = bool(rl_agent.q_table)
    except Exception:
        rl_ok = False

    mongo_status = "active"
    try:
        from .services.mongodb_service import mongodb_service
        mongo_status = mongodb_service.get_status()["status"]
    except Exception:
        mongo_status = "fallback_file_store_active"

    return {
        "status": "healthy" if db_ok and ml_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
        "secondary_mongodb": mongo_status,
        "ml_model": "loaded" if ml_ok else "offline",
        "rl_agent": "ready" if rl_ok else "uninitialized",
        "platform": "AI Intelligent Cognitive Alarm Platform",
        "version": "1.0.0",
    }