from __future__ import annotations

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.models.transaction_category import TransactionCategory
from app.schemas.transaction_category import (
    TransactionCategoryCreate,
    TransactionCategoryUpdate,
)


class TransactionCategoryRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        category_data: TransactionCategoryCreate,
        user_id: str,
    ) -> TransactionCategory:
        category = TransactionCategory(
            **category_data.model_dump(),
            user_id=user_id,
        )
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        return category

    def list(
        self,
        user_id: str,
        active_only: bool = False,
        direction: str | None = None,
        cashflow_type: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> list[TransactionCategory]:
        statement = (
            select(TransactionCategory)
            .where(TransactionCategory.user_id == user_id)
            .order_by(
                TransactionCategory.sort_order.asc(),
                TransactionCategory.name.asc(),
                TransactionCategory.id.asc(),
            )
        )

        if active_only:
            statement = statement.where(
                TransactionCategory.is_active.is_(True)
            )

        if direction is not None:
            statement = statement.where(
                TransactionCategory.direction == direction
            )

        if cashflow_type is not None:
            statement = statement.where(
                TransactionCategory.cashflow_type == cashflow_type
            )

        statement = statement.offset(offset).limit(limit)
        return list(self.db.scalars(statement).all())

    def list_all(
        self,
        user_id: str,
    ) -> list[TransactionCategory]:
        statement = (
            select(TransactionCategory)
            .where(TransactionCategory.user_id == user_id)
            .order_by(TransactionCategory.id.asc())
        )
        return list(self.db.scalars(statement).all())

    def get_by_id(
        self,
        category_id: int,
        user_id: str,
    ) -> TransactionCategory | None:
        statement = (
            select(TransactionCategory)
            .where(TransactionCategory.id == category_id)
            .where(TransactionCategory.user_id == user_id)
            .limit(1)
        )
        return self.db.scalar(statement)

    def update(
        self,
        category: TransactionCategory,
        category_data: TransactionCategoryUpdate,
    ) -> TransactionCategory:
        update_data = category_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(category, field, value)

        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        return category

    def list_migration_transactions(
        self,
        category: TransactionCategory,
    ) -> list[Transaction]:
        statement = (
            select(Transaction)
            .where(Transaction.user_id == category.user_id)
            .where(Transaction.category == category.name)
            .where(Transaction.direction == category.direction)
            .where(
                Transaction.cashflow_type == category.cashflow_type
            )
            .order_by(
                Transaction.description.asc(),
                Transaction.date.desc(),
                Transaction.id.desc(),
            )
        )
        return list(self.db.scalars(statement).all())

    def get_usage_count(
        self,
        category: TransactionCategory,
    ) -> int:
        statement = (
            select(func.count(Transaction.id))
            .where(Transaction.user_id == category.user_id)
            .where(Transaction.category == category.name)
            .where(Transaction.direction == category.direction)
            .where(
                Transaction.cashflow_type == category.cashflow_type
            )
        )
        return int(self.db.scalar(statement) or 0)

    def apply_reviewed_migration(
        self,
        category: TransactionCategory,
        transaction_replacements: dict[int, str],
    ) -> int:
        transactions_updated = 0

        try:
            for transaction_id, replacement_name in (
                transaction_replacements.items()
            ):
                result = self.db.execute(
                    update(Transaction)
                    .where(Transaction.id == transaction_id)
                    .where(Transaction.user_id == category.user_id)
                    .where(Transaction.category == category.name)
                    .where(Transaction.direction == category.direction)
                    .where(
                        Transaction.cashflow_type
                        == category.cashflow_type
                    )
                    .values(category=replacement_name)
                )
                transactions_updated += result.rowcount or 0

            self.db.delete(category)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

        return transactions_updated

    def replace_and_delete(
        self,
        category: TransactionCategory,
        replacement: TransactionCategory,
    ) -> int:
        try:
            result = self.db.execute(
                update(Transaction)
                .where(Transaction.user_id == category.user_id)
                .where(Transaction.category == category.name)
                .where(Transaction.direction == category.direction)
                .where(
                    Transaction.cashflow_type
                    == category.cashflow_type
                )
                .values(category=replacement.name)
            )

            self.db.delete(category)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

        return result.rowcount or 0

    def delete(
        self,
        category: TransactionCategory,
    ) -> None:
        self.db.delete(category)
        self.db.commit()
