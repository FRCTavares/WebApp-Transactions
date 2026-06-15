from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import delete as sqlalchemy_delete, extract, func, or_, select
from sqlalchemy.orm import Session

from app.models.owed_item import OwedItem
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionUpdate


class TransactionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, transaction_data: TransactionCreate) -> Transaction:
        transaction = Transaction(**transaction_data.model_dump())
        self.db.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)
        return transaction

    def list(
        self,
        direction: str | None = None,
        category: str | None = None,
        source: str | None = None,
        cashflow_type: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        search: str | None = None,
        limit: int = 100,
        offset: int = 0,
        uncategorised_only: bool = False,
    ) -> list[Transaction]:
        statement = select(Transaction).order_by(Transaction.date.desc(), Transaction.id.desc())

        if direction is not None:
            statement = statement.where(Transaction.direction == direction)

        if uncategorised_only:
            statement = statement.where(Transaction.category.is_(None))
        elif category is not None:
            statement = statement.where(Transaction.category == category)

        if source is not None:
            statement = statement.where(Transaction.source == source)

        if cashflow_type is not None:
            statement = statement.where(Transaction.cashflow_type == cashflow_type)

        if date_from is not None:
            statement = statement.where(Transaction.date >= date_from)

        if date_to is not None:
            statement = statement.where(Transaction.date <= date_to)

        if search is not None:
            search_pattern = f"%{search.strip()}%"
            statement = statement.where(
                or_(
                    Transaction.description.ilike(search_pattern),
                    Transaction.raw_description.ilike(search_pattern),
                )
            )

        statement = statement.offset(offset).limit(limit)

        return list(self.db.scalars(statement).all())

    def list_by_import_batch(
        self,
        import_batch_id: int,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Transaction]:
        statement = (
            select(Transaction)
            .where(Transaction.import_batch_id == import_batch_id)
            .order_by(Transaction.date.desc(), Transaction.id.desc())
            .offset(offset)
            .limit(limit)
        )

        return list(self.db.scalars(statement).all())

    def list_uncategorised(
        self,
        limit: int = 1000,
    ) -> list[Transaction]:
        statement = (
            select(Transaction)
            .where(Transaction.category.is_(None))
            .order_by(Transaction.date.desc(), Transaction.id.desc())
            .limit(limit)
        )

        return list(self.db.scalars(statement).all())

    def list_for_description_rule_application(
        self,
        limit: int = 1000,
    ) -> list[Transaction]:
        statement = (
            select(Transaction)
            .order_by(Transaction.date.desc(), Transaction.id.desc())
            .limit(limit)
        )

        return list(self.db.scalars(statement).all())

    def get_by_id(self, transaction_id: int) -> Transaction | None:
        return self.db.get(Transaction, transaction_id)

    def list_owed_items_by_transaction_ids(
        self,
        transaction_ids: list[int],
    ) -> dict[int, OwedItem]:
        if not transaction_ids:
            return {}

        statement = select(OwedItem).where(
            OwedItem.linked_transaction_id.in_(transaction_ids)
        )

        owed_items = list(self.db.scalars(statement).all())

        return {
            owed_item.linked_transaction_id: owed_item
            for owed_item in owed_items
            if owed_item.linked_transaction_id is not None
        }

    def update(
        self,
        transaction: Transaction,
        transaction_data: TransactionUpdate,
    ) -> Transaction:
        update_data = transaction_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(transaction, field, value)

        self.db.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)
        return transaction

    def update_category(
        self,
        transaction: Transaction,
        category: str,
        subcategory: str | None,
    ) -> Transaction:
        transaction.category = category
        transaction.subcategory = subcategory

        self.db.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)
        return transaction

    def update_description(
        self,
        transaction: Transaction,
        description: str,
    ) -> Transaction:
        transaction.description = description

        self.db.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)
        return transaction

    def update_cashflow_type(
        self,
        transaction: Transaction,
        cashflow_type: str,
    ) -> Transaction:
        transaction.cashflow_type = cashflow_type

        self.db.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)
        return transaction

    def delete(self, transaction: Transaction) -> None:
        self.db.delete(transaction)
        self.db.commit()

    def delete_by_import_batch(self, import_batch_id: int) -> int:
        statement = sqlalchemy_delete(Transaction).where(
            Transaction.import_batch_id == import_batch_id
        )
        result = self.db.execute(statement)
        self.db.commit()

        return result.rowcount or 0

    def exists_by_dedupe_hash(self, dedupe_hash: str) -> bool:
        statement = select(Transaction.id).where(Transaction.dedupe_hash == dedupe_hash)
        return self.db.scalar(statement) is not None

    def bulk_insert(self, transactions: list[Transaction]) -> list[Transaction]:
        self.db.add_all(transactions)
        self.db.commit()

        for transaction in transactions:
            self.db.refresh(transaction)

        return transactions

    def list_fx_match_candidates(
        self,
        target_date: date,
        source: str = "activobank",
        days_window: int = 3,
        limit: int = 20,
    ) -> list[Transaction]:
        date_from = target_date - timedelta(days=days_window)
        date_to = target_date + timedelta(days=days_window)

        statement = (
            select(Transaction)
            .where(Transaction.source == source)
            .where(Transaction.direction == "out")
            .where(Transaction.currency == "EUR")
            .where(Transaction.date >= date_from)
            .where(Transaction.date <= date_to)
            .order_by(Transaction.date.desc(), Transaction.id.desc())
            .limit(limit)
        )

        return list(self.db.scalars(statement).all())

    def get_category_summary(
        self,
        year: int | None = None,
        month: int | None = None,
        direction: str | None = None,
        cashflow_type: str | None = None,
    ) -> list[tuple[str, str | None, Decimal, Decimal, Decimal, int]]:
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
        gross_total = func.coalesce(func.sum(Transaction.amount), 0)
        owed_total = func.coalesce(func.sum(func.coalesce(owed_by_transaction.c.owed_total, 0)), 0)
        personal_total = func.coalesce(
            func.sum(Transaction.amount - func.coalesce(owed_by_transaction.c.owed_total, 0)),
            0,
        )

        statement = (
            select(
                category_label.label("category"),
                gross_total.label("gross_total"),
                owed_total.label("owed_total"),
                personal_total.label("personal_total"),
                func.count(Transaction.id).label("count"),
            )
            .outerjoin(
                owed_by_transaction,
                owed_by_transaction.c.transaction_id == Transaction.id,
            )
            .group_by(category_label)
            .order_by(personal_total.desc(), gross_total.desc())
        )

        if year is not None:
            statement = statement.where(extract("year", Transaction.date) == year)

        if month is not None:
            statement = statement.where(extract("month", Transaction.date) == month)

        if direction is not None:
            statement = statement.where(Transaction.direction == direction)

        if cashflow_type is not None:
            statement = statement.where(Transaction.cashflow_type == cashflow_type)

        return [
            (
                str(category),
                None,
                Decimal(str(gross)),
                Decimal(str(owed)),
                Decimal(str(personal)),
                count,
            )
            for category, gross, owed, personal, count in self.db.execute(statement).all()
        ]

    def get_uncategorised_suggestions(
        self,
        direction: str | None = None,
        limit: int = 20,
    ) -> list[tuple[str, str, str, int, Decimal]]:
        total_amount = func.sum(Transaction.amount)
        transaction_count = func.count(Transaction.id)

        statement = (
            select(
                Transaction.description,
                Transaction.source,
                Transaction.direction,
                transaction_count.label("count"),
                total_amount.label("total"),
            )
            .where(Transaction.category.is_(None))
            .group_by(
                Transaction.description,
                Transaction.source,
                Transaction.direction,
            )
            .order_by(total_amount.desc())
            .limit(limit)
        )

        if direction is not None:
            statement = statement.where(Transaction.direction == direction)

        return list(self.db.execute(statement).all())

    def get_description_rule_suggestions(
        self,
        direction: str | None = None,
        limit: int = 50,
    ) -> list[tuple[str, str, str, str, int, Decimal]]:
        total_amount = func.sum(Transaction.amount)
        transaction_count = func.count(Transaction.id)

        statement = (
            select(
                Transaction.raw_description,
                Transaction.description,
                Transaction.source,
                Transaction.direction,
                transaction_count.label("count"),
                total_amount.label("total"),
            )
            .group_by(
                Transaction.raw_description,
                Transaction.description,
                Transaction.source,
                Transaction.direction,
            )
            .order_by(transaction_count.desc(), total_amount.desc())
            .limit(limit)
        )

        if direction is not None:
            statement = statement.where(Transaction.direction == direction)

        return list(self.db.execute(statement).all())
