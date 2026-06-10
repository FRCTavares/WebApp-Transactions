from datetime import date
from decimal import Decimal

from sqlalchemy import extract, func, or_, select
from sqlalchemy.orm import Session

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

    def delete(self, transaction: Transaction) -> None:
        self.db.delete(transaction)
        self.db.commit()

    def exists_by_dedupe_hash(self, dedupe_hash: str) -> bool:
        statement = select(Transaction.id).where(Transaction.dedupe_hash == dedupe_hash)
        return self.db.scalar(statement) is not None

    def bulk_insert(self, transactions: list[Transaction]) -> list[Transaction]:
        self.db.add_all(transactions)
        self.db.commit()

        for transaction in transactions:
            self.db.refresh(transaction)

        return transactions

    def get_category_summary(
        self,
        year: int | None = None,
        month: int | None = None,
        direction: str | None = None,
    ) -> list[tuple[str, str | None, Decimal, int]]:
        category_label = func.coalesce(Transaction.category, "Uncategorised")

        statement = (
            select(
                category_label.label("category"),
                Transaction.subcategory,
                func.sum(Transaction.amount).label("total"),
                func.count(Transaction.id).label("count"),
            )
            .group_by(category_label, Transaction.subcategory)
            .order_by(func.sum(Transaction.amount).desc())
        )

        if year is not None:
            statement = statement.where(extract("year", Transaction.date) == year)

        if month is not None:
            statement = statement.where(extract("month", Transaction.date) == month)

        if direction is not None:
            statement = statement.where(Transaction.direction == direction)

        return list(self.db.execute(statement).all())

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
