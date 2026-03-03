from pathlib import Path

from pydantic_settings import BaseSettings

# Resolve the root .env relative to this file: backend/app/config.py -> repo root
_root_env = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/coinoperated"
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    secret_key: str = "change-me-in-production"
    cors_origins: list[str] = ["http://localhost:5173", "https://localhost:5173"]
    admin_email: str = ""
    frontend_url: str = "https://localhost:5173"
    magic_link_expiry_minutes: int = 15
    session_expiry_days: int = 30
    stripe_webhook_secret: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@coinoperated.dev"
    smtp_from_name: str = "CoinOperated"
    smtp_use_tls: bool = True
    staging: bool = False
    allowed_origins: str = ""  # comma-separated extra origins for auth redirects
    base_path: str = ""  # "/coinop" in production

    model_config = {"env_file": str(_root_env), "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
