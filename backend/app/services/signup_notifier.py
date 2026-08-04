"""Notifies the app owner about a new pending sign-up, via Resend.

Best-effort only: if Resend is not configured, or the API call fails, this
logs and returns rather than raising. A missing/failed notification must
never block the access-status endpoint - the pending sign-up itself is
already recorded in the database and visible in the admin panel regardless
of whether the email goes out.
"""

import logging
import os

import requests


logger = logging.getLogger("app.signup_notifier")

RESEND_API_URL = "https://api.resend.com/emails"
NOTIFICATION_TIMEOUT_SECONDS = 10


def notify_admin_of_pending_signup(email: str) -> None:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    notify_email = os.getenv("ADMIN_NOTIFICATION_EMAIL", "").strip()

    if not api_key or not notify_email:
        logger.info(
            "New pending sign-up awaiting approval (email notification not "
            "configured): %s",
            email,
        )
        return

    try:
        response = requests.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "from": "F - Transactions <onboarding@resend.dev>",
                "to": [notify_email],
                "subject": "New sign-up request for F - Transactions",
                "text": (
                    f"{email} signed in with Google and is waiting for "
                    "approval. Approve or deny it from Settings in the app."
                ),
            },
            timeout=NOTIFICATION_TIMEOUT_SECONDS,
        )

        if response.status_code >= 400:
            logger.warning(
                "Resend rejected the pending-signup notification for %s "
                "(status %s): %s",
                email,
                response.status_code,
                response.text[:500],
            )
    except requests.RequestException:
        logger.warning(
            "Failed to send pending-signup notification email for %s",
            email,
            exc_info=True,
        )
