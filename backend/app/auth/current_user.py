import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import jwt
from fastapi import Depends, HTTPException, Request, status
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError, PyJWKClientError

from app.middleware.request_logging import set_request_log_user_id


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


def get_supabase_url() -> str:
    return os.getenv("SUPABASE_URL", "").strip().rstrip("/")


def get_supabase_issuer() -> str:
    supabase_url = get_supabase_url()

    if not supabase_url:
        return ""

    return f"{supabase_url}/auth/v1"


def get_supabase_decode_options() -> dict[str, str]:
    issuer = get_supabase_issuer()

    if not issuer:
        return {}

    return {"issuer": issuer}


def get_supabase_jwks_url() -> str:
    explicit_url = os.getenv("SUPABASE_JWKS_URL", "").strip()

    if explicit_url:
        return explicit_url

    supabase_url = get_supabase_url()

    if not supabase_url:
        return ""

    return f"{supabase_url}/auth/v1/.well-known/jwks.json"


def is_supabase_auth_enabled() -> bool:
    return bool(get_supabase_jwt_secret() or get_supabase_jwks_url())


def get_authorization_bearer_token(request: Request) -> str:
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")

    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    return token.strip()


@lru_cache(maxsize=4)
def get_jwks_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url)


def decode_supabase_jwt_with_legacy_secret(token: str) -> dict[str, Any]:
    secret = get_supabase_jwt_secret()

    if not secret:
        raise InvalidTokenError("Legacy JWT secret is not configured")

    return jwt.decode(
        token,
        secret,
        algorithms=["HS256"],
        audience="authenticated",
        **get_supabase_decode_options(),
    )


def decode_supabase_jwt_with_jwks(token: str) -> dict[str, Any]:
    jwks_url = get_supabase_jwks_url()

    if not jwks_url:
        raise InvalidTokenError("Supabase JWKS URL is not configured")

    signing_key = get_jwks_client(jwks_url).get_signing_key_from_jwt(token)

    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["ES256", "RS256"],
        audience="authenticated",
        **get_supabase_decode_options(),
    )


def decode_supabase_jwt(token: str) -> dict[str, Any]:
    try:
        header = jwt.get_unverified_header(token)
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token",
        )

    algorithm = header.get("alg")

    try:
        if algorithm == "HS256":
            payload = decode_supabase_jwt_with_legacy_secret(token)
        else:
            payload = decode_supabase_jwt_with_jwks(token)
    except (InvalidTokenError, PyJWKClientError):
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


def get_subject_from_supabase_payload(payload: dict[str, Any]) -> str:
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
    subject = get_subject_from_supabase_payload(payload)
    email = get_email_from_supabase_payload(payload)

    if not is_allowed_user_email(email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User email is not allowed",
        )

    return CurrentUser(id=subject, email=email)


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
    present. Production should set SUPABASE_URL and ALLOWED_USER_EMAILS.
    """

    if is_supabase_auth_enabled():
        current_user = get_supabase_user_from_request(request)
    else:
        allowed_emails = get_allowed_user_emails()

        if not allowed_emails:
            current_user = get_local_default_user()
        else:
            current_user = get_header_bridge_user_from_request(request)

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
    if current_user.id == LOCAL_DEFAULT_USER_ID and not is_supabase_auth_enabled():
        return current_user

    if current_user.email and current_user.email in get_admin_user_emails():
        return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Privileged access is required",
    )
