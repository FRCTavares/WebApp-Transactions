from datetime import date

from fastapi import HTTPException, status

from app.models.transaction import Transaction
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import TransactionCreate, TransactionUpdate


class TransactionService:
    def __init__(self, repository: TransactionRepository) -> None:
        self.repository = repository

    def create_transaction(self, transaction_data: TransactionCreate) -> Transaction:
        return self.repository.create(transaction_data)

    def list_transactions(
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
    ) -> list[Transaction]:
        return self.repository.list(
            direction=direction,
            category=category,
            source=source,
            cashflow_type=cashflow_type,
            date_from=date_from,
            date_to=date_to,
            search=search,
            limit=limit,
            offset=offset,
        )

    def list_uncategorised_transactions(
        self,
        direction: str | None = None,
        source: str | None = None,
        limit: int = 100,
    ) -> list[Transaction]:
        return self.repository.list(
            direction=direction,
            category=None,
            source=source,
            limit=limit,
            offset=0,
            uncategorised_only=True,
        )

    def get_transaction(self, transaction_id: int) -> Transaction:
        transaction = self.repository.get_by_id(transaction_id)

        if transaction is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )

        return transaction

    def update_transaction(
        self,
        transaction_id: int,
        transaction_data: TransactionUpdate,
    ) -> Transaction:
        transaction = self.get_transaction(transaction_id)
        return self.repository.update(transaction, transaction_data)

    def delete_transaction(self, transaction_id: int) -> None:
        transaction = self.get_transaction(transaction_id)
        self.repository.delete(transaction)
