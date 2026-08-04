from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.pending_signup import PendingSignup


class PendingSignupRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_email(self, email: str) -> PendingSignup | None:
        statement = select(PendingSignup).where(PendingSignup.email == email)
        return self.db.scalar(statement)

    def get_by_id(self, pending_signup_id: int) -> PendingSignup | None:
        return self.db.get(PendingSignup, pending_signup_id)

    def create(self, *, user_id: str, email: str) -> PendingSignup:
        pending_signup = PendingSignup(user_id=user_id, email=email, status="pending")
        self.db.add(pending_signup)
        self.db.commit()
        self.db.refresh(pending_signup)
        return pending_signup

    def list_by_status(self, status: str) -> list[PendingSignup]:
        statement = (
            select(PendingSignup)
            .where(PendingSignup.status == status)
            .order_by(PendingSignup.requested_at.asc())
        )
        return list(self.db.scalars(statement).all())

    def set_status(
        self,
        pending_signup: PendingSignup,
        *,
        status: str,
        decided_by: str,
        decided_at: datetime,
    ) -> PendingSignup:
        pending_signup.status = status
        pending_signup.decided_by = decided_by
        pending_signup.decided_at = decided_at
        self.db.add(pending_signup)
        self.db.commit()
        self.db.refresh(pending_signup)
        return pending_signup
