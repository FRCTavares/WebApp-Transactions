from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.financial_command import (
    ExistingTransactionOwedSplitCommand,
    ExistingTransactionOwedSplitRead,
    TransactionCreateWithOwedCommand,
)
from app.schemas.owed_item import (
    OwedItemCreate,
    OwedPaymentAllocationCreate,
    OwedPaymentCreate,
)
from app.schemas.transaction import TransactionRead
from app.services.owed_service import OwedService
from app.services.transaction_service import TransactionService


class FinancialCommandService:
    def __init__(
        self,
        db: Session,
        transaction_repository: TransactionRepository,
        owed_service: OwedService,
    ) -> None:
        self.db = db
        self.transaction_repository = transaction_repository
        self.owed_service = owed_service
        self.transaction_service = TransactionService(transaction_repository)

    def create_transaction_with_owed(
        self,
        command: TransactionCreateWithOwedCommand,
        *,
        current_user: CurrentUser,
    ) -> TransactionRead:
        self._validate_owed_total(command)

        try:
            transaction = self.transaction_repository.create(
                command.transaction,
                user_id=current_user.id,
                commit=False,
            )

            for owed_item_data in command.owed_items:
                linked_owed_item_data = owed_item_data.model_copy(
                    update={"linked_transaction_id": transaction.id}
                )
                self.owed_service.create_owed_item(
                    linked_owed_item_data,
                    current_user=current_user,
                    commit=False,
                )

            if command.owed_payment is not None:
                linked_payment_data = command.owed_payment.model_copy(
                    update={"linked_transaction_id": transaction.id}
                )
                self.owed_service.record_payment(
                    linked_payment_data,
                    current_user=current_user,
                    commit=False,
                )

            self.db.commit()
            self.db.refresh(transaction)
        except Exception:
            self.db.rollback()
            raise

        return self.transaction_service.get_transaction(
            transaction.id,
            current_user=current_user,
        )

    def create_owed_split_for_transaction(
        self,
        transaction_id: int,
        command: ExistingTransactionOwedSplitCommand,
        *,
        current_user: CurrentUser,
    ) -> ExistingTransactionOwedSplitRead:
        transaction = self.transaction_repository.get_by_id(
            transaction_id,
            user_id=current_user.id,
        )

        if transaction is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )

        if transaction.direction != "out":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Owed splits can only be added to money out transactions",
            )

        total_requested = sum(
            (row.amount for row in command.rows),
            start=Decimal("0"),
        )
        existing_owed_total = (
            self.owed_service.repository.get_linked_transaction_owed_total(
                linked_transaction_id=transaction.id,
                user_id=current_user.id,
            )
        )

        if existing_owed_total + total_requested > transaction.amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Total owed amount cannot exceed remaining transaction amount"
                ),
            )

        rows_by_person = {}
        for row in command.rows:
            person = row.person.strip()
            rows_by_person.setdefault(person, []).append(row)

        owed_items_created = 0
        payments_created = 0

        try:
            for person, person_rows in rows_by_person.items():
                person_amount = sum(
                    (row.amount for row in person_rows),
                    start=Decimal("0"),
                )
                owed_item = self.owed_service.create_owed_item(
                    OwedItemCreate(
                        person=person,
                        amount_total=person_amount,
                        reason=transaction.description,
                        linked_transaction_id=transaction.id,
                    ),
                    current_user=current_user,
                    commit=False,
                )
                owed_items_created += 1
                remaining_person_amount = person_amount

                for row in person_rows:
                    if row.payment is None or remaining_person_amount <= 0:
                        continue

                    allocation_amount = min(
                        row.payment.amount,
                        row.amount,
                        remaining_person_amount,
                    )
                    allocations = []

                    if allocation_amount > 0:
                        allocations.append(
                            OwedPaymentAllocationCreate(
                                owed_item_id=owed_item.id,
                                amount=allocation_amount,
                            )
                        )

                    allocations.extend(row.payment.extra_allocations)
                    extra_allocation_total = sum(
                        (
                            allocation.amount
                            for allocation in row.payment.extra_allocations
                        ),
                        start=Decimal("0"),
                    )
                    leftover_amount = (
                        row.payment.amount
                        - allocation_amount
                        - extra_allocation_total
                    )

                    if leftover_amount < 0:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=(
                                "Payment allocations cannot exceed payment amount"
                            ),
                        )

                    self.owed_service.record_payment(
                        OwedPaymentCreate(
                            person=person,
                            payment_date=row.payment.payment_date,
                            amount=row.payment.amount,
                            currency=row.payment.currency,
                            method=row.payment.method,
                            notes=row.payment.notes,
                            linked_transaction_id=(
                                row.payment.linked_transaction_id
                            ),
                            unallocated_category=(
                                row.payment.unallocated_category
                                if leftover_amount > 0
                                else None
                            ),
                            unallocated_notes=(
                                row.payment.unallocated_notes
                                if leftover_amount > 0
                                else None
                            ),
                            allocations=allocations,
                        ),
                        current_user=current_user,
                        commit=False,
                    )
                    remaining_person_amount -= allocation_amount
                    payments_created += 1

            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

        return ExistingTransactionOwedSplitRead(
            transaction=self.transaction_service.get_transaction(
                transaction.id,
                current_user=current_user,
            ),
            owed_items_created=owed_items_created,
            payments_created=payments_created,
        )

    def _validate_owed_total(
        self,
        command: TransactionCreateWithOwedCommand,
    ) -> None:
        owed_total = sum(
            (item.amount_total for item in command.owed_items),
            start=command.transaction.amount * 0,
        )

        if owed_total > command.transaction.amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Total owed amount cannot exceed transaction amount",
            )
