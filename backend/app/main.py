from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, alarms, profile, habits, admin, challenges, analytics, ml, coach, notifications, reports, oauth
from app.core.scheduler import start_scheduler, stop_scheduler

# Schema is managed by Alembic migrations (run `alembic upgrade head` before starting the app).


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="Intelligent Cognitive Alarm Platform",
    description="Backend API for the Cognitive Alarm Platform",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(alarms.router)
app.include_router(profile.router)
app.include_router(habits.router)
app.include_router(admin.router)
app.include_router(challenges.router)
app.include_router(analytics.router)
app.include_router(ml.router)
app.include_router(coach.router)
app.include_router(notifications.router)
app.include_router(reports.router)
app.include_router(oauth.router)


@app.get("/")
def root():
    return {"message": "Intelligent Cognitive Alarm API is running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
