from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import Date, DateTime, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        Index(
            "ix_transactions_user_dedupe_hash",
            "user_id",
            "dedupe_hash",
            unique=True,
        ),
    )

    def __init__(self, **kwargs: Any) -> None:
        if kwargs.get("cashflow_type") is None:
            direction = kwargs.get("direction")
            kwargs["cashflow_type"] = "income" if direction == "in" else "expense"

        super().__init__(**kwargs)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(
        String(100),
        default=LOCAL_DEFAULT_USER_ID,
        index=True,
    )

    date: Mapped[date] = mapped_column(Date, index=True)
    description: Mapped[str] = mapped_column(String(255))
    raw_description: Mapped[str] = mapped_column(Text)

    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    original_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    original_currency: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    fx_rate_to_eur: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 8), nullable=True)
    fx_rate_source: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    direction: Mapped[str] = mapped_column(String(10), index=True)
    cashflow_type: Mapped[str] = mapped_column(String(30), index=True)

    source: Mapped[str] = mapped_column(String(50), index=True, default="manual")
    account: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    subcategory: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")

    merchant: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    import_batch_id: Mapped[Optional[int]] = mapped_column(nullable=True, index=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    dedupe_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )
