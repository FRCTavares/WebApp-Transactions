from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class InvestmentFundingMonth(Base):
    __tablename__ = "investment_funding_months"
    __table_args__ = (
        CheckConstraint(
            "length(month) = 7",
            name="ck_investment_funding_months_month_length",
        ),
        CheckConstraint(
            "manual_amount >= 0",
            name="ck_investment_funding_months_manual_non_negative",
        ),
        CheckConstraint(
            "cashback_rounding_amount >= 0",
            name="ck_investment_funding_months_cashback_rounding_non_negative",
        ),
        CheckConstraint(
            "length(currency) = 3",
            name="ck_investment_funding_months_currency_length",
        ),
        UniqueConstraint(
            "user_id",
            "month",
            "source",
            name="uq_investment_funding_months_user_month_source",
        ),
        Index("ix_investment_funding_months_user_month", "user_id", "month"),
        Index("ix_investment_funding_months_user_source", "user_id", "source"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(
        String(100),
        default=LOCAL_DEFAULT_USER_ID,
        index=True,
    )

    month: Mapped[str] = mapped_column(String(7), index=True)
    source: Mapped[str] = mapped_column(String(50), index=True)
    manual_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    cashback_rounding_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )
