from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
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
        transaction = self.repository.create(
            transaction_data,
            user_id=self._get_user_id(current_user),
        )
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
            user_id=self._get_user_id(current_user),
        )

        user_id = self._get_user_id(current_user)
        owed_items_by_transaction_id = self.repository.list_owed_items_by_transaction_ids(
            [transaction.id for transaction in transactions],
            user_id,
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
            user_id=self._get_user_id(current_user),
        )

        user_id = self._get_user_id(current_user)
        owed_items_by_transaction_id = self.repository.list_owed_items_by_transaction_ids(
            [transaction.id for transaction in transactions],
            user_id,
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
        user_id = self._get_user_id(current_user)
        transaction = self._get_transaction_model(transaction_id, user_id)
        owed_items_by_transaction_id = self.repository.list_owed_items_by_transaction_ids(
            [transaction.id],
            user_id,
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
        user_id = self._get_user_id(current_user)
        transaction = self._get_transaction_model(transaction_id, user_id)
        updated_transaction = self.repository.update(transaction, transaction_data)
        owed_items_by_transaction_id = self.repository.list_owed_items_by_transaction_ids(
            [updated_transaction.id],
            user_id,
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
        transaction = self._get_transaction_model(
            transaction_id,
            self._get_user_id(current_user),
        )
        self.repository.delete(transaction)

    def _get_transaction_model(
        self,
        transaction_id: int,
        user_id: str,
    ) -> Transaction:
        transaction = self.repository.get_by_id(transaction_id, user_id)

        if transaction is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )

        return transaction


    def _get_user_id(self, current_user: CurrentUser | None) -> str:
        if current_user is None:
            return LOCAL_DEFAULT_USER_ID

        return current_user.id

    def _build_transaction_read(
        self,
        transaction: Transaction,
        owed_items: list[OwedItem] | None,
    ) -> TransactionRead:
        data = TransactionRead.model_validate(transaction)

        active_owed_items = [
            owed_item
            for owed_item in owed_items or []
            if owed_item.status != "cancelled"
        ]

        if not active_owed_items:
            return data

        owed_amount_total = sum(
            (owed_item.amount_total for owed_item in active_owed_items),
            Decimal("0"),
        )
        owed_amount_paid = sum(
            (owed_item.amount_paid for owed_item in active_owed_items),
            Decimal("0"),
        )
        owed_amount_remaining = sum(
            (owed_item.amount_remaining for owed_item in active_owed_items),
            Decimal("0"),
        )
        owed_people = sorted(
            {
                owed_item.person.strip()
                for owed_item in active_owed_items
                if owed_item.person.strip()
            }
        )

        if owed_amount_remaining == 0:
            owed_status = "paid"
        elif owed_amount_paid > 0:
            owed_status = "partially_paid"
        else:
            owed_status = "open"

        owed_person = owed_people[0] if len(owed_people) == 1 else f"{len(owed_people)} people"

        return data.model_copy(
            update={
                "is_owed": True,
                "owed_item_id": active_owed_items[0].id if len(active_owed_items) == 1 else None,
                "owed_status": owed_status,
                "owed_person": owed_person,
                "owed_amount_total": owed_amount_total,
                "owed_amount_paid": owed_amount_paid,
                "owed_amount_remaining": owed_amount_remaining,
            }
        )
