from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class OwedItemEvent(Base):
    __tablename__ = "owed_item_events"
    __table_args__ = (
        CheckConstraint(
            "event_type IN ("
            "'created', "
            "'adjusted', "
            "'payment', "
            "'payment_reversed', "
            "'cancelled', "
            "'reopened', "
            "'deleted'"
            ")",
            name="ck_owed_item_events_event_type_known",
        ),
        CheckConstraint(
            "amount_total > 0",
            name="ck_owed_item_events_amount_total_positive",
        ),
        CheckConstraint(
            "amount_paid >= 0",
            name="ck_owed_item_events_amount_paid_non_negative",
        ),
        CheckConstraint(
            "amount_remaining >= 0",
            name="ck_owed_item_events_amount_remaining_non_negative",
        ),
        CheckConstraint(
            "abs((amount_paid + amount_remaining) - amount_total) <= 0.01",
            name="ck_owed_item_events_balance_consistent",
        ),
        CheckConstraint(
            "status IN ('open', 'partially_paid', 'paid', 'cancelled')",
            name="ck_owed_item_events_status_known",
        ),
        Index(
            "ix_owed_item_events_user_effective_date",
            "user_id",
            "effective_date",
        ),
        Index(
            "ix_owed_item_events_user_item_effective",
            "user_id",
            "owed_item_id",
            "effective_date",
            "id",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(100), index=True)

    owed_item_id: Mapped[int] = mapped_column(
        ForeignKey("owed_items.id", ondelete="CASCADE"),
        index=True,
    )
    owed_payment_id: Mapped[Optional[int]] = mapped_column(
        nullable=True,
        index=True,
    )

    event_type: Mapped[str] = mapped_column(String(30), index=True)
    effective_date: Mapped[date] = mapped_column(Date, index=True)

    amount_total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    amount_remaining: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(30), index=True)

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
    )
