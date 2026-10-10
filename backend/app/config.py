from functools import cached_property

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    All runtime configuration comes from environment variables / backend/.env.
    No secrets have defaults; see .env.example for the full list.
    """

    app_name: str = "Jivsetu AI API"
    environment: str = "development"  # development | test | production

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    patient_token_expire_minutes: int = 240

    # Full SQLAlchemy URL, e.g.
    #   mysql+pymysql://jivsetu:<password>@127.0.0.1:3306/jivsetu
    #   sqlite:///./jivsetu_dev.db   (local development only)
    database_url: str

    # Comma-separated list of allowed browser origins.
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    document_storage_path: str = "./storage/medical_documents"
    max_upload_mb: int = 10

    # dev   -> OTP is generated locally and returned ONLY outside production.
    # msg91 -> OTP is delivered and verified by MSG91.
    otp_provider: str = "dev"
    msg91_authkey: str = ""
    msg91_template_id: str = ""
    otp_expire_minutes: int = 10
    otp_max_attempts: int = 5
    otp_max_sends_per_window: int = 5

    # Enables seeding of clearly-labelled synthetic demo accounts.
    demo_mode: bool = False

    default_hospital_code: str = "JANSEVA-DGH"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @field_validator("environment")
    @classmethod
    def _normalize_env(cls, value: str) -> str:
        return value.strip().lower()

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @cached_property
    def cors_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]

    @property
    def database_backend(self) -> str:
        return self.database_url.split(":", 1)[0].split("+", 1)[0]

    def validate_for_runtime(self) -> list[str]:
        """Return a list of fatal configuration problems."""
        problems = []
        if len(self.jwt_secret_key) < 32 or "CHANGE" in self.jwt_secret_key.upper():
            problems.append("JWT_SECRET_KEY must be a random value of at least 32 characters.")
        if self.is_production:
            if self.database_backend == "sqlite":
                problems.append("SQLite is not supported in production; set a MySQL DATABASE_URL.")
            if self.otp_provider == "dev":
                problems.append("OTP_PROVIDER=dev is not allowed in production.")
            if self.demo_mode:
                problems.append("DEMO_MODE must be false in production.")
            if any("localhost" in o or "127.0.0.1" in o for o in self.cors_origin_list):
                problems.append("CORS_ORIGINS must list the production frontend origin, not localhost.")
        return problems


settings = Settings()
