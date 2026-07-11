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


def make_supabase_token(
    email: str,
    secret: str = "test-secret",
    subject: str = "00000000-0000-0000-0000-000000000000",
    issuer: str | None = None,
) -> str:
    now = int(time.time())
    payload = {
        "aud": "authenticated",
        "exp": now + 3600,
        "iat": now,
        "sub": subject,
        "email": email,
        "role": "authenticated",
    }

    if issuer is not None:
        payload["iss"] = issuer

    return jwt.encode(
        payload,
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
        "user_id": "00000000-0000-0000-0000-000000000000",
        "email": "me@example.com",
    }


def test_current_user_accepts_expected_supabase_issuer(monkeypatch):
    secret = "test-secret-at-least-thirty-two-bytes-long"
    supabase_url = "https://example.supabase.co"
    expected_issuer = f"{supabase_url}/auth/v1"

    monkeypatch.setenv("SUPABASE_JWT_SECRET", secret)
    monkeypatch.setenv("SUPABASE_URL", supabase_url)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    token = make_supabase_token(
        "me@example.com",
        secret=secret,
        issuer=expected_issuer,
    )

    app = FastAPI()

    @app.get("/whoami")
    def whoami(current_user: CurrentUser = Depends(get_current_user)):
        return {"user_id": current_user.id}

    with TestClient(app) as client:
        response = client.get(
            "/whoami",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "user_id": "00000000-0000-0000-0000-000000000000"
    }


def test_current_user_rejects_wrong_supabase_issuer(monkeypatch):
    secret = "test-secret-at-least-thirty-two-bytes-long"

    monkeypatch.setenv(
        "SUPABASE_JWT_SECRET",
        secret,
    )
    monkeypatch.setenv(
        "SUPABASE_URL",
        "https://expected-project.supabase.co",
    )
    monkeypatch.setenv(
        "ALLOWED_USER_EMAILS",
        "me@example.com",
    )

    token = make_supabase_token(
        "me@example.com",
        secret=secret,
        issuer="https://different-project.supabase.co/auth/v1",
    )

    app = FastAPI()

    @app.get("/whoami")
    def whoami(current_user: CurrentUser = Depends(get_current_user)):
        return {"user_id": current_user.id}

    with TestClient(app) as client:
        response = client.get(
            "/whoami",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Invalid bearer token"
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
    assert response.json() == {
        "user_id": "00000000-0000-0000-0000-000000000000"
    }


def test_supabase_user_id_remains_stable_when_email_changes(monkeypatch):
    secret = "test-secret-at-least-thirty-two-bytes-long"
    subject = "11111111-2222-3333-4444-555555555555"

    monkeypatch.setenv("SUPABASE_JWT_SECRET", secret)
    monkeypatch.setenv(
        "ALLOWED_USER_EMAILS",
        "old@example.com,new@example.com",
    )

    app = FastAPI()

    @app.get("/whoami")
    def whoami(current_user: CurrentUser = Depends(get_current_user)):
        return {"user_id": current_user.id, "email": current_user.email}

    old_email_token = make_supabase_token(
        "old@example.com",
        secret=secret,
        subject=subject,
    )
    new_email_token = make_supabase_token(
        "new@example.com",
        secret=secret,
        subject=subject,
    )

    with TestClient(app) as client:
        old_response = client.get(
            "/whoami",
            headers={"Authorization": f"Bearer {old_email_token}"},
        )
        new_response = client.get(
            "/whoami",
            headers={"Authorization": f"Bearer {new_email_token}"},
        )

    assert old_response.status_code == 200
    assert new_response.status_code == 200
    assert old_response.json() == {
        "user_id": subject,
        "email": "old@example.com",
    }
    assert new_response.json() == {
        "user_id": subject,
        "email": "new@example.com",
    }


def test_supabase_user_rejects_token_without_subject(monkeypatch):
    secret = "test-secret-at-least-thirty-two-bytes-long"
    now = int(time.time())

    monkeypatch.setenv("SUPABASE_JWT_SECRET", secret)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    token = jwt.encode(
        {
            "aud": "authenticated",
            "exp": now + 3600,
            "iat": now,
            "email": "me@example.com",
            "role": "authenticated",
        },
        secret,
        algorithm="HS256",
    )

    app = FastAPI()

    @app.get("/whoami")
    def whoami(current_user: CurrentUser = Depends(get_current_user)):
        return {"user_id": current_user.id}

    with TestClient(app) as client:
        response = client.get(
            "/whoami",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Bearer token does not include a subject"
    }
