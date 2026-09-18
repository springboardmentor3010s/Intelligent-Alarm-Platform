# CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
"""Database session management for Intelligent Cognitive Alarm Platform."""

import os
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# Load .env early — override=True ensures .env values win over OS env vars
load_dotenv(override=True)

# Use SQLite for development/testing (file-based database)
# Change to postgresql+psycopg2://... for production
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./cerebrokognit.db",
)

# Engine configuration
if DATABASE_URL.startswith("sqlite"):
    # SQLite-specific settings
    connect_args = {"check_same_thread": False}
    echo = os.getenv("SQL_ECHO", "False").lower() in ("true", "1", "yes")
    engine = create_engine(
        DATABASE_URL,
        echo=echo,
        pool_pre_ping=True,
        connect_args=connect_args,
    )
else:
    # PostgreSQL settings
    echo = os.getenv("SQL_ECHO", "False").lower() in ("true", "1", "yes")
    engine = create_engine(
        DATABASE_URL,
        pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
        max_overflow=int(os.getenv("MAX_OVERFLOW", "10")),
        pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", "30")),
        echo=echo,
    )

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=True, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Yield a SQLAlchemy session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
