import json
import time

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth import google_session
from app.auth.current_user import (
    CurrentUser,
    get_admin_user_emails,
    get_allowed_user_emails,
    get_current_user,
    get_privileged_user,
    is_allowed_user_email,
    normalise_user_email,
)

SECRET = "test-secret-at-least-thirty-two-bytes-long"
SUBJECT = "00000000-0000-0000-0000-000000000000"


def make_token(email: str | None, subject: str | None = SUBJECT, secret: str = SECRET, ttl: int = 3600) -> str:
    """A session token in the format the API issues, signed with `secret`."""

    now = int(time.time())
    claims: dict[str, object] = {"iat": now, "exp": now + ttl, "name": "Test"}
    if subject is not None:
        claims["sub"] = subject
    if email is not None:
        claims["email"] = email
    signing_input = f"{google_session.TOKEN_VERSION}.{google_session._b64(json.dumps(claims).encode())}"
    return f"{signing_input}.{google_session._signature(secret, signing_input)}"


def whoami_app(dependency=get_current_user) -> FastAPI:
    app = FastAPI()

    @app.get("/whoami")
    def whoami(current_user: CurrentUser = Depends(dependency)):
        return {"user_id": current_user.id, "email": current_user.email}

    return app


def get(app: FastAPI, token: str | None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    with TestClient(app) as client:
        return client.get("/whoami", headers=headers)


def test_allowed_user_email_helpers(monkeypatch):
    monkeypatch.setenv("ALLOWED_USER_EMAILS", " ME@example.com, family@example.com ")

    assert normalise_user_email(" ME@example.com ") == "me@example.com"
    assert get_allowed_user_emails() == {"me@example.com", "family@example.com"}
    assert is_allowed_user_email("FAMILY@example.com") is True
    assert is_allowed_user_email("other@example.com") is False


def test_current_user_returns_the_allowed_session_user(monkeypatch):
    monkeypatch.setenv("SESSION_SECRET", SECRET)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    response = get(whoami_app(), make_token("ME@example.com"))

    assert response.status_code == 200
    assert response.json() == {"user_id": SUBJECT, "email": "me@example.com"}


def test_current_user_rejects_a_missing_bearer_token(monkeypatch):
    monkeypatch.setenv("SESSION_SECRET", SECRET)

    response = get(whoami_app(), None)

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing bearer token"}


def test_current_user_rejects_garbage_a_bad_signature_and_an_expired_token(monkeypatch):
    monkeypatch.setenv("SESSION_SECRET", SECRET)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")
    app = whoami_app()

    for token in ("not-a-token", make_token("me@example.com", secret="another-secret-of-thirty-two-bytes-x"), make_token("me@example.com", ttl=-10)):
        response = get(app, token)
        assert response.status_code == 401
        assert response.json() == {"detail": "Invalid bearer token"}


def test_current_user_rejects_tokens_when_no_session_secret_is_configured(monkeypatch):
    monkeypatch.delenv("SESSION_SECRET", raising=False)

    response = get(whoami_app(), make_token("me@example.com"))

    assert response.status_code == 401


def test_current_user_rejects_an_email_that_is_not_allowed(monkeypatch):
    monkeypatch.setenv("SESSION_SECRET", SECRET)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    response = get(whoami_app(), make_token("other@example.com"))

    assert response.status_code == 403
    assert response.json() == {"detail": "User email is not allowed"}


def test_admin_user_email_helpers(monkeypatch):
    monkeypatch.setenv("ADMIN_USER_EMAILS", " ADMIN@example.com, second@example.com ")

    assert get_admin_user_emails() == {"admin@example.com", "second@example.com"}


def test_privileged_user_rejects_authenticated_non_admin(monkeypatch):
    monkeypatch.setenv("SESSION_SECRET", SECRET)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")
    monkeypatch.setenv("ADMIN_USER_EMAILS", "admin@example.com")

    response = get(whoami_app(get_privileged_user), make_token("me@example.com"))

    assert response.status_code == 403
    assert response.json() == {"detail": "Privileged access is required"}


def test_privileged_user_accepts_configured_admin(monkeypatch):
    monkeypatch.setenv("SESSION_SECRET", SECRET)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "admin@example.com")
    monkeypatch.setenv("ADMIN_USER_EMAILS", "admin@example.com")

    response = get(whoami_app(get_privileged_user), make_token("ADMIN@example.com"))

    assert response.status_code == 200
    assert response.json()["user_id"] == SUBJECT


def test_user_id_remains_stable_when_email_changes(monkeypatch):
    subject = "11111111-2222-3333-4444-555555555555"
    monkeypatch.setenv("SESSION_SECRET", SECRET)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "old@example.com,new@example.com")
    app = whoami_app()

    old = get(app, make_token("old@example.com", subject=subject))
    new = get(app, make_token("new@example.com", subject=subject))

    assert old.json() == {"user_id": subject, "email": "old@example.com"}
    assert new.json() == {"user_id": subject, "email": "new@example.com"}


def test_current_user_rejects_a_token_without_subject_or_email(monkeypatch):
    monkeypatch.setenv("SESSION_SECRET", SECRET)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")
    app = whoami_app()

    for token in (make_token("me@example.com", subject=None), make_token(None)):
        response = get(app, token)
        assert response.status_code == 401
        assert response.json() == {"detail": "Invalid bearer token"}
