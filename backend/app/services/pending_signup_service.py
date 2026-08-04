from datetime import UTC, datetime

from fastapi import HTTPException, status

from app.auth.current_user import is_allowed_user_email
from app.models.pending_signup import PendingSignup
from app.repositories.pending_signup_repository import PendingSignupRepository
from app.services.signup_notifier import notify_admin_of_pending_signup


class PendingSignupService:
    def __init__(self, repository: PendingSignupRepository) -> None:
        self.repository = repository

    def get_or_create_status(self, *, user_id: str, email: str) -> str:
        """Return the caller's access status, recording a first-time visit.

        Only called from the unauthenticated-but-JWT-valid access-status
        endpoint. Does not grant access on its own - `get_current_user`
        (checked on every other endpoint) is the real enforcement point.
        """

        if is_allowed_user_email(email):
            return "allowed"

        pending_signup = self.repository.get_by_email(email)

        if pending_signup is None:
            pending_signup = self.repository.create(user_id=user_id, email=email)
            notify_admin_of_pending_signup(email)

        return pending_signup.status

    def list_pending(self) -> list[PendingSignup]:
        return self.repository.list_by_status("pending")

    def approve(self, pending_signup_id: int, *, decided_by: str) -> PendingSignup:
        return self._decide(
            pending_signup_id,
            new_status="approved",
            decided_by=decided_by,
        )

    def deny(self, pending_signup_id: int, *, decided_by: str) -> PendingSignup:
        return self._decide(
            pending_signup_id,
            new_status="denied",
            decided_by=decided_by,
        )

    def _decide(
        self,
        pending_signup_id: int,
        *,
        new_status: str,
        decided_by: str,
    ) -> PendingSignup:
        pending_signup = self.repository.get_by_id(pending_signup_id)

        if pending_signup is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pending signup not found",
            )

        return self.repository.set_status(
            pending_signup,
            status=new_status,
            decided_by=decided_by,
            decided_at=datetime.now(UTC),
        )
