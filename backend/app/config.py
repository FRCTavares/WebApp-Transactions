import os


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
