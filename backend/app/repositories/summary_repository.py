from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.owed_item import OwedItem
from app.models.transaction import Transaction


class SummaryRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_total_by_cashflow_type(
        self,
        cashflow_type: str,
        start_date: date,
        end_date: date,
    ) -> Decimal:
        statement = (
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(Transaction.cashflow_type == cashflow_type)
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
        category_label = func.coalesce(Transaction.category, "Uncategorised")
        owed_by_transaction = (
            select(
                OwedItem.linked_transaction_id.label("transaction_id"),
                func.coalesce(func.sum(OwedItem.amount_total), 0).label("owed_total"),
            )
            .where(OwedItem.status != "cancelled")
            .where(OwedItem.linked_transaction_id.is_not(None))
            .group_by(OwedItem.linked_transaction_id)
            .subquery()
        )
        personal_total = func.coalesce(
            func.sum(Transaction.amount - func.coalesce(owed_by_transaction.c.owed_total, 0)),
            0,
        )

        statement = (
            select(
                category_label,
                personal_total,
            )
            .outerjoin(
                owed_by_transaction,
                owed_by_transaction.c.transaction_id == Transaction.id,
            )
            .where(Transaction.cashflow_type == "expense")
            .where(Transaction.date >= start_date)
            .where(Transaction.date < end_date)
            .group_by(category_label)
            .having(personal_total > 0)
            .order_by(personal_total.desc())
            .limit(limit)
        )

        rows = self.db.execute(statement).all()

        return [(str(category), Decimal(str(total))) for category, total in rows]

    def get_owed_expense_amount(
        self,
        start_date: date,
        end_date: date,
    ) -> Decimal:
        statement = (
            select(func.coalesce(func.sum(OwedItem.amount_total), 0))
            .join(Transaction, Transaction.id == OwedItem.linked_transaction_id)
            .where(Transaction.cashflow_type == "expense")
            .where(Transaction.date >= start_date)
            .where(Transaction.date < end_date)
            .where(OwedItem.status != "cancelled")
        )

        return Decimal(str(self.db.scalar(statement)))

    def get_open_owed_amount(self) -> Decimal:
        statement = (
            select(func.coalesce(func.sum(OwedItem.amount_remaining), 0))
            .where(OwedItem.status != "paid")
            .where(OwedItem.status != "cancelled")
        )

        return Decimal(str(self.db.scalar(statement)))
