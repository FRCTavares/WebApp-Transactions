import time

import jwt
import pytest

from app.auth.current_user import get_current_user, get_privileged_user
from app.models.pending_signup import PendingSignup
from app.repositories.pending_signup_repository import PendingSignupRepository
from app.services import signup_notifier
from app.services.pending_signup_service import PendingSignupService


def make_pending_signup_token(
    email: str,
    secret: str = "test-secret-at-least-thirty-two-bytes-long",
    subject: str = "00000000-0000-0000-0000-000000000000",
) -> str:
    now = int(time.time())

    return jwt.encode(
        {
            "aud": "authenticated",
            "exp": now + 3600,
            "iat": now,
            "sub": subject,
            "email": email,
            "role": "authenticated",
        },
        secret,
        algorithm="HS256",
    )


def use_real_auth(client) -> None:
    client.app.dependency_overrides.pop(get_current_user, None)
    client.app.dependency_overrides.pop(get_privileged_user, None)


@pytest.fixture(autouse=True)
def no_real_notifications(monkeypatch):
    # Belt-and-suspenders: even though RESEND_API_KEY/ADMIN_NOTIFICATION_EMAIL
    # are unset in CI, make sure a real network call can never happen here.
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.delenv("ADMIN_NOTIFICATION_EMAIL", raising=False)


def test_repository_get_or_create_and_transition(db_session):
    repository = PendingSignupRepository(db_session)

    assert repository.get_by_email("new@example.com") is None

    created = repository.create(user_id="user-1", email="new@example.com")

    assert created.status == "pending"
    assert repository.get_by_email("new@example.com") is created

    fetched = repository.get_by_id(created.id)
    assert fetched is not None

    updated = repository.set_status(
        fetched,
        status="approved",
        decided_by="admin@example.com",
        decided_at=fetched.requested_at,
    )

    assert updated.status == "approved"
    assert updated.decided_by == "admin@example.com"


def test_service_returns_allowed_without_creating_a_row_for_allow_listed_email(
    db_session,
    monkeypatch,
):
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")
    service = PendingSignupService(repository=PendingSignupRepository(db_session))

    status = service.get_or_create_status(user_id="user-1", email="me@example.com")

    assert status == "allowed"
    assert (
        db_session.query(PendingSignup)
        .filter(PendingSignup.email == "me@example.com")
        .first()
        is None
    )


def test_service_creates_pending_row_once_and_notifies_only_on_first_visit(
    db_session,
    monkeypatch,
):
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "someone-else@example.com")
    notify_calls: list[str] = []
    monkeypatch.setattr(
        signup_notifier,
        "notify_admin_of_pending_signup",
        lambda email: notify_calls.append(email),
    )
    monkeypatch.setattr(
        "app.services.pending_signup_service.notify_admin_of_pending_signup",
        lambda email: notify_calls.append(email),
    )
    service = PendingSignupService(repository=PendingSignupRepository(db_session))

    first_status = service.get_or_create_status(
        user_id="user-1",
        email="new@example.com",
    )
    second_status = service.get_or_create_status(
        user_id="user-1",
        email="new@example.com",
    )

    assert first_status == "pending"
    assert second_status == "pending"
    assert notify_calls == ["new@example.com"]
    assert (
        db_session.query(PendingSignup)
        .filter(PendingSignup.email == "new@example.com")
        .count()
        == 1
    )


def test_service_approve_and_deny(db_session, monkeypatch):
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "someone-else@example.com")
    service = PendingSignupService(repository=PendingSignupRepository(db_session))
    service.get_or_create_status(user_id="user-1", email="new@example.com")

    pending = PendingSignupRepository(db_session).get_by_email("new@example.com")
    approved = service.approve(pending.id, decided_by="admin@example.com")

    assert approved.status == "approved"

    pending_two = PendingSignupRepository(db_session).create(
        user_id="user-2",
        email="denied@example.com",
    )
    denied = service.deny(pending_two.id, decided_by="admin@example.com")

    assert denied.status == "denied"


def test_access_status_endpoint_reports_allowed_for_allow_listed_email(
    client,
    monkeypatch,
):
    secret = "test-secret-at-least-thirty-two-bytes-long"
    monkeypatch.setenv("SUPABASE_JWT_SECRET", secret)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")
    use_real_auth(client)

    token = make_pending_signup_token("me@example.com", secret)

    response = client.get(
        "/api/me/access-status",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "allowed"}


def test_access_status_endpoint_creates_and_reports_pending_for_new_email(
    client,
    monkeypatch,
):
    secret = "test-secret-at-least-thirty-two-bytes-long"
    monkeypatch.setenv("SUPABASE_JWT_SECRET", secret)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "someone-else@example.com")
    use_real_auth(client)

    token = make_pending_signup_token("new@example.com", secret)

    response = client.get(
        "/api/me/access-status",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "pending"}

    # A brand-new sign-up gets no other endpoint access yet.
    denied_response = client.get(
        "/api/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert denied_response.status_code == 403


def test_admin_pending_signups_require_privileged_access(client, monkeypatch):
    secret = "test-secret-at-least-thirty-two-bytes-long"
    monkeypatch.setenv("SUPABASE_JWT_SECRET", secret)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")
    monkeypatch.setenv("ADMIN_USER_EMAILS", "admin@example.com")
    use_real_auth(client)

    token = make_pending_signup_token("me@example.com", secret)

    response = client.get(
        "/api/admin/pending-signups",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Privileged access is required"}


def test_admin_can_approve_pending_signup_and_grant_real_access(client, monkeypatch):
    secret = "test-secret-at-least-thirty-two-bytes-long"
    monkeypatch.setenv("SUPABASE_JWT_SECRET", secret)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "admin@example.com")
    monkeypatch.setenv("ADMIN_USER_EMAILS", "admin@example.com")
    use_real_auth(client)

    admin_token = make_pending_signup_token(
        "admin@example.com",
        secret,
        subject="11111111-1111-1111-1111-111111111111",
    )
    new_user_token = make_pending_signup_token(
        "new@example.com",
        secret,
        subject="22222222-2222-2222-2222-222222222222",
    )

    # New user checks in, is recorded as pending, and cannot use the app yet.
    status_response = client.get(
        "/api/me/access-status",
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    assert status_response.json() == {"status": "pending"}

    still_blocked_response = client.get(
        "/api/me",
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    assert still_blocked_response.status_code == 403

    # Admin sees it in the pending list and approves it.
    list_response = client.get(
        "/api/admin/pending-signups",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert list_response.status_code == 200
    pending_signups = list_response.json()
    assert len(pending_signups) == 1
    assert pending_signups[0]["email"] == "new@example.com"

    approve_response = client.post(
        f"/api/admin/pending-signups/{pending_signups[0]['id']}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == "approved"

    # The same new-user token can now use a real protected endpoint.
    now_allowed_response = client.get(
        "/api/me",
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    assert now_allowed_response.status_code == 200
    assert now_allowed_response.json()["email"] == "new@example.com"

    # And access-status reflects that too.
    final_status_response = client.get(
        "/api/me/access-status",
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    assert final_status_response.json() == {"status": "approved"}


def test_admin_can_deny_pending_signup(client, monkeypatch):
    secret = "test-secret-at-least-thirty-two-bytes-long"
    monkeypatch.setenv("SUPABASE_JWT_SECRET", secret)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "admin@example.com")
    monkeypatch.setenv("ADMIN_USER_EMAILS", "admin@example.com")
    use_real_auth(client)

    admin_token = make_pending_signup_token(
        "admin@example.com",
        secret,
        subject="11111111-1111-1111-1111-111111111111",
    )
    new_user_token = make_pending_signup_token(
        "denied@example.com",
        secret,
        subject="33333333-3333-3333-3333-333333333333",
    )

    client.get(
        "/api/me/access-status",
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    pending_signups = client.get(
        "/api/admin/pending-signups",
        headers={"Authorization": f"Bearer {admin_token}"},
    ).json()

    deny_response = client.post(
        f"/api/admin/pending-signups/{pending_signups[0]['id']}/deny",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert deny_response.status_code == 200
    assert deny_response.json()["status"] == "denied"

    still_blocked_response = client.get(
        "/api/me",
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    assert still_blocked_response.status_code == 403


def test_approve_missing_pending_signup_returns_404(client, monkeypatch):
    secret = "test-secret-at-least-thirty-two-bytes-long"
    monkeypatch.setenv("SUPABASE_JWT_SECRET", secret)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "admin@example.com")
    monkeypatch.setenv("ADMIN_USER_EMAILS", "admin@example.com")
    use_real_auth(client)

    admin_token = make_pending_signup_token("admin@example.com", secret)

    response = client.post(
        "/api/admin/pending-signups/999999/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 404
