import os


def get_positive_int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name, "").strip()
    if not raw_value:
        return default

    try:
        value = int(raw_value)
    except ValueError as error:
        raise RuntimeError(f"{name} must be a positive integer") from error

    if value <= 0:
        raise RuntimeError(f"{name} must be a positive integer")
    return value


def get_market_data_timeout_seconds() -> int:
    return get_positive_int_env("MARKET_DATA_TIMEOUT_SECONDS", 15)


def get_database_connect_timeout_seconds() -> int:
    return get_positive_int_env("DATABASE_CONNECT_TIMEOUT_SECONDS", 10)


def get_database_statement_timeout_ms() -> int:
    return get_positive_int_env("DATABASE_STATEMENT_TIMEOUT_MS", 30000)


def get_app_env() -> str:
    return os.getenv("APP_ENV", "development").strip().lower()


def is_production() -> bool:
    return get_app_env() == "production"


def get_cors_origins() -> list[str]:
    return [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ]


def get_bool_env(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def get_api_docs_enabled() -> bool:
    configured_value = os.getenv("API_DOCS_ENABLED")

    if configured_value is None:
        return not is_production()

    return configured_value.strip().lower() in {"1", "true", "yes", "on"}


def validate_e2e_config() -> None:
    """Refuse to serve the developer's real database to an end-to-end run.

    The e2e suite creates categories, transactions and import batches on every
    run and does not fully clean up. Started without DATABASE_URL the backend
    serves backend/data/finance.db, so those rows accumulate in real financial
    data. Declaring APP_ENV=e2e opts a process into this check.
    """

    if get_app_env() != "e2e":
        return

    database_url = os.getenv("DATABASE_URL", "").strip()

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is required when APP_ENV=e2e. Without it the backend "
            "serves backend/data/finance.db and the suite writes test rows into "
            "real data. Use backend/scripts/start_e2e_backend.sh."
        )

    if "data/finance.db" in database_url:
        raise RuntimeError(
            f"Refusing to run an e2e backend against {database_url}. "
            "Point DATABASE_URL at a throwaway database."
        )


def validate_production_config() -> None:
    if not is_production():
        return

    errors: list[str] = []

    database_url = os.getenv("DATABASE_URL", "").strip()
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    allowed_user_emails = os.getenv("ALLOWED_USER_EMAILS", "").strip()
    admin_user_emails = os.getenv("ADMIN_USER_EMAILS", "").strip()
    cors_origins = get_cors_origins()

    if not database_url:
        errors.append("DATABASE_URL is required when APP_ENV=production")

    if not supabase_url:
        errors.append("SUPABASE_URL is required when APP_ENV=production")

    if not allowed_user_emails:
        errors.append("ALLOWED_USER_EMAILS is required when APP_ENV=production")

    if not admin_user_emails:
        errors.append("ADMIN_USER_EMAILS is required when APP_ENV=production")

    if "*" in cors_origins:
        errors.append("CORS_ORIGINS must not contain * when APP_ENV=production")

    if get_bool_env("LOCAL_NETWORK_ONLY"):
        errors.append("LOCAL_NETWORK_ONLY must be false when APP_ENV=production")

    if errors:
        joined_errors = "; ".join(errors)
        raise RuntimeError(f"Invalid production configuration: {joined_errors}")
