import os
from dataclasses import dataclass
from typing import Any

import jwt
from fastapi import HTTPException, Request, status
from jwt import InvalidTokenError


LOCAL_DEFAULT_USER_ID = "local-default-user"
USER_EMAIL_HEADER = "X-App-User-Email"


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


def get_local_default_user() -> CurrentUser:
    return CurrentUser(id=LOCAL_DEFAULT_USER_ID)


def get_supabase_jwt_secret() -> str:
    return os.getenv("SUPABASE_JWT_SECRET", "").strip()


def is_supabase_auth_enabled() -> bool:
    return bool(get_supabase_jwt_secret())


def get_authorization_bearer_token(request: Request) -> str:
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")

    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    return token.strip()


def decode_supabase_jwt(token: str) -> dict[str, Any]:
    secret = get_supabase_jwt_secret()

    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase auth is not configured",
        )

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token",
        )

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token",
        )

    return payload


def get_email_from_supabase_payload(payload: dict[str, Any]) -> str:
    raw_email = payload.get("email")

    if not isinstance(raw_email, str) or not raw_email.strip():
        user_metadata = payload.get("user_metadata")

        if isinstance(user_metadata, dict):
            raw_email = user_metadata.get("email")

    if not isinstance(raw_email, str) or not raw_email.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token does not include an email",
        )

    return normalise_user_email(raw_email)


def get_supabase_user_from_request(request: Request) -> CurrentUser:
    token = get_authorization_bearer_token(request)
    payload = decode_supabase_jwt(token)
    email = get_email_from_supabase_payload(payload)

    if not is_allowed_user_email(email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User email is not allowed",
        )

    return CurrentUser(id=email, email=email)


def get_header_bridge_user_from_request(request: Request) -> CurrentUser:
    email = normalise_user_email(request.headers.get(USER_EMAIL_HEADER, ""))

    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing user email",
        )

    if not is_allowed_user_email(email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User email is not allowed",
        )

    return CurrentUser(id=email, email=email)


def get_current_user(request: Request) -> CurrentUser:
    """Return the current user for FastAPI dependency injection.

    Local development keeps the stable local default user when no auth config is
    present. Production should set SUPABASE_JWT_SECRET and ALLOWED_USER_EMAILS.
    """

    if is_supabase_auth_enabled():
        return get_supabase_user_from_request(request)

    allowed_emails = get_allowed_user_emails()

    if not allowed_emails:
        return get_local_default_user()

    return get_header_bridge_user_from_request(request)
