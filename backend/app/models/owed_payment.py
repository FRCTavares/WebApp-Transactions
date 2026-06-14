from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class OwedPayment(Base):
    __tablename__ = "owed_payments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    person: Mapped[str] = mapped_column(String(100), index=True)
    payment_date: Mapped[date] = mapped_column(Date, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    method: Mapped[str] = mapped_column(String(30), default="cash", index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    linked_transaction_id: Mapped[Optional[int]] = mapped_column(nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )


class OwedPaymentAllocation(Base):
    __tablename__ = "owed_payment_allocations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    owed_payment_id: Mapped[int] = mapped_column(index=True)
    owed_item_id: Mapped[int] = mapped_column(index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
