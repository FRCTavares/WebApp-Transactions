from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    user_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    locale: Mapped[str] = mapped_column(String(10), default="en-GB")
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    time_zone: Mapped[str] = mapped_column(String(64), default="Europe/Lisbon")
    date_format: Mapped[str] = mapped_column(String(20), default="medium")
    language: Mapped[str] = mapped_column(String(5), default="en")
    monthly_investment_goal_eur: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("100.00"),
        server_default="100.00",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
