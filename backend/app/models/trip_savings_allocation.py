from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class TripSavingsAllocation(Base):
    __tablename__ = "trip_savings_allocations"
    __table_args__ = (
        CheckConstraint(
            "length(month) = 7",
            name="ck_trip_savings_allocations_month_length",
        ),
        CheckConstraint(
            "amount_eur >= 0",
            name="ck_trip_savings_allocations_amount_non_negative",
        ),
        CheckConstraint(
            "goal_eur > 0",
            name="ck_trip_savings_allocations_goal_positive",
        ),
        CheckConstraint(
            "source IN ('default', 'override')",
            name="ck_trip_savings_allocations_source_known",
        ),
        UniqueConstraint(
            "user_id",
            "month",
            name="uq_trip_savings_allocations_user_month",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(100), index=True)
    month: Mapped[str] = mapped_column(String(7), index=True)
    amount_eur: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    goal_eur: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    source: Mapped[str] = mapped_column(String(20))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )
