"""Application configuration using pydantic-settings."""

from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "DevOpsPulse"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # PostgreSQL individual parameters (raw values)
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "devopspulse"

    # Database URLs (URL-encoded)
    DATABASE_URL: str = ""
    DATABASE_URL_SYNC: str = ""

    @model_validator(mode="after")
    def assemble_db_urls(self) -> "Settings":
        """Assemble correctly URL-encoded PostgreSQL URLs if individual parameters are supplied."""
        if self.POSTGRES_PASSWORD and self.POSTGRES_PASSWORD != "CHANGE_ME_LOCAL_PASSWORD":
            enc_user = quote_plus(self.POSTGRES_USER)
            enc_pw = quote_plus(self.POSTGRES_PASSWORD)
            self.DATABASE_URL = (
                f"postgresql+asyncpg://{enc_user}:{enc_pw}@"
                f"{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
            self.DATABASE_URL_SYNC = (
                f"postgresql://{enc_user}:{enc_pw}@"
                f"{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
        elif not self.DATABASE_URL:
            # Fallback when no password is set yet
            self.DATABASE_URL = (
                f"postgresql+asyncpg://{self.POSTGRES_USER}@"
                f"{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
            self.DATABASE_URL_SYNC = (
                f"postgresql://{self.POSTGRES_USER}@"
                f"{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
        return self

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # GitHub OAuth
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/github/callback"
    GITHUB_API_BASE_URL: str = "https://api.github.com"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
    ]

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Webhook
    WEBHOOK_SECRET: str = "webhook-secret-change-me"

    # Frontend Application URL (for invitation and notification links)
    FRONTEND_URL: str = "http://localhost:3000"

    # SMTP / Email Provider Configuration
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str = "noreply@devopspulse.com"
    SMTP_FROM_NAME: str = "DevOpsPulse"
    SMTP_TLS: bool = True
    SMTP_SSL: bool = False
    SMTP_TIMEOUT_SECONDS: int = 10


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings instance."""
    return Settings()
