from fastapi.testclient import TestClient

from app.main import app


def test_health_check_does_not_require_access_token(monkeypatch):
    monkeypatch.setenv("APP_ACCESS_TOKEN", "secret-token")

    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_route_rejects_missing_access_token(monkeypatch):
    monkeypatch.setenv("APP_ACCESS_TOKEN", "secret-token")

    with TestClient(app) as client:
        response = client.get("/api/summary")

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or missing app access token"}


def test_api_route_accepts_valid_access_token(monkeypatch):
    monkeypatch.setenv("APP_ACCESS_TOKEN", "secret-token")

    with TestClient(app) as client:
        response = client.get(
            "/api/summary",
            headers={"X-App-Access-Token": "secret-token"},
        )

    assert response.status_code != 401
