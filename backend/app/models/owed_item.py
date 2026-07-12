from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import CheckConstraint, Date, DateTime, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class OwedItem(Base):
    __tablename__ = "owed_items"
    __table_args__ = (
        CheckConstraint("amount_total > 0", name="ck_owed_items_amount_total_positive"),
        CheckConstraint("amount_paid >= 0", name="ck_owed_items_amount_paid_non_negative"),
        CheckConstraint(
            "amount_remaining >= 0",
            name="ck_owed_items_amount_remaining_non_negative",
        ),
        CheckConstraint(
            "abs((amount_paid + amount_remaining) - amount_total) <= 0.01",
            name="ck_owed_items_balance_consistent",
        ),
        CheckConstraint(
            "status IN ('open', 'partially_paid', 'paid', 'cancelled')",
            name="ck_owed_items_status_known",
        ),
        Index(
            "ix_owed_items_user_dedupe_hash",
            "user_id",
            "dedupe_hash",
            unique=True,
        ),
        Index("ix_owed_items_user_status_person", "user_id", "status", "person"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(
        String(100),
        index=True,
    )

    person: Mapped[str] = mapped_column(String(100), index=True)
    amount_total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    amount_remaining: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    reason: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(30), default="open", index=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    linked_transaction_id: Mapped[Optional[int]] = mapped_column(nullable=True, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    source: Mapped[str] = mapped_column(String(50), index=True, default="manual")
    import_batch_id: Mapped[Optional[int]] = mapped_column(nullable=True, index=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    dedupe_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )
