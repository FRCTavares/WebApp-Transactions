from datetime import date

from fastapi import HTTPException, status

from app.auth.current_user import CurrentUser
from app.models.owed_item import OwedItem
from app.models.transaction import Transaction
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import TransactionCreate, TransactionRead, TransactionUpdate


class TransactionService:
    def __init__(self, repository: TransactionRepository) -> None:
        self.repository = repository

    def create_transaction(
        self,
        transaction_data: TransactionCreate,
        current_user: CurrentUser | None = None,
    ) -> TransactionRead:
        transaction = self.repository.create(transaction_data)
        return self._build_transaction_read(transaction, None)

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
        current_user: CurrentUser | None = None,
    ) -> list[TransactionRead]:
        transactions = self.repository.list(
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

        owed_items_by_transaction_id = self.repository.list_owed_items_by_transaction_ids(
            [transaction.id for transaction in transactions]
        )

        return [
            self._build_transaction_read(
                transaction,
                owed_items_by_transaction_id.get(transaction.id),
            )
            for transaction in transactions
        ]

    def list_uncategorised_transactions(
        self,
        direction: str | None = None,
        source: str | None = None,
        limit: int = 100,
        current_user: CurrentUser | None = None,
    ) -> list[TransactionRead]:
        transactions = self.repository.list(
            direction=direction,
            category=None,
            source=source,
            limit=limit,
            offset=0,
            uncategorised_only=True,
        )

        owed_items_by_transaction_id = self.repository.list_owed_items_by_transaction_ids(
            [transaction.id for transaction in transactions]
        )

        return [
            self._build_transaction_read(
                transaction,
                owed_items_by_transaction_id.get(transaction.id),
            )
            for transaction in transactions
        ]

    def get_transaction(
        self,
        transaction_id: int,
        current_user: CurrentUser | None = None,
    ) -> TransactionRead:
        transaction = self._get_transaction_model(transaction_id)
        owed_items_by_transaction_id = self.repository.list_owed_items_by_transaction_ids(
            [transaction.id]
        )

        return self._build_transaction_read(
            transaction,
            owed_items_by_transaction_id.get(transaction.id),
        )

    def update_transaction(
        self,
        transaction_id: int,
        transaction_data: TransactionUpdate,
        current_user: CurrentUser | None = None,
    ) -> TransactionRead:
        transaction = self._get_transaction_model(transaction_id)
        updated_transaction = self.repository.update(transaction, transaction_data)
        owed_items_by_transaction_id = self.repository.list_owed_items_by_transaction_ids(
            [updated_transaction.id]
        )

        return self._build_transaction_read(
            updated_transaction,
            owed_items_by_transaction_id.get(updated_transaction.id),
        )

    def delete_transaction(
        self,
        transaction_id: int,
        current_user: CurrentUser | None = None,
    ) -> None:
        transaction = self._get_transaction_model(transaction_id)
        self.repository.delete(transaction)

    def _get_transaction_model(self, transaction_id: int) -> Transaction:
        transaction = self.repository.get_by_id(transaction_id)

        if transaction is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )

        return transaction

    def _build_transaction_read(
        self,
        transaction: Transaction,
        owed_item: OwedItem | None,
    ) -> TransactionRead:
        data = TransactionRead.model_validate(transaction)

        if owed_item is None:
            return data

        return data.model_copy(
            update={
                "is_owed": True,
                "owed_item_id": owed_item.id,
                "owed_status": owed_item.status,
                "owed_person": owed_item.person,
                "owed_amount_total": owed_item.amount_total,
                "owed_amount_paid": owed_item.amount_paid,
                "owed_amount_remaining": owed_item.amount_remaining,
            }
        )
