from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


def create_preview_id() -> str:
    return str(uuid4())


class ImportPreview(Base):
    __tablename__ = "import_previews"
    __table_args__ = (
        CheckConstraint(
            "rows_total >= 0",
            name="ck_import_previews_rows_total_non_negative",
        ),
        CheckConstraint(
            "rows_valid >= 0",
            name="ck_import_previews_rows_valid_non_negative",
        ),
        CheckConstraint(
            "rows_duplicates >= 0",
            name="ck_import_previews_rows_duplicates_non_negative",
        ),
        CheckConstraint(
            "rows_invalid >= 0",
            name="ck_import_previews_rows_invalid_non_negative",
        ),
        CheckConstraint(
            "transactions_pending >= 0",
            name="ck_import_previews_transactions_pending_non_negative",
        ),
        CheckConstraint(
            "investment_events_pending >= 0",
            name="ck_import_previews_events_pending_non_negative",
        ),
        CheckConstraint(
            "owed_items_pending >= 0",
            name="ck_import_previews_owed_pending_non_negative",
        ),
        CheckConstraint(
            "wealth_snapshots_pending >= 0",
            name="ck_import_previews_wealth_pending_non_negative",
        ),
        CheckConstraint(
            "length(file_sha256) = 64",
            name="ck_import_previews_sha256_length",
        ),
        Index(
            "ix_import_previews_user_created_at",
            "user_id",
            "created_at",
        ),
        Index(
            "ix_import_previews_user_expires_at",
            "user_id",
            "expires_at",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=create_preview_id,
    )
    user_id: Mapped[str] = mapped_column(String(100), index=True)
    mode: Mapped[str] = mapped_column(String(40), index=True)
    source: Mapped[str] = mapped_column(String(50), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    file_sha256: Mapped[str] = mapped_column(String(64))

    rows_total: Mapped[int] = mapped_column(default=0)
    rows_valid: Mapped[int] = mapped_column(default=0)
    rows_duplicates: Mapped[int] = mapped_column(default=0)
    rows_invalid: Mapped[int] = mapped_column(default=0)
    transactions_pending: Mapped[int] = mapped_column(default=0)
    investment_events_pending: Mapped[int] = mapped_column(default=0)
    owed_items_pending: Mapped[int] = mapped_column(default=0)
    wealth_snapshots_pending: Mapped[int] = mapped_column(default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
