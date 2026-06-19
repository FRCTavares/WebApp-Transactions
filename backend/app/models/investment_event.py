from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class InvestmentEvent(Base):
    __tablename__ = "investment_events"
    __table_args__ = (
        Index(
            "ix_investment_events_user_dedupe_hash",
            "user_id",
            "dedupe_hash",
            unique=True,
        ),
        Index("ix_investment_events_user_date", "user_id", "date"),
        Index("ix_investment_events_user_source_date", "user_id", "source", "date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(
        String(100),
        default=LOCAL_DEFAULT_USER_ID,
        index=True,
    )

    date: Mapped[date] = mapped_column(Date, index=True)
    source: Mapped[str] = mapped_column(String(50), index=True, default="manual")
    account: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    event_type: Mapped[str] = mapped_column(String(50), index=True)
    description: Mapped[str] = mapped_column(String(255))
    raw_description: Mapped[str] = mapped_column(Text)

    instrument_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ticker: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    isin: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)

    quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 8), nullable=True)
    price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 8), nullable=True)
    fees: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    taxes: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)

    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="EUR")

    original_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    original_currency: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    fx_rate_to_eur: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 8), nullable=True)
    fx_rate_source: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    transaction_id: Mapped[Optional[int]] = mapped_column(nullable=True, index=True)
    funding_source: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    funding_match_status: Mapped[Optional[str]] = mapped_column(String(30), nullable=True, index=True)
    matched_transaction_id: Mapped[Optional[int]] = mapped_column(nullable=True, index=True)
    import_batch_id: Mapped[Optional[int]] = mapped_column(nullable=True, index=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    dedupe_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )
