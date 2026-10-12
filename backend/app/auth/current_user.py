import os
from dataclasses import dataclass
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.google_session import verify_session_token
from app.database import get_db
from app.middleware.request_logging import set_request_log_user_id
from app.repositories.pending_signup_repository import PendingSignupRepository


LOCAL_DEFAULT_USER_ID = "local-default-user"


@dataclass(frozen=True)
class CurrentUser:
    """Authenticated user context used by services and repositories."""

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



def get_authorization_bearer_token(request: Request) -> str:
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")

    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    return token.strip()


def decode_session_token(token: str) -> dict[str, Any]:
    """Claims from this API's own session token."""

    claims = verify_session_token(token)

    if claims is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token",
        )

    return claims


def get_subject_from_claims(payload: dict[str, Any]) -> str:
    raw_subject = payload.get("sub")

    if not isinstance(raw_subject, str) or not raw_subject.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token does not include a subject",
        )

    subject = raw_subject.strip()

    if len(subject) > 100:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token subject is too long",
        )

    return subject


def get_email_from_claims(payload: dict[str, Any]) -> str:
    raw_email = payload.get("email")

    if not isinstance(raw_email, str) or not raw_email.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token does not include an email",
        )

    return normalise_user_email(raw_email)


def is_approved_pending_signup(email: str, *, db: Session) -> bool:
    pending_signup = PendingSignupRepository(db).get_by_email(email)
    return pending_signup is not None and pending_signup.status == "approved"


def get_authenticated_user(request: Request) -> CurrentUser:
    """Validate the bearer JWT only - no allow-list/approval gate.

    Used solely by the access-status endpoint, which must be reachable by
    any successfully authenticated user (including someone whose
    sign-up is still pending approval) so they can be told their status.
    Every other endpoint must keep using `get_current_user` below.
    """

    token = get_authorization_bearer_token(request)
    payload = decode_session_token(token)
    subject = get_subject_from_claims(payload)
    email = get_email_from_claims(payload)

    return CurrentUser(id=subject, email=email)


def get_user_from_request(
    request: Request,
    db: Session,
) -> CurrentUser:
    token = get_authorization_bearer_token(request)
    payload = decode_session_token(token)
    subject = get_subject_from_claims(payload)
    email = get_email_from_claims(payload)

    if not is_allowed_user_email(email) and not is_approved_pending_signup(
        email,
        db=db,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User email is not allowed",
        )

    return CurrentUser(id=subject, email=email)



def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> CurrentUser:
    """Return the authenticated user."""

    current_user = get_user_from_request(request, db=db)
    set_request_log_user_id(
        request.scope,
        current_user.id,
    )
    return current_user


def get_admin_user_emails() -> set[str]:
    raw_emails = os.getenv("ADMIN_USER_EMAILS", "")

    return {
        normalise_user_email(email)
        for email in raw_emails.split(",")
        if normalise_user_email(email)
    }


def get_privileged_user(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    if current_user.email and current_user.email in get_admin_user_emails():
        return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Privileged access is required",
    )
