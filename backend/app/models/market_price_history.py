from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class MarketPriceHistory(Base):
    __tablename__ = "market_price_history"
    __table_args__ = (
        UniqueConstraint(
            "ticker",
            "isin",
            "price_date",
            "source",
            name="uq_market_price_history_identity",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    ticker: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    isin: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)

    price_date: Mapped[date] = mapped_column(Date, index=True)
    close_price: Mapped[Decimal] = mapped_column(Numeric(18, 8))
    currency: Mapped[str] = mapped_column(String(3), default="EUR", index=True)
    source: Mapped[str] = mapped_column(String(50), default="yfinance", index=True)

    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )
