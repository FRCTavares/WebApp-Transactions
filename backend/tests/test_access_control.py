from fastapi.testclient import TestClient

from app.main import app


def test_health_check_does_not_require_access_token(monkeypatch):
    monkeypatch.setenv("APP_ACCESS_TOKEN", "secret-token")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_route_rejects_missing_access_token(monkeypatch):
    monkeypatch.setenv("APP_ACCESS_TOKEN", "secret-token")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    with TestClient(app) as client:
        response = client.get(
            "/api/summary",
            headers={"X-App-User-Email": "me@example.com"},
        )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or missing app access token"}


def test_api_route_accepts_valid_access_token_when_no_email_allowlist(monkeypatch):
    monkeypatch.setenv("APP_ACCESS_TOKEN", "secret-token")
    monkeypatch.delenv("ALLOWED_USER_EMAILS", raising=False)

    with TestClient(app) as client:
        response = client.get(
            "/api/summary",
            headers={"X-App-Access-Token": "secret-token"},
        )

    assert response.status_code != 401


def test_api_route_rejects_missing_user_email_when_allowlist_is_enabled(monkeypatch):
    monkeypatch.setenv("APP_ACCESS_TOKEN", "secret-token")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    with TestClient(app) as client:
        response = client.get(
            "/api/summary",
            headers={"X-App-Access-Token": "secret-token"},
        )

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing user email"}


def test_api_route_rejects_disallowed_user_email(monkeypatch):
    monkeypatch.setenv("APP_ACCESS_TOKEN", "secret-token")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    with TestClient(app) as client:
        response = client.get(
            "/api/summary",
            headers={
                "X-App-Access-Token": "secret-token",
                "X-App-User-Email": "other@example.com",
            },
        )

    assert response.status_code == 403
    assert response.json() == {"detail": "User email is not allowed"}


def test_api_route_accepts_allowed_user_email(monkeypatch):
    monkeypatch.setenv("APP_ACCESS_TOKEN", "secret-token")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com, family@example.com")

    with TestClient(app) as client:
        response = client.get(
            "/api/summary",
            headers={
                "X-App-Access-Token": "secret-token",
                "X-App-User-Email": "FAMILY@example.com",
            },
        )

    assert response.status_code != 401
    assert response.status_code != 403

def test_app_access_token_middleware_is_skipped_when_supabase_auth_is_enabled(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")
    monkeypatch.setenv("APP_ACCESS_TOKEN", "secret-token")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    with TestClient(app) as client:
        response = client.get("/api/summary")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing bearer token"}



def test_health_check_does_not_require_local_network_client(monkeypatch):
    monkeypatch.setenv("LOCAL_NETWORK_ONLY", "true")
    monkeypatch.setenv("APP_ACCESS_TOKEN", "secret-token")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_options_request_does_not_require_local_network_client(monkeypatch):
    monkeypatch.setenv("LOCAL_NETWORK_ONLY", "true")
    monkeypatch.setenv("APP_ACCESS_TOKEN", "secret-token")
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


def test_me_route_returns_local_default_user_when_auth_is_disabled(monkeypatch):
    monkeypatch.delenv("APP_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
    monkeypatch.delenv("ALLOWED_USER_EMAILS", raising=False)

    with TestClient(app) as client:
        response = client.get("/api/me")

    assert response.status_code == 200
    assert response.json() == {
        "user_id": "local-default-user",
        "email": None,
    }


def test_me_route_returns_allowed_header_bridge_user(monkeypatch):
    monkeypatch.delenv("APP_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    with TestClient(app) as client:
        response = client.get(
            "/api/me",
            headers={"X-App-User-Email": "ME@example.com"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "user_id": "me@example.com",
        "email": "me@example.com",
    }


def test_me_route_requires_bearer_token_when_supabase_auth_is_enabled(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
    monkeypatch.delenv("APP_ACCESS_TOKEN", raising=False)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    with TestClient(app) as client:
        response = client.get("/api/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing bearer token"}
