from datetime import UTC, datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(
        String(100),
        default=LOCAL_DEFAULT_USER_ID,
        index=True,
    )

    source: Mapped[str] = mapped_column(String(50), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    rows_total: Mapped[int] = mapped_column(default=0)
    rows_inserted: Mapped[int] = mapped_column(default=0)
    rows_skipped: Mapped[int] = mapped_column(default=0)

    status: Mapped[str] = mapped_column(String(30), default="success", index=True)
