import pytest

from fastapi.testclient import TestClient

from app.main import app









def test_health_check_does_not_require_local_network_client(monkeypatch):
    monkeypatch.setenv("LOCAL_NETWORK_ONLY", "true")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_options_request_does_not_require_local_network_client(monkeypatch):
    monkeypatch.setenv("LOCAL_NETWORK_ONLY", "true")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    with TestClient(app) as client:
        response = client.options(
            "/api/summary",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert response.status_code == 200




def test_me_route_requires_bearer_token_when_supabase_auth_is_enabled(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    with TestClient(app) as client:
        response = client.get("/api/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing bearer token"}



def test_security_headers_are_set(monkeypatch):
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
    monkeypatch.delenv("ALLOWED_USER_EMAILS", raising=False)

    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Permissions-Policy"] == (
        "camera=(), microphone=(), geolocation=()"
    )


def test_production_config_requires_database_url(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")
    monkeypatch.setenv("ADMIN_USER_EMAILS", "me@example.com")
    monkeypatch.setenv("CORS_ORIGINS", "https://example.com")
    monkeypatch.setenv("LOCAL_NETWORK_ONLY", "false")

    with pytest.raises(RuntimeError, match="DATABASE_URL is required"):
        with TestClient(app):
            pass


def test_production_config_requires_supabase_url(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@example.com/db")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")
    monkeypatch.setenv("ADMIN_USER_EMAILS", "me@example.com")
    monkeypatch.setenv("CORS_ORIGINS", "https://example.com")
    monkeypatch.setenv("LOCAL_NETWORK_ONLY", "false")

    with pytest.raises(RuntimeError, match="SUPABASE_URL is required"):
        with TestClient(app):
            pass


def test_production_config_requires_allowed_user_emails(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@example.com/db")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.delenv("ALLOWED_USER_EMAILS", raising=False)
    monkeypatch.setenv("CORS_ORIGINS", "https://example.com")
    monkeypatch.setenv("LOCAL_NETWORK_ONLY", "false")

    with pytest.raises(RuntimeError, match="ALLOWED_USER_EMAILS is required"):
        with TestClient(app):
            pass


def test_production_config_requires_admin_user_emails(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://user:pass@example.com/db",
    )
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")
    monkeypatch.delenv("ADMIN_USER_EMAILS", raising=False)
    monkeypatch.setenv("CORS_ORIGINS", "https://example.com")
    monkeypatch.setenv("LOCAL_NETWORK_ONLY", "false")

    with pytest.raises(RuntimeError, match="ADMIN_USER_EMAILS is required"):
        with TestClient(app):
            pass


def test_production_config_rejects_wildcard_cors(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@example.com/db")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")
    monkeypatch.setenv("ADMIN_USER_EMAILS", "me@example.com")
    monkeypatch.setenv("CORS_ORIGINS", "*")
    monkeypatch.setenv("LOCAL_NETWORK_ONLY", "false")

    with pytest.raises(RuntimeError, match="CORS_ORIGINS must not contain"):
        with TestClient(app):
            pass


def test_production_config_rejects_local_network_only(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@example.com/db")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")
    monkeypatch.setenv("ADMIN_USER_EMAILS", "me@example.com")
    monkeypatch.setenv("CORS_ORIGINS", "https://example.com")
    monkeypatch.setenv("LOCAL_NETWORK_ONLY", "true")

    with pytest.raises(RuntimeError, match="LOCAL_NETWORK_ONLY must be false"):
        with TestClient(app):
            pass


def test_production_config_accepts_required_settings(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@example.com/db")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")
    monkeypatch.setenv("ADMIN_USER_EMAILS", "me@example.com")
    monkeypatch.setenv("CORS_ORIGINS", "https://example.com")
    monkeypatch.setenv("LOCAL_NETWORK_ONLY", "false")

    with TestClient(app) as client:
        response = client.get("/api/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing bearer token"}
