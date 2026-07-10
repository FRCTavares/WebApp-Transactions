from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class TransactionCategory(Base):
    __tablename__ = "transaction_categories"
    __table_args__ = (
        CheckConstraint(
            "direction IN ('in', 'out')",
            name="ck_transaction_categories_direction_known",
        ),
        CheckConstraint(
            "cashflow_type IN ('income', 'expense', 'transfer')",
            name="ck_transaction_categories_cashflow_type_known",
        ),
        CheckConstraint(
            "sort_order >= 0",
            name="ck_transaction_categories_sort_order_non_negative",
        ),
        UniqueConstraint(
            "user_id",
            "name",
            "direction",
            "cashflow_type",
            name="uq_transaction_categories_user_name_direction_type",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(
        String(100),
        default=LOCAL_DEFAULT_USER_ID,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), index=True)
    direction: Mapped[str] = mapped_column(String(10), index=True)
    cashflow_type: Mapped[str] = mapped_column(String(30), index=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        index=True,
    )
    sort_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )
