from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.owed_item import OwedItem
from app.models.transaction import Transaction


class SummaryRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_total_by_direction(
        self,
        direction: str,
        start_date: date,
        end_date: date,
    ) -> Decimal:
        statement = (
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(Transaction.direction == direction)
            .where(Transaction.date >= start_date)
            .where(Transaction.date < end_date)
        )

        return Decimal(str(self.db.scalar(statement)))

    def get_top_expense_categories(
        self,
        start_date: date,
        end_date: date,
        limit: int = 5,
    ) -> list[tuple[str, Decimal]]:
        statement = (
            select(
                func.coalesce(Transaction.category, "Uncategorised"),
                func.coalesce(func.sum(Transaction.amount), 0),
            )
            .where(Transaction.direction == "out")
            .where(Transaction.date >= start_date)
            .where(Transaction.date < end_date)
            .group_by(func.coalesce(Transaction.category, "Uncategorised"))
            .order_by(func.sum(Transaction.amount).desc())
            .limit(limit)
        )

        rows = self.db.execute(statement).all()

        return [(str(category), Decimal(str(total))) for category, total in rows]

    def get_open_owed_amount(self) -> Decimal:
        statement = (
            select(func.coalesce(func.sum(OwedItem.amount_remaining), 0))
            .where(OwedItem.status != "paid")
            .where(OwedItem.status != "cancelled")
        )

        return Decimal(str(self.db.scalar(statement)))
