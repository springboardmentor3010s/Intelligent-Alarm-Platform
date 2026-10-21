import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
import time
from fastapi import FastAPI, Response, Request, Request
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, upgrade_habit_schema

# Import routers
from routers.user import router as user_router
from routers.habits import router as habits_router
from routers.alarms import router as alarms_router
from routers.admin import router as admin_router
from routers.challenges import router as challenges_router
from routers.coach import router as coach_router
from routers.analytics import router as analytics_router
from routers.reports import router as reports_router
from routers.notifications import router as notifications_router

# Import models so SQLAlchemy registers all tables
import Models.user
import Models.habit
import Models.alarm
import Models.challenge
import Models.coach
import Models.analytics
import Models.notification

# Initialize database tables
init_db()
upgrade_habit_schema()

app = FastAPI(
    title="Intelligent Cognitive Alarm Platform API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time-ms"] = str(round(process_time * 1000, 2))
    return response

# Include routers
app.include_router(user_router)
app.include_router(habits_router)
app.include_router(alarms_router)
app.include_router(admin_router)
app.include_router(challenges_router)
app.include_router(coach_router)
app.include_router(analytics_router)
app.include_router(reports_router)
app.include_router(notifications_router)


@app.get("/")
def home():
    return {
        "message": "Intelligent Cognitive Alarm Platform API is running",
        "status": "online",
        "milestone": 2
    }

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)