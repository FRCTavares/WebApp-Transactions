from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.auth.google_session import (
    GoogleCredentialRejected,
    GoogleVerificationUnavailable,
    issue_session_token,
    resolve_user_id,
    uses_google_auth,
    verify_google_credential,
)


router = APIRouter(prefix="/api/auth", tags=["auth"])


class GoogleSignInPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    credential: str = Field(min_length=20, max_length=8192)


@router.post("/google")
def sign_in_with_google(payload: GoogleSignInPayload) -> dict[str, object]:
    """Exchange a Google ID token for this API's session token.

    Reachable without a bearer token (it is how a client gets its first one) and
    only present in AUTH_MODE=google. Like the Supabase flow it does not apply
    the invite list: that gate stays in `get_current_user`, so an email that is
    not invited yet can still sign in and be told its sign-up is pending.
    """

    if not uses_google_auth():
        raise HTTPException(status_code=404, detail="Not found.")

    try:
        claims = verify_google_credential(payload.credential)
    except GoogleVerificationUnavailable as error:
        raise HTTPException(
            status_code=503,
            detail="Google sign-in verification is temporarily unavailable.",
        ) from error
    except GoogleCredentialRejected as error:
        raise HTTPException(status_code=401, detail="Invalid Google credential.") from error

    email = str(claims.get("email") or "").strip().lower()

    if not email or claims.get("email_verified") is not True:
        raise HTTPException(
            status_code=403, detail="This Google account has no verified email."
        )

    user_id = resolve_user_id(email, str(claims.get("sub") or ""))
    name = str(claims.get("name") or "")
    token, expires_at = issue_session_token(user_id=user_id, email=email, name=name)

    return {
        "token": token,
        "expiresAt": datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat(),
        "user": {
            "id": user_id,
            "email": email,
            "displayName": name.strip() or email.split("@")[0] or "there",
        },
    }
