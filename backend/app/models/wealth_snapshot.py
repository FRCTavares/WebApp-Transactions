from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class WealthSnapshot(Base):
    __tablename__ = "wealth_snapshots"
    __table_args__ = (
        Index(
            "ix_wealth_snapshots_user_dedupe_hash",
            "user_id",
            "dedupe_hash",
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(
        String(100),
        default=LOCAL_DEFAULT_USER_ID,
        index=True,
    )

    snapshot_date: Mapped[date] = mapped_column(Date, index=True)
    account_id: Mapped[int] = mapped_column(index=True)

    balance: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="EUR", index=True)
    balance_eur: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    fx_rate_to_eur: Mapped[Decimal] = mapped_column(Numeric(18, 8), default=1)

    interest_earned: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(50), default="manual", index=True)
    import_batch_id: Mapped[Optional[int]] = mapped_column(nullable=True, index=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    dedupe_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )
