"""Central configuration. Everything sensitive comes from environment variables."""
import secrets
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "Wakeful"
    ENV: str = "development"  # development | production | test
    DATABASE_URL: str = "sqlite:///./wakeful_dev.db"
    MONGO_URL: str = ""
    MONGO_DB: str = "wakeful"

    SECRET_KEY: str = ""
    ACCESS_TOKEN_MINUTES: int = 15
    REFRESH_TOKEN_DAYS: int = 14
    COOKIE_SECURE: bool = False  # set true when served over HTTPS
    COOKIE_PATH: str = "/api/auth"
    PUBLIC_URL: str = "http://localhost:5173"

    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""
    ADMIN_NAME: str = "Administrator"
    SEED_DEMO_DATA: bool = False
    DEMO_PASSWORD: str = ""

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    SCHEDULER_ENABLED: bool = True
    SCHEDULER_INTERVAL_SECONDS: int = 2
    MAX_FAILED_LOGINS: int = 5
    LOCKOUT_MINUTES: int = 15
    MISSED_AFTER_MINUTES: int = 45
    RING_GRACE_MINUTES: int = 15
    MAX_ALARMS_PER_USER: int = 20

    @model_validator(mode="after")
    def _validate(self):
        if not self.SECRET_KEY:
            if self.ENV == "production":
                raise ValueError("SECRET_KEY must be set when ENV=production")
            self.SECRET_KEY = secrets.token_urlsafe(48)  # ephemeral dev key
        elif self.ENV == "production" and len(self.SECRET_KEY) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters in production")
        return self

    @property
    def is_prod(self) -> bool:
        return self.ENV == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
