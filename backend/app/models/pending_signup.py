from datetime import UTC, datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class PendingSignup(Base):
    """A Google sign-in from an email not on the static allow-list.

    Created the first time an unrecognised, JWT-authenticated email calls
    the access-status endpoint. An admin (`ADMIN_USER_EMAILS`) must approve
    it before that email is granted access to any other endpoint.
    """

    __tablename__ = "pending_signups"
    __table_args__ = (
        UniqueConstraint("email", name="uq_pending_signups_email"),
        CheckConstraint(
            "status IN ('pending', 'approved', 'denied')",
            name="ck_pending_signups_status_known",
        ),
        Index("ix_pending_signups_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(100), index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")

    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
    )
    decided_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    decided_by: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
