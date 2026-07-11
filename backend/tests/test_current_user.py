import time

import jwt
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth.current_user import (
    LOCAL_DEFAULT_USER_ID,
    CurrentUser,
    get_admin_user_emails,
    get_allowed_user_emails,
    get_current_user,
    get_local_default_user,
    get_privileged_user,
    is_allowed_user_email,
    is_supabase_auth_enabled,
    normalise_user_email,
)


def make_supabase_token(email: str, secret: str = "test-secret") -> str:
    now = int(time.time())

    return jwt.encode(
        {
            "aud": "authenticated",
            "exp": now + 3600,
            "iat": now,
            "sub": "00000000-0000-0000-0000-000000000000",
            "email": email,
            "role": "authenticated",
        },
        secret,
        algorithm="HS256",
    )


def test_local_default_user_has_stable_id():
    user = get_local_default_user()

    assert user == CurrentUser(id=LOCAL_DEFAULT_USER_ID)
    assert user.id == "local-default-user"
    assert user.email is None


def test_current_user_dependency_returns_local_default_user_when_auth_is_disabled(monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
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


def test_current_user_dependency_returns_allowed_email_user_from_legacy_header(monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
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


def test_current_user_dependency_rejects_disallowed_legacy_header_email(monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
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


def test_supabase_auth_enabled_when_jwt_secret_is_configured(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")

    assert is_supabase_auth_enabled() is True


def test_current_user_dependency_returns_allowed_supabase_jwt_user(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    token = make_supabase_token("ME@example.com")

    app = FastAPI()

    @app.get("/whoami")
    def whoami(current_user: CurrentUser = Depends(get_current_user)):
        return {"user_id": current_user.id, "email": current_user.email}

    with TestClient(app) as client:
        response = client.get(
            "/whoami",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "user_id": "me@example.com",
        "email": "me@example.com",
    }


def test_current_user_dependency_rejects_missing_bearer_token_when_supabase_enabled(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    app = FastAPI()

    @app.get("/whoami")
    def whoami(current_user: CurrentUser = Depends(get_current_user)):
        return {"user_id": current_user.id}

    with TestClient(app) as client:
        response = client.get("/whoami")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing bearer token"}


def test_current_user_dependency_rejects_invalid_supabase_jwt(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    app = FastAPI()

    @app.get("/whoami")
    def whoami(current_user: CurrentUser = Depends(get_current_user)):
        return {"user_id": current_user.id}

    with TestClient(app) as client:
        response = client.get(
            "/whoami",
            headers={"Authorization": "Bearer invalid-token"},
        )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid bearer token"}


def test_current_user_dependency_rejects_disallowed_supabase_jwt_user(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    token = make_supabase_token("other@example.com")

    app = FastAPI()

    @app.get("/whoami")
    def whoami(current_user: CurrentUser = Depends(get_current_user)):
        return {"user_id": current_user.id}

    with TestClient(app) as client:
        response = client.get(
            "/whoami",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 403
    assert response.json() == {"detail": "User email is not allowed"}


def test_admin_user_email_helpers(monkeypatch):
    monkeypatch.setenv(
        "ADMIN_USER_EMAILS",
        " ADMIN@example.com, second@example.com ",
    )

    assert get_admin_user_emails() == {
        "admin@example.com",
        "second@example.com",
    }


def test_privileged_user_allows_local_default_user_without_supabase(monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
    monkeypatch.delenv("ALLOWED_USER_EMAILS", raising=False)
    monkeypatch.delenv("ADMIN_USER_EMAILS", raising=False)

    app = FastAPI()

    @app.get("/privileged")
    def privileged(
        current_user: CurrentUser = Depends(get_privileged_user),
    ):
        return {"user_id": current_user.id}

    with TestClient(app) as client:
        response = client.get("/privileged")

    assert response.status_code == 200
    assert response.json() == {"user_id": LOCAL_DEFAULT_USER_ID}


def test_privileged_user_rejects_authenticated_non_admin(monkeypatch):
    monkeypatch.setenv(
        "SUPABASE_JWT_SECRET",
        "test-secret-at-least-thirty-two-bytes-long",
    )
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")
    monkeypatch.setenv("ADMIN_USER_EMAILS", "admin@example.com")

    token = make_supabase_token(
        "me@example.com",
        secret="test-secret-at-least-thirty-two-bytes-long",
    )

    app = FastAPI()

    @app.get("/privileged")
    def privileged(
        current_user: CurrentUser = Depends(get_privileged_user),
    ):
        return {"user_id": current_user.id}

    with TestClient(app) as client:
        response = client.get(
            "/privileged",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 403
    assert response.json() == {"detail": "Privileged access is required"}


def test_privileged_user_accepts_configured_admin(monkeypatch):
    monkeypatch.setenv(
        "SUPABASE_JWT_SECRET",
        "test-secret-at-least-thirty-two-bytes-long",
    )
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "admin@example.com")
    monkeypatch.setenv("ADMIN_USER_EMAILS", "admin@example.com")

    token = make_supabase_token(
        "ADMIN@example.com",
        secret="test-secret-at-least-thirty-two-bytes-long",
    )

    app = FastAPI()

    @app.get("/privileged")
    def privileged(
        current_user: CurrentUser = Depends(get_privileged_user),
    ):
        return {"user_id": current_user.id}

    with TestClient(app) as client:
        response = client.get(
            "/privileged",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json() == {"user_id": "admin@example.com"}
