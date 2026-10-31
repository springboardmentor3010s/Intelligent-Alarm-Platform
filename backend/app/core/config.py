from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # PostgreSQL configuration
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "cognitive_alarm_db"
    db_user: str = "postgres"
    db_password: str = "Tanmaya@190306"

    # Authentication configuration.
    # ADMIN_JWT_SECRET signs every access token (user, coach and admin).
    # JWT_SECRET is accepted as an alias and takes priority when set.
    admin_jwt_secret: str | None = None
    jwt_secret: str | None = None
    admin_token_expire_minutes: int = 30
    user_token_expire_minutes: int = 480

    # Browser origins allowed to call the API (comma separated).
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Public address of the React app (used after OAuth2 login).
    frontend_url: str = "http://localhost:5173"

    # Optional Google OAuth2 login. Leave empty to disable it.
    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str = "http://127.0.0.1:8000/auth/oauth/google/callback"

    # Create missing tables and columns when the API starts.
    auto_create_tables: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def token_secret(self) -> str | None:
        return self.jwt_secret or self.admin_jwt_secret

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]

    @property
    def google_oauth_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)


@lru_cache
def get_settings() -> Settings:
    return Settings()
