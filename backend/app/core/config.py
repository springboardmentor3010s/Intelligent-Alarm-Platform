import os
from dotenv import load_dotenv

load_dotenv()

_DATABASE_URL = os.getenv("DATABASE_URL")
if not _DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Configure a PostgreSQL connection string in .env "
        "(e.g. postgresql://user:password@localhost:5432/dbname) — no in-memory/SQLite fallback is supported."
    )
if _DATABASE_URL.startswith("sqlite"):
    raise RuntimeError("SQLite is not supported. DATABASE_URL must point to a PostgreSQL database.")

class Settings:
    DATABASE_URL: str = _DATABASE_URL
    SECRET_KEY: str = os.getenv("SECRET_KEY", "fallback-secret-key")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    # Frontend base URL — OAuth callbacks redirect here after login
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # Google OAuth2 (console.cloud.google.com → APIs & Services → Credentials)
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8080/auth/oauth/google/callback")

    # GitHub OAuth2 (github.com/settings/developers → OAuth Apps)
    GITHUB_CLIENT_ID: str = os.getenv("GITHUB_CLIENT_ID", "")
    GITHUB_CLIENT_SECRET: str = os.getenv("GITHUB_CLIENT_SECRET", "")
    GITHUB_REDIRECT_URI: str = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:8080/auth/oauth/github/callback")

settings = Settings()
