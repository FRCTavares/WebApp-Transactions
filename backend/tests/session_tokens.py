"""Session tokens in the format the API issues, for tests that exercise the real auth dependency."""

import json
import time

from app.auth import google_session

DEFAULT_SECRET = "test-secret-at-least-thirty-two-bytes-long"
DEFAULT_SUBJECT = "00000000-0000-0000-0000-000000000000"


def make_session_token(
    email: str,
    secret: str = DEFAULT_SECRET,
    subject: str = DEFAULT_SUBJECT,
    ttl: int = 3600,
) -> str:
    now = int(time.time())
    claims = {"sub": subject, "email": email, "name": "Test", "iat": now, "exp": now + ttl}
    signing_input = f"{google_session.TOKEN_VERSION}.{google_session._b64(json.dumps(claims).encode())}"
    return f"{signing_input}.{google_session._signature(secret, signing_input)}"
