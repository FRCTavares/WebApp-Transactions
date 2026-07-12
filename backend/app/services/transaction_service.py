from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status

from app.auth.current_user import CurrentUser
from app.models.owed_item import OwedItem
from app.models.owed_payment import OwedPayment
from app.models.transaction import Transaction
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import TransactionCreate, TransactionRead, TransactionUpdate


class TransactionService:
    def __init__(self, repository: TransactionRepository) -> None:
        self.repository = repository

    def create_transaction(
        self,
        transaction_data: TransactionCreate,
        *,
        current_user: CurrentUser,
    ) -> TransactionRead:
        transaction = self.repository.create(
            transaction_data,
            user_id=current_user.id,
        )
        return self._build_transaction_read(transaction, None, None)

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
        *,
        current_user: CurrentUser,
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
            user_id=current_user.id,
        )

        user_id = current_user.id
        transaction_ids = [transaction.id for transaction in transactions]
        owed_items_by_transaction_id = self.repository.list_owed_items_by_transaction_ids(
            transaction_ids,
            user_id=user_id,
        )
        owed_payments_by_transaction_id = self.repository.list_owed_payments_by_transaction_ids(
            transaction_ids,
            user_id=user_id,
        )

        return [
            self._build_transaction_read(
                transaction,
                owed_items_by_transaction_id.get(transaction.id),
                owed_payments_by_transaction_id.get(transaction.id),
            )
            for transaction in transactions
        ]

    def list_uncategorised_transactions(
        self,
        direction: str | None = None,
        source: str | None = None,
        limit: int = 100,
        *,
        current_user: CurrentUser,
    ) -> list[TransactionRead]:
        transactions = self.repository.list(
            direction=direction,
            category=None,
            source=source,
            limit=limit,
            offset=0,
            uncategorised_only=True,
            user_id=current_user.id,
        )

        user_id = current_user.id
        transaction_ids = [transaction.id for transaction in transactions]
        owed_items_by_transaction_id = self.repository.list_owed_items_by_transaction_ids(
            transaction_ids,
            user_id=user_id,
        )
        owed_payments_by_transaction_id = self.repository.list_owed_payments_by_transaction_ids(
            transaction_ids,
            user_id=user_id,
        )

        return [
            self._build_transaction_read(
                transaction,
                owed_items_by_transaction_id.get(transaction.id),
                owed_payments_by_transaction_id.get(transaction.id),
            )
            for transaction in transactions
        ]

    def get_transaction(
        self,
        transaction_id: int,
        *,
        current_user: CurrentUser,
    ) -> TransactionRead:
        user_id = current_user.id
        transaction = self._get_transaction_model(transaction_id, user_id)
        owed_items_by_transaction_id = self.repository.list_owed_items_by_transaction_ids(
            [transaction.id],
            user_id=user_id,
        )
        owed_payments_by_transaction_id = self.repository.list_owed_payments_by_transaction_ids(
            [transaction.id],
            user_id=user_id,
        )

        return self._build_transaction_read(
            transaction,
            owed_items_by_transaction_id.get(transaction.id),
            owed_payments_by_transaction_id.get(transaction.id),
        )

    def update_transaction(
        self,
        transaction_id: int,
        transaction_data: TransactionUpdate,
        *,
        current_user: CurrentUser,
    ) -> TransactionRead:
        user_id = current_user.id
        transaction = self._get_transaction_model(transaction_id, user_id)
        updated_transaction = self.repository.update(transaction, transaction_data)
        owed_items_by_transaction_id = self.repository.list_owed_items_by_transaction_ids(
            [updated_transaction.id],
            user_id=user_id,
        )
        owed_payments_by_transaction_id = self.repository.list_owed_payments_by_transaction_ids(
            [updated_transaction.id],
            user_id=user_id,
        )

        return self._build_transaction_read(
            updated_transaction,
            owed_items_by_transaction_id.get(updated_transaction.id),
            owed_payments_by_transaction_id.get(updated_transaction.id),
        )

    def delete_transaction(
        self,
        transaction_id: int,
        *,
        current_user: CurrentUser,
    ) -> None:
        transaction = self._get_transaction_model(
            transaction_id,
            current_user.id,
        )
        self.repository.delete(transaction)

    def _get_transaction_model(
        self,
        transaction_id: int,
        user_id: str,
    ) -> Transaction:
        transaction = self.repository.get_by_id(
            transaction_id,
            user_id=user_id,
        )

        if transaction is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )

        return transaction

    def _get_transaction_read_payload(self, transaction: Transaction) -> dict:
        return {
            "id": transaction.id,
            "date": transaction.date,
            "description": transaction.description,
            "raw_description": transaction.raw_description,
            "amount": transaction.amount,
            "original_amount": transaction.original_amount,
            "original_currency": transaction.original_currency,
            "fx_rate_to_eur": transaction.fx_rate_to_eur,
            "fx_rate_source": transaction.fx_rate_source,
            "direction": transaction.direction,
            "cashflow_type": self._normalise_cashflow_type_for_read(
                transaction.cashflow_type,
                transaction.direction,
            ),
            "source": transaction.source,
            "account": transaction.account,
            "category": transaction.category,
            "currency": transaction.currency,
            "merchant": transaction.merchant,
            "notes": transaction.notes,
            "import_batch_id": transaction.import_batch_id,
            "external_id": transaction.external_id,
            "dedupe_hash": transaction.dedupe_hash,
            "created_at": transaction.created_at,
            "updated_at": transaction.updated_at,
        }

    def _normalise_cashflow_type_for_read(
        self,
        cashflow_type: str | None,
        direction: str,
    ) -> str:
        if cashflow_type in {"income", "expense", "transfer"}:
            return cashflow_type

        legacy_mapping = {
            "internal_transfer": "transfer",
            "investment": "transfer",
            "reimbursement": "income",
            "reimbursed_expense": "expense",
        }

        if cashflow_type in legacy_mapping:
            return legacy_mapping[cashflow_type]

        if direction == "in":
            return "income"

        return "expense"

    def _build_transaction_read(
        self,
        transaction: Transaction,
        owed_items: list[OwedItem] | None,
        owed_payments: list[tuple[OwedPayment, Decimal]] | None = None,
    ) -> TransactionRead:
        data = TransactionRead.model_validate(
            self._get_transaction_read_payload(transaction),
        )

        data = self._apply_owed_item_metadata(data, owed_items)
        return self._apply_owed_payment_metadata(data, owed_payments)

    def _apply_owed_item_metadata(
        self,
        data: TransactionRead,
        owed_items: list[OwedItem] | None,
    ) -> TransactionRead:
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

    def _apply_owed_payment_metadata(
        self,
        data: TransactionRead,
        owed_payments: list[tuple[OwedPayment, Decimal]] | None,
    ) -> TransactionRead:
        if not owed_payments:
            return data

        allocated_amount = sum(
            (allocated for _payment, allocated in owed_payments),
            Decimal("0"),
        )
        payment_amount = sum(
            (payment.amount for payment, _allocated in owed_payments),
            Decimal("0"),
        )
        unallocated_amount = payment_amount - allocated_amount
        payment_people = sorted(
            {
                payment.person.strip()
                for payment, _allocated in owed_payments
                if payment.person.strip()
            }
        )
        payment_person = payment_people[0] if len(payment_people) == 1 else f"{len(payment_people)} people"
        unallocated_categories = sorted(
            {
                payment.unallocated_category.strip()
                for payment, _allocated in owed_payments
                if payment.unallocated_category and payment.unallocated_category.strip()
            }
        )

        return data.model_copy(
            update={
                "is_owed_payment": True,
                "owed_payment_id": owed_payments[0][0].id if len(owed_payments) == 1 else None,
                "owed_payment_person": payment_person,
                "owed_payment_allocated_amount": allocated_amount,
                "owed_payment_unallocated_amount": unallocated_amount,
                "owed_payment_unallocated_category": (
                    unallocated_categories[0] if len(unallocated_categories) == 1 else None
                ),
            }
        )
