"""Self-hosted sign-in: Google ID token in, the API's own session token out.

The browser signs in with Google Identity Services and sends the resulting ID
token once. We verify Google's signature and audience and answer with a compact
token signed with SESSION_SECRET (HMAC-SHA256). Every later API call presents
that token, so no request depends on Google or any third party being reachable.

Only active with AUTH_MODE=google; the default (Supabase) is unchanged.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import os
import time

from google.auth import exceptions as google_auth_exceptions
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import id_token

TOKEN_VERSION = "v1"
MIN_SESSION_SECRET_LENGTH = 32
DEFAULT_SESSION_TTL_HOURS = 24 * 30


class GoogleCredentialRejectedError(Exception):
    """The Google ID token is invalid, expired, or for another audience."""


class GoogleVerificationUnavailableError(Exception):
    """Google's signing keys could not be fetched right now."""


def get_auth_mode() -> str:
    return os.getenv("AUTH_MODE", "supabase").strip().lower() or "supabase"


def uses_google_auth() -> bool:
    return get_auth_mode() == "google"


def get_google_client_id() -> str:
    return os.getenv("GOOGLE_CLIENT_ID", "").strip()


def get_session_secret() -> str:
    return os.getenv("SESSION_SECRET", "").strip()


def get_session_ttl_hours() -> int:
    raw = os.getenv("SESSION_TTL_HOURS", "").strip()
    if not raw:
        return DEFAULT_SESSION_TTL_HOURS
    try:
        value = int(raw)
    except ValueError as error:
        raise RuntimeError("SESSION_TTL_HOURS must be a positive integer") from error
    if value <= 0:
        raise RuntimeError("SESSION_TTL_HOURS must be a positive integer")
    return value


def get_user_id_map() -> dict[str, str]:
    """`email=user-id,email2=user-id2`: pin an email to the id its rows already use."""

    mapping: dict[str, str] = {}
    for pair in os.getenv("AUTH_USER_ID_MAP", "").split(","):
        email, separator, user_id = pair.partition("=")
        email, user_id = email.strip().lower(), user_id.strip()
        if separator and email and user_id:
            mapping[email] = user_id
    return mapping


def resolve_user_id(email: str, google_sub: str) -> str:
    """The id rows are keyed by: the pinned legacy id if mapped, else Google's."""

    return get_user_id_map().get(email.strip().lower()) or f"google:{google_sub}"


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _signature(secret: str, signing_input: str) -> str:
    return _b64(
        hmac.new(
            secret.encode("utf-8"),
            signing_input.encode("ascii"),
            hashlib.sha256,
        ).digest()
    )


def issue_session_token(
    *, user_id: str, email: str, name: str, now: float | None = None
) -> tuple[str, int]:
    issued_at = int(now if now is not None else time.time())
    expires_at = issued_at + get_session_ttl_hours() * 3600
    payload = _b64(
        json.dumps(
            {"sub": user_id, "email": email, "name": name, "iat": issued_at, "exp": expires_at},
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
    )
    signing_input = f"{TOKEN_VERSION}.{payload}"
    return f"{signing_input}.{_signature(get_session_secret(), signing_input)}", expires_at


def verify_session_token(token: str, *, now: float | None = None) -> dict | None:
    """Return the session claims, or None for anything not valid and current."""

    secret = get_session_secret()
    if not secret:
        return None

    parts = token.split(".")
    if len(parts) != 3 or parts[0] != TOKEN_VERSION:
        return None

    signing_input = f"{parts[0]}.{parts[1]}"
    if not hmac.compare_digest(
        parts[2].encode("ascii", "ignore"),
        _signature(secret, signing_input).encode("ascii"),
    ):
        return None

    try:
        claims = json.loads(_unb64(parts[1]))
    except (binascii.Error, ValueError, UnicodeDecodeError):
        return None

    if (
        not isinstance(claims, dict)
        or not isinstance(claims.get("sub"), str)
        or not claims["sub"]
        or not isinstance(claims.get("email"), str)
        or not isinstance(claims.get("exp"), int)
    ):
        return None

    if claims["exp"] <= (now if now is not None else time.time()):
        return None

    return claims


def verify_google_credential(credential: str) -> dict:
    """Verify a Google ID token for our client id and return its claims."""

    try:
        return id_token.verify_oauth2_token(
            credential,
            GoogleAuthRequest(),
            get_google_client_id(),
            clock_skew_in_seconds=30,
        )
    except google_auth_exceptions.TransportError as error:
        raise GoogleVerificationUnavailableError from error
    except (ValueError, google_auth_exceptions.GoogleAuthError) as error:
        raise GoogleCredentialRejectedError from error
