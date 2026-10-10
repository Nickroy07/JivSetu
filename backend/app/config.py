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
    #   postgresql+psycopg://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
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
    # Set ALLOW_DEV_OTP_IN_PRODUCTION=true to bypass the dev-OTP production guard
    # while SMS credentials are being provisioned. Remove once MSG91 is configured.
    allow_dev_otp_in_production: bool = False

    # Enables seeding of clearly-labelled synthetic demo accounts.
    demo_mode: bool = False

    default_hospital_code: str = "JANSEVA-DGH"

    # ABDM: disabled | mock | sandbox. "mock" never contacts ABDM; "sandbox" is pending
    # official credentials and conformance, so no live exchange is implemented yet.
    abdm_mode: str = "disabled"
    abdm_client_id: str = ""
    abdm_client_secret: str = ""
    abdm_base_url: str = ""

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
        if self.abdm_mode not in ("disabled", "mock", "sandbox"):
            problems.append("ABDM_MODE must be disabled, mock or sandbox.")
        if self.abdm_mode == "sandbox" and not (self.abdm_client_id and self.abdm_client_secret and self.abdm_base_url):
            problems.append("ABDM_MODE=sandbox requires ABDM_CLIENT_ID, ABDM_CLIENT_SECRET and ABDM_BASE_URL.")
        if self.is_production:
            if self.abdm_mode == "mock":
                problems.append("ABDM_MODE=mock is not allowed in production.")
            if self.database_backend not in ("mysql", "postgresql", "postgres"):
                problems.append("Production requires a MySQL or PostgreSQL DATABASE_URL; SQLite is not supported.")
            if self.otp_provider == "dev" and not self.allow_dev_otp_in_production:
                problems.append("OTP_PROVIDER=dev is not allowed in production. Set ALLOW_DEV_OTP_IN_PRODUCTION=true to override temporarily.")
            if self.demo_mode:
                problems.append("DEMO_MODE must be false in production.")
            if any("localhost" in o or "127.0.0.1" in o for o in self.cors_origin_list):
                problems.append("CORS_ORIGINS must list the production frontend origin, not localhost.")
        return problems


settings = Settings()
