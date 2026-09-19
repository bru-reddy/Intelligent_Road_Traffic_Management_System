
from __future__ import annotations

import os
from pathlib import Path
from typing import List

from dotenv import load_dotenv


CURRENT_FILE = Path(__file__).resolve()
BACKEND_DIR = CURRENT_FILE.parents[2]
PROJECT_ROOT = CURRENT_FILE.parents[3]

BACKEND_ENV_FILE = BACKEND_DIR / ".env"
ROOT_ENV_FILE = PROJECT_ROOT / ".env"

if BACKEND_ENV_FILE.exists():
    load_dotenv(BACKEND_ENV_FILE, override=False)

if ROOT_ENV_FILE.exists():
    load_dotenv(ROOT_ENV_FILE, override=False)


def _get_env(name: str, default: str = "") -> str:
    value = os.getenv(name)
    return default if value is None else value.strip()


def _get_int(name: str, default: int) -> int:
    try:
        return int(_get_env(name, str(default)))
    except (TypeError, ValueError):
        return default


def _get_float(name: str, default: float) -> float:
    try:
        return float(_get_env(name, str(default)))
    except (TypeError, ValueError):
        return default


def _get_bool(name: str, default: bool = False) -> bool:
    value = _get_env(name, str(default)).lower()

    if value in {"1", "true", "yes", "on"}:
        return True

    if value in {"0", "false", "no", "off"}:
        return False

    return default


def _get_list(name: str, default: List[str]) -> List[str]:
    value = _get_env(name)

    if not value:
        return default.copy()

    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    APP_NAME: str = _get_env(
        "APP_NAME",
        "Intelligent Road Traffic Monitoring System (IRTMS)",
    )

    APP_VERSION: str = _get_env("APP_VERSION", "1.0.0")

    ENVIRONMENT: str = _get_env(
        "ENVIRONMENT",
        "development",
    ).lower()

    DEBUG: bool = _get_bool(
        "DEBUG",
        ENVIRONMENT == "development",
    )

    DATABASE_URL: str = _get_env(
        "DATABASE_URL",
        "mysql+pymysql://root:root123@localhost:3306/irtms",
    )

    SECRET_KEY: str = _get_env("SECRET_KEY", "")

    ALGORITHM: str = _get_env(
        "JWT_ALGORITHM",
        "HS256",
    )

    ACCESS_TOKEN_EXPIRE_MINUTES: int = _get_int(
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        60,
    )

    COMMISSIONER_REGISTRATION_CODE: str = _get_env(
        "COMMISSIONER_REGISTRATION_CODE",
        "",
    )

    TOMTOM_API_KEY: str = _get_env(
        "TOMTOM_API_KEY",
        "",
    )

    TOMTOM_BASE_URL: str = _get_env(
        "TOMTOM_BASE_URL",
        "https://api.tomtom.com",
    )

    TOMTOM_TIMEOUT_SECONDS: int = _get_int(
        "TOMTOM_TIMEOUT_SECONDS",
        15,
    )

    TRAFFIC_SIMULATION_FALLBACK: bool = _get_bool(
        "TRAFFIC_SIMULATION_FALLBACK",
        True,
    )

    FRONTEND_URL: str = _get_env(
        "FRONTEND_URL",
        "http://localhost:5173",
    )

    CORS_ORIGINS: List[str] = _get_list(
        "CORS_ORIGINS",
        [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
    )

    MIN_TRAINING_RECORDS: int = _get_int(
        "MIN_TRAINING_RECORDS",
        10,
    )

    PREDICTION_MIN_CONFIDENCE: float = _get_float(
        "PREDICTION_MIN_CONFIDENCE",
        0.50,
    )

    API_PREFIX: str = _get_env(
        "API_PREFIX",
        "/api",
    )

    ENABLE_API_DOCS: bool = _get_bool(
        "ENABLE_API_DOCS",
        True,
    )

    @property
    def jwt_secret_key(self) -> str:
        return self.SECRET_KEY

    @property
    def jwt_algorithm(self) -> str:
        return self.ALGORITHM

    @property
    def access_token_expire_minutes(self) -> int:
        return self.ACCESS_TOKEN_EXPIRE_MINUTES

    @property
    def tomtom_api_key(self) -> str:
        return self.TOMTOM_API_KEY

    @property
    def database_url(self) -> str:
        return self.DATABASE_URL

    @property
    def frontend_url(self) -> str:
        return self.FRONTEND_URL

    @property
    def cors_origins(self) -> List[str]:
        return self.CORS_ORIGINS

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    def validate(self) -> None:
        if not self.DATABASE_URL:
            raise RuntimeError("DATABASE_URL cannot be empty.")

        if self.is_production:
            if not self.SECRET_KEY:
                raise RuntimeError(
                    "SECRET_KEY must be configured in production."
                )

            if len(self.SECRET_KEY) < 32:
                raise RuntimeError(
                    "SECRET_KEY must contain at least 32 characters."
                )

            if not self.COMMISSIONER_REGISTRATION_CODE:
                raise RuntimeError(
                    "COMMISSIONER_REGISTRATION_CODE must be configured."
                )

        if self.ACCESS_TOKEN_EXPIRE_MINUTES <= 0:
            raise RuntimeError(
                "ACCESS_TOKEN_EXPIRE_MINUTES must be greater than zero."
            )

        if self.TOMTOM_TIMEOUT_SECONDS <= 0:
            raise RuntimeError(
                "TOMTOM_TIMEOUT_SECONDS must be greater than zero."
            )

        if self.MIN_TRAINING_RECORDS < 2:
            raise RuntimeError(
                "MIN_TRAINING_RECORDS must be at least 2."
            )

        if not 0.0 <= self.PREDICTION_MIN_CONFIDENCE <= 1.0:
            raise RuntimeError(
                "PREDICTION_MIN_CONFIDENCE must be between 0 and 1."
            )

        if not self.API_PREFIX.startswith("/"):
            raise RuntimeError(
                "API_PREFIX must start with '/'."
            )


settings = Settings()

if settings.is_production:
    settings.validate()
