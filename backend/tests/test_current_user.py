from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth.current_user import (
    LOCAL_DEFAULT_USER_ID,
    CurrentUser,
    get_allowed_user_emails,
    get_current_user,
    get_local_default_user,
    is_allowed_user_email,
    normalise_user_email,
)


def test_local_default_user_has_stable_id():
    user = get_local_default_user()

    assert user == CurrentUser(id=LOCAL_DEFAULT_USER_ID)
    assert user.id == "local-default-user"
    assert user.email is None


def test_current_user_dependency_returns_local_default_user_when_allowlist_is_disabled(monkeypatch):
    monkeypatch.delenv("ALLOWED_USER_EMAILS", raising=False)

    app = FastAPI()

    @app.get("/whoami")
    def whoami(current_user: CurrentUser = Depends(get_current_user)):
        return {"user_id": current_user.id, "email": current_user.email}

    with TestClient(app) as client:
        response = client.get("/whoami")

    assert response.status_code == 200
    assert response.json() == {"user_id": LOCAL_DEFAULT_USER_ID, "email": None}


def test_allowed_user_email_helpers(monkeypatch):
    monkeypatch.setenv("ALLOWED_USER_EMAILS", " ME@example.com, family@example.com ")

    assert normalise_user_email(" ME@example.com ") == "me@example.com"
    assert get_allowed_user_emails() == {"me@example.com", "family@example.com"}
    assert is_allowed_user_email("FAMILY@example.com") is True
    assert is_allowed_user_email("other@example.com") is False


def test_current_user_dependency_returns_allowed_email_user(monkeypatch):
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    app = FastAPI()

    @app.get("/whoami")
    def whoami(current_user: CurrentUser = Depends(get_current_user)):
        return {"user_id": current_user.id, "email": current_user.email}

    with TestClient(app) as client:
        response = client.get(
            "/whoami",
            headers={"X-App-User-Email": "ME@example.com"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "user_id": "me@example.com",
        "email": "me@example.com",
    }


def test_current_user_dependency_rejects_disallowed_email(monkeypatch):
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    app = FastAPI()

    @app.get("/whoami")
    def whoami(current_user: CurrentUser = Depends(get_current_user)):
        return {"user_id": current_user.id}

    with TestClient(app) as client:
        response = client.get(
            "/whoami",
            headers={"X-App-User-Email": "other@example.com"},
        )

    assert response.status_code == 403
    assert response.json() == {"detail": "User email is not allowed"}
