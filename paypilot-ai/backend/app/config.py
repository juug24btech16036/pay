import os
from functools import lru_cache
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Resolve explicit paths relative to backend directory to ensure .env is
# discovered regardless of the current working directory from which python is invoked.
BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BACKEND_DIR / ".env"

# Load backend/.env
if ENV_PATH.is_file():
    load_dotenv(dotenv_path=ENV_PATH)


class Settings:
    """Application configuration settings loaded from environment variables."""

    PROJECT_NAME: str = "PayPilot AI API"
    VERSION: str = "1.0.0"

    # Default class attributes
    PAYPAL_CLIENT_ID: str = ""
    PAYPAL_CLIENT_SECRET: str = ""
    PAYPAL_API_BASE: str = "https://api-m.sandbox.paypal.com"
    PAYPAL_CURRENCY_DEFAULT: str = "USD"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3-flash-preview"
    HOST: str = "0.0.0.0"
    PORT: int = 8005
    ENVIRONMENT: str = "sandbox"

    def __init__(self):
        # PayPal Sandbox Configuration
        self.PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID", "").strip()
        self.PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET", "").strip()
        self.PAYPAL_API_BASE = os.getenv(
            "PAYPAL_API_BASE", "https://api-m.sandbox.paypal.com"
        ).rstrip("/")
        self.PAYPAL_CURRENCY_DEFAULT = os.getenv("PAYPAL_CURRENCY_DEFAULT", "USD").upper()

        # Google Gemini AI Configuration
        self.GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
        self.GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview").strip()

        # Server Configuration
        self.HOST = os.getenv("HOST", "0.0.0.0")
        self.PORT = int(os.getenv("PORT", "8005"))
        self.ENVIRONMENT = os.getenv("ENVIRONMENT", "sandbox")

    # CORS Allowed Origins
    @property
    def allowed_origins(self) -> List[str]:
        raw = os.getenv("ALLOWED_ORIGINS", "")
        defaults = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
        if raw:
            configured = [origin.strip() for origin in raw.split(",") if origin.strip()]
            return list(set(defaults + configured))
        return defaults

    def is_paypal_configured(self) -> bool:
        """Check if PayPal credentials have been configured with non-empty non-placeholder values."""
        placeholder_indicators = [
            "your_paypal_client_id_here",
            "your_paypal_client_secret_here",
            "your_paypal_sandbox_client_id_here",
            "your_paypal_sandbox_client_secret_here",
            "your_paypal_",
            "client_id_here",
            "client_secret_here",
            "placeholder",
            "xxx",
        ]
        cid = self.PAYPAL_CLIENT_ID.lower()
        sec = self.PAYPAL_CLIENT_SECRET.lower()
        if not cid or not sec:
            return False
        if any(p in cid for p in placeholder_indicators) or any(
            p in sec for p in placeholder_indicators
        ):
            return False
        return True

    def get_masked_client_id(self) -> str:
        """Safely returns a masked client id for logging or inspection."""
        if not self.PAYPAL_CLIENT_ID:
            return "<not configured>"
        if len(self.PAYPAL_CLIENT_ID) <= 8:
            return "****"
        return f"{self.PAYPAL_CLIENT_ID[:4]}...{self.PAYPAL_CLIENT_ID[-4:]}"

    def is_gemini_configured(self) -> bool:
        """Check if Gemini API key has been configured with non-empty non-placeholder value."""
        placeholder_indicators = [
            "your_gemini_api_key_here",
            "gemini_api_key_here",
            "your_api_key_here",
            "your_gemini_key",
            "<api_key>",
            "placeholder",
            "xxx",
        ]
        key = self.GEMINI_API_KEY.lower()
        if not key:
            return False
        if any(p in key for p in placeholder_indicators):
            return False
        return True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
