from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    db_user: str = "postgres"
    db_password: str = ""
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "cognitive_alarm"

    secret_key: str = "my-super-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()