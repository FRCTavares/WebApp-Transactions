from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import CheckConstraint, Date, DateTime, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class WealthSnapshot(Base):
    __tablename__ = "wealth_snapshots"
    __table_args__ = (
        CheckConstraint("balance >= 0", name="ck_wealth_snapshots_balance_non_negative"),
        CheckConstraint(
            "balance_eur >= 0",
            name="ck_wealth_snapshots_balance_eur_non_negative",
        ),
        CheckConstraint("fx_rate_to_eur > 0", name="ck_wealth_snapshots_fx_rate_positive"),
        CheckConstraint(
            "interest_earned IS NULL OR interest_earned >= 0",
            name="ck_wealth_snapshots_interest_non_negative",
        ),
        CheckConstraint("length(currency) = 3", name="ck_wealth_snapshots_currency_length"),
        Index(
            "ix_wealth_snapshots_user_dedupe_hash",
            "user_id",
            "dedupe_hash",
            unique=True,
        ),
        Index(
            "ix_wealth_snapshots_user_account_date",
            "user_id",
            "account_id",
            "snapshot_date",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(
        String(100),
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
