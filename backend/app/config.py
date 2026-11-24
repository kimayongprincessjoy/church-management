from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Church Management System"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    # MySQL in production: mysql+pymysql://user:pass@host:3306/db
    # SQLite for local dev/tests: sqlite:///./church.db
    database_url: str = "sqlite:///./church.db"

    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Public base URL used in QR payloads (e.g. https://cms.example.org)
    public_base_url: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
