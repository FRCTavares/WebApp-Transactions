import os
from dataclasses import dataclass

from fastapi import HTTPException, Request, status


LOCAL_DEFAULT_USER_ID = "local-default-user"
USER_EMAIL_HEADER = "X-App-User-Email"


@dataclass(frozen=True)
class CurrentUser:
    """Authenticated user context used by services and repositories.

    For local-first development, this can still resolve to one fixed local user.
    When ALLOWED_USER_EMAILS is configured, the request must include an allowed
    email address. Later, real OAuth/Supabase auth can replace this dependency
    while preserving the CurrentUser shape used by routers and services.
    """

    id: str
    email: str | None = None


def normalise_user_email(email: str) -> str:
    return email.strip().lower()


def get_allowed_user_emails() -> set[str]:
    raw_emails = os.getenv("ALLOWED_USER_EMAILS", "")

    return {
        normalise_user_email(email)
        for email in raw_emails.split(",")
        if normalise_user_email(email)
    }


def is_allowed_user_email(email: str) -> bool:
    allowed_emails = get_allowed_user_emails()

    if not allowed_emails:
        return True

    return normalise_user_email(email) in allowed_emails


def get_local_default_user() -> CurrentUser:
    return CurrentUser(id=LOCAL_DEFAULT_USER_ID)


def get_current_user(request: Request) -> CurrentUser:
    """Return the current user for FastAPI dependency injection.

    If ALLOWED_USER_EMAILS is not configured, the app keeps the local default
    user. If it is configured, an allowed email must be present in
    X-App-User-Email. This header is a temporary bridge and must later be
    replaced by a real identity provider before serious public use.
    """

    allowed_emails = get_allowed_user_emails()

    if not allowed_emails:
        return get_local_default_user()

    email = normalise_user_email(request.headers.get(USER_EMAIL_HEADER, ""))

    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing user email",
        )

    if email not in allowed_emails:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User email is not allowed",
        )

    return CurrentUser(id=email, email=email)
