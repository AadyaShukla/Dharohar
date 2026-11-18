"""Application configuration management using Pydantic Settings.

Supports configurable environments (development | production), strict production
validation, and dynamic settings resolution.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, List, Literal, Optional, Union

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directory paths
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Core application settings with environment variable bindings."""

    # -------------------------------------------------------------------------
    # Environment & Product Configuration
    # -------------------------------------------------------------------------
    ENV: Literal["development", "production", "test"] = "development"
    DEMO_MODE: bool = False  # Defaults to False for configurable product
    PAYMENT_PROVIDER: Literal["mock", "razorpay"] = "mock"  # mock | razorpay (default mock)

    # -------------------------------------------------------------------------
    # Database
    # -------------------------------------------------------------------------
    DATABASE_URL: str = f"sqlite:///{BACKEND_DIR / 'dharohar.db'}"

    # -------------------------------------------------------------------------
    # Authentication & Encryption Secrets
    # -------------------------------------------------------------------------
    AUTH_SECRET: str = "dharohar-simulated-auth-secret-key-32b"
    ENCRYPTION_KEY: Optional[str] = None

    # -------------------------------------------------------------------------
    # LLM Provider Configuration (Default is real: gemini)
    # -------------------------------------------------------------------------
    LLM_PROVIDER: str = "gemini"
    LLM_API_KEY: str = ""
    LLM_MODEL: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20241022"

    # -------------------------------------------------------------------------
    # Firebase / Google Cloud
    # -------------------------------------------------------------------------
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None

    # -------------------------------------------------------------------------
    # File Storage
    # -------------------------------------------------------------------------
    STORAGE_BUCKET_NAME: Optional[str] = None
    UPLOAD_DIR: str = str(BACKEND_DIR / "uploads")

    # -------------------------------------------------------------------------
    # Razorpay Payment Gateway
    # -------------------------------------------------------------------------
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = None

    # -------------------------------------------------------------------------
    # Platform Fees & Escrow Rules
    # -------------------------------------------------------------------------
    PLATFORM_FEE_PERCENT: float = 5.0
    FEE_GST_PERCENT: float = 18.0
    DISPUTE_WINDOW_HOURS: int = 48

    # -------------------------------------------------------------------------
    # WhatsApp Cloud API & Webhooks
    # -------------------------------------------------------------------------
    WHATSAPP_TOKEN: Optional[str] = None
    WHATSAPP_PHONE_ID: Optional[str] = None
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    WHATSAPP_VERIFY_TOKEN: Optional[str] = "dharohar_verify_token_secure"
    WHATSAPP_APP_SECRET: Optional[str] = None

    # -------------------------------------------------------------------------
    # Email / SMTP Configuration
    # -------------------------------------------------------------------------
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "notifications@dharohar.org"
    SMTP_USE_TLS: bool = True

    # -------------------------------------------------------------------------
    # Notification & Action Link Settings
    # -------------------------------------------------------------------------
    NOTIFICATION_RETRY_INTERVAL_SECONDS: int = 60
    NOTIFICATION_MAX_RETRIES: int = 5
    ACTION_TOKEN_SECRET: Optional[str] = None
    ACTION_TOKEN_EXPIRY_HOURS: int = 24

    # -------------------------------------------------------------------------
    # CORS & Networking
    # -------------------------------------------------------------------------
    ALLOWED_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    PUBLIC_BASE_URL: Optional[str] = "http://localhost:8000"

    # -------------------------------------------------------------------------
    # Negotiation & Booking Rules
    # -------------------------------------------------------------------------
    APPROVAL_EXPIRY_HOURS: int = 24

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: Any) -> List[str]:
        """Parse comma-separated strings or JSON arrays into a list of origins."""
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                try:
                    parsed = json.loads(v_stripped)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except Exception:
                    pass
            return [origin.strip() for origin in v_stripped.split(",") if origin.strip()]
        if isinstance(v, list):
            return [str(origin).strip() for origin in v if str(origin).strip()]
        return ["http://localhost:5173", "http://localhost:3000"]

    @model_validator(mode="after")
    def validate_production(self) -> "Settings":
        """Fail fast at startup when invalid configuration or missing secrets."""
        # Provider selection validation
        if self.PAYMENT_PROVIDER == "razorpay":
            missing_rzp = []
            if not self.RAZORPAY_KEY_ID or not str(self.RAZORPAY_KEY_ID).strip():
                missing_rzp.append("RAZORPAY_KEY_ID")
            if not self.RAZORPAY_KEY_SECRET or not str(self.RAZORPAY_KEY_SECRET).strip():
                missing_rzp.append("RAZORPAY_KEY_SECRET")
            if missing_rzp:
                raise ValueError(
                    f"Startup failed! PAYMENT_PROVIDER is set to 'razorpay' but required Razorpay keys are missing: {', '.join(missing_rzp)}"
                )

        if self.ENV.strip().lower() == "production":
            errors = []
            if self.PAYMENT_PROVIDER == "mock":
                errors.append("PAYMENT_PROVIDER cannot be 'mock' in production (must be 'razorpay')")

            required_map = {
                "DATABASE_URL": self.DATABASE_URL,
                "AUTH_SECRET": (
                    ""
                    if self.AUTH_SECRET == "dharohar-simulated-auth-secret-key-32b"
                    else self.AUTH_SECRET
                ),
                "LLM_API_KEY": self.LLM_API_KEY or self.GEMINI_API_KEY or self.ANTHROPIC_API_KEY,
                "RAZORPAY_KEY_ID": self.RAZORPAY_KEY_ID,
                "RAZORPAY_KEY_SECRET": self.RAZORPAY_KEY_SECRET,
                "RAZORPAY_WEBHOOK_SECRET": self.RAZORPAY_WEBHOOK_SECRET,
                "WHATSAPP_TOKEN": self.WHATSAPP_TOKEN,
                "WHATSAPP_PHONE_ID": self.WHATSAPP_PHONE_ID or self.WHATSAPP_PHONE_NUMBER_ID,
            }

            missing = [k for k, v in required_map.items() if not v or not str(v).strip()]
            if missing:
                errors.append(f"Missing required environment variables for ENV=production: {', '.join(missing)}")

            if errors:
                raise ValueError(
                    f"Production startup failed! {'; '.join(errors)}"
                )

        return self


def get_settings() -> Settings:
    """Instantiate and return fresh settings bound to current environment variables."""
    return Settings()


# Default singleton instance
settings = get_settings()
