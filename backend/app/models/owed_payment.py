from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class OwedPayment(Base):
    __tablename__ = "owed_payments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_owed_payments_amount_positive"),
        CheckConstraint("length(currency) = 3", name="ck_owed_payments_currency_length"),
        CheckConstraint(
            "method IN ('cash', 'bank_transfer', 'mbway', 'other')",
            name="ck_owed_payments_method_known",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(
        String(100),
        index=True,
    )

    person: Mapped[str] = mapped_column(String(100), index=True)
    payment_date: Mapped[date] = mapped_column(Date, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    method: Mapped[str] = mapped_column(String(30), default="cash", index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    linked_transaction_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("transactions.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    unallocated_category: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    unallocated_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )


class OwedPaymentAllocation(Base):
    __tablename__ = "owed_payment_allocations"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_owed_payment_allocations_amount_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(
        String(100),
        index=True,
    )

    owed_payment_id: Mapped[int] = mapped_column(
        ForeignKey("owed_payments.id", ondelete="CASCADE"),
        index=True,
    )
    owed_item_id: Mapped[int] = mapped_column(
        ForeignKey("owed_items.id", ondelete="RESTRICT"),
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
