import hashlib
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser
from app.models.owed_item import OwedItem
from app.models.owed_item_event import OwedItemEvent
from app.models.owed_payment import (
    OwedPayment,
    OwedPaymentAllocation,
)
from app.models.transaction import Transaction
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.financial_command import (
    ExistingTransactionOwedSplitCommand,
    ExistingTransactionOwedSplitRead,
    TransactionCreateWithOwedCommand,
    TransactionDeletionPreviewRead,
    TransactionLinkedOwedDeletionCommand,
    TransactionLinkedOwedDeletionRead,
    TransactionLinkedOwedItemRead,
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

    def preview_transaction_deletion(
        self,
        transaction_id: int,
        *,
        current_user: CurrentUser,
    ) -> TransactionDeletionPreviewRead:
        (
            transaction,
            owed_items,
            linked_owed_payments,
            allocation_relationships,
        ) = self._load_transaction_deletion_context(
            transaction_id,
            current_user=current_user,
        )

        return self._build_transaction_deletion_preview(
            transaction=transaction,
            owed_items=owed_items,
            linked_owed_payments=linked_owed_payments,
            allocation_relationships=allocation_relationships,
            user_id=current_user.id,
        )

    def delete_transaction_with_linked_owed(
        self,
        transaction_id: int,
        command: TransactionLinkedOwedDeletionCommand,
        *,
        current_user: CurrentUser,
    ) -> TransactionLinkedOwedDeletionRead:
        (
            transaction,
            owed_items,
            linked_owed_payments,
            allocation_relationships,
        ) = self._load_transaction_deletion_context(
            transaction_id,
            current_user=current_user,
        )
        preview = self._build_transaction_deletion_preview(
            transaction=transaction,
            owed_items=owed_items,
            linked_owed_payments=linked_owed_payments,
            allocation_relationships=allocation_relationships,
            user_id=current_user.id,
        )

        current_owed_item_ids = [
            owed_item.id
            for owed_item in owed_items
        ]
        expected_owed_item_ids = sorted(
            command.expected_owed_item_ids
        )

        if (
            current_owed_item_ids != expected_owed_item_ids
            or preview.relationship_version
            != command.expected_relationship_version
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Linked owed records changed after the deletion "
                    "preview. Refresh and review them again."
                ),
            )

        if not owed_items:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Transaction no longer has linked owed obligations"
                ),
            )

        deleted_count = 0
        preserved_count = 0
        replacement_person: str | None = None
        mutation_time = datetime.now(UTC)

        try:
            if command.strategy == "delete_with_owed":
                if not preview.delete_with_owed_allowed:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=(
                            preview.delete_with_owed_block_reason
                            or (
                                "Linked owed obligations cannot be "
                                "deleted safely"
                            )
                        ),
                    )

                for owed_item in owed_items:
                    owed_item.linked_transaction_id = None
                    owed_item.dedupe_hash = None

                    self.owed_service.repository.create_event(
                        self._build_owed_item_deletion_event(
                            owed_item=owed_item,
                            event_type="deleted",
                            effective_date=mutation_time.date(),
                            notes=(
                                "Owed item deleted with its linked "
                                "transaction."
                            ),
                        )
                    )
                    owed_item.deleted_at = mutation_time

                    self.owed_service.repository.save_owed_item(
                        owed_item
                    )
                    deleted_count += 1
            else:
                if not preview.preserve_owed_allowed:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=(
                            preview.preserve_owed_block_reason
                            or (
                                "Linked owed obligations cannot be "
                                "preserved safely"
                            )
                        ),
                    )

                replacement_person = (
                    self._get_owned_replacement_person(
                        command.replacement_person,
                        user_id=current_user.id,
                    )
                )

                for owed_item in owed_items:
                    previous_person = owed_item.person
                    owed_item.person = replacement_person
                    owed_item.linked_transaction_id = None
                    owed_item.dedupe_hash = None

                    self.owed_service.repository.save_owed_item(
                        owed_item
                    )
                    self.owed_service.repository.create_event(
                        self._build_owed_item_deletion_event(
                            owed_item=owed_item,
                            event_type="adjusted",
                            effective_date=mutation_time.date(),
                            notes=(
                                "Linked transaction deleted; owed item "
                                f"preserved and assigned from "
                                f"{previous_person} to "
                                f"{replacement_person}."
                            ),
                        )
                    )
                    preserved_count += 1

            self.transaction_repository.delete(
                transaction,
                commit=False,
            )
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

        return TransactionLinkedOwedDeletionRead(
            deleted_transaction_id=transaction_id,
            strategy=command.strategy,
            owed_items_deleted=deleted_count,
            owed_items_preserved=preserved_count,
            replacement_person=replacement_person,
        )

    def _load_transaction_deletion_context(
        self,
        transaction_id: int,
        *,
        current_user: CurrentUser,
    ) -> tuple[
        Transaction,
        list[OwedItem],
        list[OwedPayment],
        list[
            tuple[
                OwedPaymentAllocation,
                OwedPayment | None,
            ]
        ],
    ]:
        transaction = self.transaction_repository.get_by_id(
            transaction_id,
            user_id=current_user.id,
        )

        if transaction is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )

        owed_items = (
            self.transaction_repository
            .list_all_owed_items_for_transaction(
                transaction.id
            )
        )

        for owed_item in owed_items:
            if owed_item.user_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "Linked owed records have inconsistent "
                        "ownership"
                    ),
                )

        linked_owed_payments = (
            self.transaction_repository
            .list_all_owed_payments_for_transaction(
                transaction.id
            )
        )

        for payment in linked_owed_payments:
            if payment.user_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "Linked owed payment records have "
                        "inconsistent ownership"
                    ),
                )

        if owed_items and transaction.direction != "out":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Only money out transactions may own linked "
                    "owed obligations"
                ),
            )

        if (
            linked_owed_payments
            and transaction.direction != "in"
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Only money in transactions may own linked "
                    "owed payment records"
                ),
            )

        allocation_relationships = (
            self.owed_service.repository
            .list_allocation_relationships_for_owed_item_ids(
                [owed_item.id for owed_item in owed_items]
            )
        )

        for allocation, payment in allocation_relationships:
            if (
                allocation.user_id != current_user.id
                or payment is None
                or payment.user_id != current_user.id
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "Linked owed allocations have inconsistent "
                        "ownership"
                    ),
                )

        return (
            transaction,
            owed_items,
            linked_owed_payments,
            allocation_relationships,
        )

    def _build_transaction_deletion_preview(
        self,
        *,
        transaction: Transaction,
        owed_items: list[OwedItem],
        linked_owed_payments: list[OwedPayment],
        allocation_relationships: list[
            tuple[
                OwedPaymentAllocation,
                OwedPayment | None,
            ]
        ],
        user_id: str,
    ) -> TransactionDeletionPreviewRead:
        allocation_count_by_item: dict[int, int] = {}

        for allocation, _payment in allocation_relationships:
            allocation_count_by_item[
                allocation.owed_item_id
            ] = (
                allocation_count_by_item.get(
                    allocation.owed_item_id,
                    0,
                )
                + 1
            )

        linked_item_reads = [
            TransactionLinkedOwedItemRead(
                id=owed_item.id,
                person=owed_item.person,
                amount_total=owed_item.amount_total,
                amount_paid=owed_item.amount_paid,
                amount_remaining=owed_item.amount_remaining,
                status=owed_item.status,
                allocation_count=allocation_count_by_item.get(
                    owed_item.id,
                    0,
                ),
                deleted=owed_item.deleted_at is not None,
            )
            for owed_item in owed_items
        ]

        has_paid_amount = any(
            owed_item.amount_paid > 0
            for owed_item in owed_items
        )
        has_allocations = bool(allocation_relationships)
        has_deleted_items = any(
            owed_item.deleted_at is not None
            for owed_item in owed_items
        )
        has_linked_owed = bool(owed_items)
        has_linked_owed_payments = bool(
            linked_owed_payments
        )

        normal_delete_allowed = not (
            has_linked_owed
            or has_linked_owed_payments
        )
        normal_delete_block_reason: str | None = None

        if has_linked_owed:
            normal_delete_block_reason = (
                "Transaction has linked owed obligations."
            )
        elif has_linked_owed_payments:
            normal_delete_block_reason = (
                "Transaction has linked owed payment records."
            )

        delete_with_owed_allowed = (
            has_linked_owed
            and not has_linked_owed_payments
            and not has_deleted_items
            and not has_paid_amount
            and not has_allocations
        )

        delete_block_reason: str | None = None

        if has_linked_owed_payments:
            delete_block_reason = (
                "Transactions with linked owed payment records "
                "cannot use the owed-obligation deletion command."
            )
        elif has_deleted_items:
            delete_block_reason = (
                "Previously deleted owed records require manual "
                "review before deleting the transaction."
            )
        elif has_paid_amount:
            delete_block_reason = (
                "Paid or partially paid obligations must be "
                "preserved."
            )
        elif has_allocations:
            delete_block_reason = (
                "Obligations with payment allocations must be "
                "preserved."
            )

        preserve_owed_allowed = (
            has_linked_owed
            and not has_linked_owed_payments
            and not has_deleted_items
        )

        preserve_block_reason: str | None = None

        if has_linked_owed_payments:
            preserve_block_reason = (
                "Transactions with linked owed payment records "
                "cannot use the owed-obligation deletion command."
            )
        elif has_deleted_items:
            preserve_block_reason = (
                "Previously deleted owed records cannot be "
                "preserved."
            )

        return TransactionDeletionPreviewRead(
            transaction_id=transaction.id,
            normal_delete_allowed=normal_delete_allowed,
            normal_delete_block_reason=(
                normal_delete_block_reason
            ),
            has_linked_owed=has_linked_owed,
            linked_owed_payment_count=len(
                linked_owed_payments
            ),
            linked_owed_items=linked_item_reads,
            available_replacement_people=(
                self.owed_service.repository.list_known_people(
                    user_id
                )
            ),
            delete_with_owed_allowed=(
                delete_with_owed_allowed
            ),
            delete_with_owed_block_reason=delete_block_reason,
            preserve_owed_allowed=preserve_owed_allowed,
            preserve_owed_block_reason=preserve_block_reason,
            relationship_version=(
                self._build_deletion_relationship_version(
                    transaction=transaction,
                    owed_items=owed_items,
                    linked_owed_payments=(
                        linked_owed_payments
                    ),
                    allocation_relationships=(
                        allocation_relationships
                    ),
                )
            ),
        )

    def _build_deletion_relationship_version(
        self,
        *,
        transaction: Transaction,
        owed_items: list[OwedItem],
        linked_owed_payments: list[OwedPayment],
        allocation_relationships: list[
            tuple[
                OwedPaymentAllocation,
                OwedPayment | None,
            ]
        ],
    ) -> str:
        values = [
            "transaction",
            str(transaction.id),
            transaction.user_id,
            str(transaction.updated_at),
        ]

        for owed_item in owed_items:
            values.extend(
                [
                    "owed_item",
                    str(owed_item.id),
                    owed_item.user_id,
                    owed_item.person,
                    str(owed_item.amount_total),
                    str(owed_item.amount_paid),
                    str(owed_item.amount_remaining),
                    owed_item.status,
                    str(owed_item.linked_transaction_id),
                    str(owed_item.dedupe_hash),
                    str(owed_item.updated_at),
                    str(owed_item.deleted_at),
                ]
            )

        for payment in linked_owed_payments:
            values.extend(
                [
                    "linked_payment",
                    str(payment.id),
                    payment.user_id,
                    payment.person,
                    str(payment.amount),
                    str(payment.linked_transaction_id),
                    str(payment.updated_at),
                ]
            )

        for allocation, payment in allocation_relationships:
            values.extend(
                [
                    "allocation",
                    str(allocation.id),
                    allocation.user_id,
                    str(allocation.owed_item_id),
                    str(allocation.owed_payment_id),
                    str(allocation.amount),
                    "payment",
                    str(payment.id if payment else None),
                    str(payment.user_id if payment else None),
                    str(payment.person if payment else None),
                    str(payment.amount if payment else None),
                    str(payment.updated_at if payment else None),
                ]
            )

        return hashlib.sha256(
            "|".join(values).encode("utf-8")
        ).hexdigest()

    def _get_owned_replacement_person(
        self,
        replacement_person: str | None,
        *,
        user_id: str,
    ) -> str:
        requested_person = (
            replacement_person.strip()
            if replacement_person is not None
            else ""
        )
        known_people = (
            self.owed_service.repository.list_known_people(
                user_id
            )
        )
        known_people_by_key = {
            person.casefold(): person
            for person in known_people
        }
        owned_person = known_people_by_key.get(
            requested_person.casefold()
        )

        if owned_person is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Replacement person is not available for this "
                    "user"
                ),
            )

        return owned_person

    def _build_owed_item_deletion_event(
        self,
        *,
        owed_item: OwedItem,
        event_type: str,
        effective_date,
        notes: str,
    ) -> OwedItemEvent:
        return OwedItemEvent(
            user_id=owed_item.user_id,
            owed_item_id=owed_item.id,
            event_type=event_type,
            effective_date=effective_date,
            amount_total=owed_item.amount_total,
            amount_paid=owed_item.amount_paid,
            amount_remaining=owed_item.amount_remaining,
            status=owed_item.status,
            notes=notes,
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
