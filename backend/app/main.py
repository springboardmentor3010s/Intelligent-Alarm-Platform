"""Wakeful - Intelligent Cognitive Alarm Platform API."""
import logging
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.encoders import ENCODERS_BY_TYPE
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.middleware import SecurityAndLoggingMiddleware
from app import models  # noqa: F401  (registers tables)
from app.routers import admin, alarms, auth, coach, insights, notifications, oauth, reports, sleep, users, wake
from app.services import bootstrap, jobs

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

# All stored datetimes are naive UTC; mark them as UTC ('Z') so browsers don't read them as local time.
ENCODERS_BY_TYPE[datetime] = lambda d: d.isoformat() + "Z" if d.tzinfo is None else d.isoformat()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        bootstrap.ensure_admin(db)
        bootstrap.seed_demo(db)
    finally:
        db.close()
    jobs.start()
    yield
    jobs.stop()


app = FastAPI(
    title="Wakeful API", version="2.0.0", lifespan=lifespan,
    docs_url=None if settings.is_prod else "/docs", redoc_url=None, openapi_url=None if settings.is_prod else "/openapi.json",
)
app.add_middleware(SecurityAndLoggingMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=[settings.PUBLIC_URL.rstrip("/")], allow_credentials=True,
                   allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type", "X-Requested-With"])

for r in (auth.router, oauth.router, users.router, alarms.router, wake.router, sleep.router, insights.router,
          notifications.router, coach.router, admin.router, reports.router):
    app.include_router(r)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
