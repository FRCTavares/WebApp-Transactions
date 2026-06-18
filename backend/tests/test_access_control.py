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
