from datetime import UTC, datetime

from sqlalchemy import CheckConstraint, DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class ImportBatch(Base):
    __tablename__ = "import_batches"
    __table_args__ = (
        CheckConstraint("rows_total >= 0", name="ck_import_batches_rows_total_non_negative"),
        CheckConstraint(
            "rows_inserted >= 0",
            name="ck_import_batches_rows_inserted_non_negative",
        ),
        CheckConstraint(
            "rows_skipped >= 0",
            name="ck_import_batches_rows_skipped_non_negative",
        ),
        CheckConstraint(
            "rows_inserted + rows_skipped = rows_total",
            name="ck_import_batches_counts_consistent",
        ),
        Index("ix_import_batches_user_imported_at", "user_id", "imported_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(
        String(100),
        index=True,
    )

    source: Mapped[str] = mapped_column(String(50), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    rows_total: Mapped[int] = mapped_column(default=0)
    rows_inserted: Mapped[int] = mapped_column(default=0)
    rows_skipped: Mapped[int] = mapped_column(default=0)

    status: Mapped[str] = mapped_column(String(30), default="success", index=True)
