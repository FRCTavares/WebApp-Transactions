import pytest

from app.auth import google_session
from app.auth.current_user import get_current_user, get_privileged_user
from app.auth.google_session import (
    GoogleCredentialRejected,
    GoogleVerificationUnavailable,
    issue_session_token,
    resolve_user_id,
    verify_session_token,
)
from app.config import validate_production_config

SECRET = "x" * 48
CREDENTIAL = "g" * 40


@pytest.fixture(autouse=True)
def google_mode(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "google")
    monkeypatch.setenv("SESSION_SECRET", SECRET)
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com")
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")
    monkeypatch.setenv("ADMIN_USER_EMAILS", "me@example.com")
    monkeypatch.delenv("AUTH_USER_ID_MAP", raising=False)


@pytest.fixture
def real_auth(client):
    client.app.dependency_overrides.pop(get_current_user, None)
    client.app.dependency_overrides.pop(get_privileged_user, None)
    return client


def token_for(email="me@example.com", user_id="user-1", **kwargs):
    return issue_session_token(user_id=user_id, email=email, name="Me", **kwargs)[0]


def test_session_token_round_trip():
    claims = verify_session_token(token_for())

    assert claims is not None
    assert claims["sub"] == "user-1"
    assert claims["email"] == "me@example.com"


def test_session_token_rejects_tampering_expiry_and_wrong_secret(monkeypatch):
    token = token_for()
    header, payload, signature = token.split(".")

    assert verify_session_token(f"{header}.{payload}x.{signature}") is None
    assert verify_session_token(f"v2.{payload}.{signature}") is None
    assert verify_session_token("not-a-token") is None
    assert verify_session_token(token, now=4_000_000_000) is None

    monkeypatch.setenv("SESSION_SECRET", "y" * 48)
    assert verify_session_token(token) is None


def test_user_id_map_pins_the_legacy_id(monkeypatch):
    monkeypatch.setenv("AUTH_USER_ID_MAP", "Me@Example.com=abc-123, other@example.com=def-456")

    assert resolve_user_id("me@example.com", "sub-1") == "abc-123"
    assert resolve_user_id("other@example.com", "sub-2") == "def-456"
    assert resolve_user_id("new@example.com", "sub-3") == "google:sub-3"


def test_sign_in_issues_a_session_that_the_api_accepts(real_auth, monkeypatch):
    monkeypatch.setenv("AUTH_USER_ID_MAP", "me@example.com=legacy-uuid")
    monkeypatch.setattr(
        "app.routers.auth_session.verify_google_credential",
        lambda credential: {"email": "Me@Example.com", "email_verified": True, "sub": "g1", "name": "Me"},
    )

    response = real_auth.post("/api/auth/google", json={"credential": CREDENTIAL})

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["id"] == "legacy-uuid"

    me = real_auth.get("/api/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.status_code == 200
    assert me.json() == {"user_id": "legacy-uuid", "email": "me@example.com"}


def test_sign_in_requires_a_verified_email(real_auth, monkeypatch):
    monkeypatch.setattr(
        "app.routers.auth_session.verify_google_credential",
        lambda credential: {"email": "me@example.com", "email_verified": False, "sub": "g1"},
    )

    assert real_auth.post("/api/auth/google", json={"credential": CREDENTIAL}).status_code == 403


@pytest.mark.parametrize(
    ("error", "status"),
    [(GoogleCredentialRejected, 401), (GoogleVerificationUnavailable, 503)],
)
def test_sign_in_maps_google_failures(real_auth, monkeypatch, error, status):
    def fail(credential):
        raise error

    monkeypatch.setattr("app.routers.auth_session.verify_google_credential", fail)

    assert real_auth.post("/api/auth/google", json={"credential": CREDENTIAL}).status_code == status


def test_sign_in_is_absent_outside_google_mode(real_auth, monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "supabase")

    assert real_auth.post("/api/auth/google", json={"credential": CREDENTIAL}).status_code == 404


def test_uninvited_email_is_blocked_by_the_normal_gate(real_auth):
    response = real_auth.get(
        "/api/me", headers={"Authorization": f"Bearer {token_for(email='stranger@example.com')}"}
    )

    assert response.status_code == 403


def test_api_rejects_a_missing_or_forged_session(real_auth):
    assert real_auth.get("/api/me").status_code == 401
    assert real_auth.get("/api/me", headers={"Authorization": "Bearer forged.token.value"}).status_code == 401


def test_account_deletion_needs_no_identity_provider(real_auth, monkeypatch):
    monkeypatch.setattr(
        "app.services.account_deletion_service.requests.delete",
        lambda *a, **k: pytest.fail("must not call Supabase in google mode"),
    )
    token = token_for()

    response = real_auth.delete(
        "/api/me",
        headers={"Authorization": f"Bearer {token}", "X-Confirm-Account-Deletion": "me@example.com"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "deleted"


def test_production_validation_for_google_mode(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@db/fitness")
    monkeypatch.setenv("CORS_ORIGINS", "https://finance.example.test")
    monkeypatch.delenv("SUPABASE_URL", raising=False)

    validate_production_config()

    monkeypatch.setenv("SESSION_SECRET", "short")
    with pytest.raises(RuntimeError, match="SESSION_SECRET"):
        validate_production_config()

    monkeypatch.setenv("SESSION_SECRET", SECRET)
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "nope")
    with pytest.raises(RuntimeError, match="GOOGLE_CLIENT_ID"):
        validate_production_config()


def test_google_session_module_defaults_to_supabase(monkeypatch):
    monkeypatch.delenv("AUTH_MODE", raising=False)

    assert google_session.uses_google_auth() is False
