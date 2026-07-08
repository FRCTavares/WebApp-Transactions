import hashlib
from decimal import Decimal

from fastapi import HTTPException, status

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.models.owed_item import OwedItem
from app.models.owed_payment import OwedPayment, OwedPaymentAllocation
from app.repositories.owed_repository import OwedRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.owed_item import (
    OwedItemCreate,
    OwedItemUpdate,
    OwedPaymentCreate,
    OwedPaymentRead,
)


class OwedService:
    def __init__(
        self,
        repository: OwedRepository,
        transaction_repository: TransactionRepository | None = None,
    ) -> None:
        self.repository = repository
        self.transaction_repository = transaction_repository

    def create_owed_item(
        self,
        owed_data: OwedItemCreate,
        current_user: CurrentUser | None = None,
    ) -> OwedItem:
        user_id = self._get_user_id(current_user)
        owed_data = self._with_dedupe_hash(owed_data, user_id)

        if owed_data.dedupe_hash and self.repository.exists_by_dedupe_hash(
            owed_data.dedupe_hash,
            user_id,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Owed item already exists for this transaction and person",
            )

        amount_remaining = self._calculate_amount_remaining(
            amount_total=owed_data.amount_total,
            amount_paid=owed_data.amount_paid,
        )

        owed_data = owed_data.model_copy(
            update={
                "status": self._calculate_status(
                    amount_paid=owed_data.amount_paid,
                    amount_remaining=amount_remaining,
                )
            }
        )

        self._validate_linked_transaction_capacity(
            linked_transaction_id=owed_data.linked_transaction_id,
            amount_total=owed_data.amount_total,
            status_value=owed_data.status,
            user_id=user_id,
        )

        return self.repository.create(owed_data, amount_remaining, user_id)

    def list_owed_items(
        self,
        status: str | None = None,
        person: str | None = None,
        limit: int = 100,
        offset: int = 0,
        current_user: CurrentUser | None = None,
    ) -> list[OwedItem]:
        user_id = self._get_user_id(current_user)

        return self.repository.list(
            user_id=user_id,
            status=status,
            person=person,
            limit=limit,
            offset=offset,
        )

    def get_owed_item(
        self,
        owed_item_id: int,
        current_user: CurrentUser | None = None,
    ) -> OwedItem:
        user_id = self._get_user_id(current_user)
        owed_item = self.repository.get_by_id(owed_item_id, user_id)

        if owed_item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Owed item not found",
            )

        return owed_item

    def update_owed_item(
        self,
        owed_item_id: int,
        owed_data: OwedItemUpdate,
        current_user: CurrentUser | None = None,
    ) -> OwedItem:
        owed_item = self.get_owed_item(owed_item_id, current_user)

        amount_total = owed_data.amount_total
        if amount_total is None:
            amount_total = owed_item.amount_total

        amount_paid = owed_data.amount_paid
        if amount_paid is None:
            amount_paid = owed_item.amount_paid

        amount_remaining = self._calculate_amount_remaining(
            amount_total=amount_total,
            amount_paid=amount_paid,
        )

        status_value = owed_data.status
        if status_value is None:
            status_value = self._calculate_status(
                amount_paid=amount_paid,
                amount_remaining=amount_remaining,
            )
            owed_data = owed_data.model_copy(update={"status": status_value})

        linked_transaction_id = owed_data.linked_transaction_id
        if linked_transaction_id is None:
            linked_transaction_id = owed_item.linked_transaction_id

        self._validate_linked_transaction_capacity(
            linked_transaction_id=linked_transaction_id,
            amount_total=amount_total,
            status_value=status_value,
            user_id=owed_item.user_id,
            exclude_owed_item_id=owed_item.id,
        )

        return self.repository.update(owed_item, owed_data, amount_remaining)

    def delete_owed_item(
        self,
        owed_item_id: int,
        current_user: CurrentUser | None = None,
    ) -> None:
        owed_item = self.get_owed_item(owed_item_id, current_user)
        self.repository.delete(owed_item)

    def record_payment(
        self,
        payment_data: OwedPaymentCreate,
        current_user: CurrentUser | None = None,
    ) -> OwedPaymentRead:
        payment = OwedPayment(
            person=payment_data.person,
            payment_date=payment_data.payment_date,
            amount=payment_data.amount,
            currency=payment_data.currency,
            method=payment_data.method,
            notes=payment_data.notes,
            linked_transaction_id=payment_data.linked_transaction_id,
            unallocated_category=payment_data.unallocated_category,
            unallocated_notes=payment_data.unallocated_notes,
        )

        user_id = self._get_user_id(current_user)
        self._validate_linked_payment_transaction(
            linked_transaction_id=payment_data.linked_transaction_id,
            amount=payment_data.amount,
            user_id=user_id,
        )

        requested_allocations = self._validate_requested_allocations(
            payment_data=payment_data,
            current_user=current_user,
        )

        payment = self.repository.create_payment(payment, user_id)

        remaining_to_allocate = payment_data.amount

        if requested_allocations:
            for owed_item, amount in requested_allocations:
                remaining_to_allocate = self._allocate_to_owed_item(
                    payment_id=payment.id,
                    owed_item=owed_item,
                    amount=amount,
                    remaining_to_allocate=remaining_to_allocate,
                )
        else:
            for owed_item in self.repository.list_open_by_person(
                payment_data.person,
                user_id,
            ):
                if remaining_to_allocate <= 0:
                    break

                amount = min(remaining_to_allocate, owed_item.amount_remaining)
                remaining_to_allocate = self._allocate_to_owed_item(
                    payment_id=payment.id,
                    owed_item=owed_item,
                    amount=amount,
                    remaining_to_allocate=remaining_to_allocate,
                )

        self.repository.commit()
        self.repository.refresh(payment)

        return self._build_payment_read(payment, user_id)

    def list_payments(
        self,
        person: str | None = None,
        limit: int = 100,
        offset: int = 0,
        current_user: CurrentUser | None = None,
    ) -> list[OwedPaymentRead]:
        return [
            self._build_payment_read(
                payment,
                self._get_user_id(current_user),
            )
            for payment in self.repository.list_payments(
                user_id=self._get_user_id(current_user),
                person=person,
                limit=limit,
                offset=offset,
            )
        ]

    def get_payment(
        self,
        payment_id: int,
        current_user: CurrentUser | None = None,
    ) -> OwedPaymentRead:
        user_id = self._get_user_id(current_user)
        payment = self.repository.get_payment_by_id(payment_id, user_id)

        if payment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Owed payment not found",
            )

        return self._build_payment_read(payment, user_id)

    def delete_payment(
        self,
        payment_id: int,
        current_user: CurrentUser | None = None,
    ) -> None:
        user_id = self._get_user_id(current_user)
        payment = self.repository.get_payment_by_id(payment_id, user_id)

        if payment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Owed payment not found",
            )

        allocations = self.repository.list_allocations_for_payment(payment.id, user_id)

        for allocation in allocations:
            owed_item = self.repository.get_by_id(allocation.owed_item_id, user_id)

            if owed_item is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot delete payment with missing owed item allocation",
                )

            owed_item.amount_paid -= allocation.amount
            owed_item.amount_remaining = self._calculate_amount_remaining(
                amount_total=owed_item.amount_total,
                amount_paid=owed_item.amount_paid,
            )
            owed_item.status = self._calculate_status(
                amount_paid=owed_item.amount_paid,
                amount_remaining=owed_item.amount_remaining,
            )

            self.repository.save_owed_item(owed_item)
            self.repository.delete_allocation(allocation)

        self.repository.delete_payment(payment)
        self.repository.commit()

    def _validate_requested_allocations(
        self,
        payment_data: OwedPaymentCreate,
        current_user: CurrentUser | None,
    ) -> list[tuple[OwedItem, Decimal]]:
        if not payment_data.allocations:
            return []

        total_allocated = Decimal("0")
        allocated_by_owed_item: dict[int, Decimal] = {}
        validated_allocations: list[tuple[OwedItem, Decimal]] = []

        for allocation_data in payment_data.allocations:
            owed_item = self.get_owed_item(
                allocation_data.owed_item_id,
                current_user,
            )

            if owed_item.person != payment_data.person:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Allocation person must match payment person",
                )

            total_allocated += allocation_data.amount
            if total_allocated > payment_data.amount:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Allocated amount cannot exceed payment amount",
                )

            item_allocated = (
                allocated_by_owed_item.get(owed_item.id, Decimal("0"))
                + allocation_data.amount
            )
            if item_allocated > owed_item.amount_remaining:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Allocated amount cannot exceed owed item remaining amount",
                )

            allocated_by_owed_item[owed_item.id] = item_allocated
            validated_allocations.append((owed_item, allocation_data.amount))

        return validated_allocations

    def _allocate_to_owed_item(
        self,
        payment_id: int,
        owed_item: OwedItem,
        amount: Decimal,
        remaining_to_allocate: Decimal,
    ) -> Decimal:
        if amount > remaining_to_allocate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Allocated amount cannot exceed payment amount",
            )

        if amount > owed_item.amount_remaining:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Allocated amount cannot exceed owed item remaining amount",
            )

        allocation = OwedPaymentAllocation(
            owed_payment_id=payment_id,
            owed_item_id=owed_item.id,
            amount=amount,
        )
        self.repository.create_allocation(allocation, owed_item.user_id)

        owed_item.amount_paid += amount
        owed_item.amount_remaining = self._calculate_amount_remaining(
            amount_total=owed_item.amount_total,
            amount_paid=owed_item.amount_paid,
        )
        owed_item.status = self._calculate_status(
            amount_paid=owed_item.amount_paid,
            amount_remaining=owed_item.amount_remaining,
        )
        self.repository.save_owed_item(owed_item)

        return remaining_to_allocate - amount

    def _build_payment_read(
        self,
        payment: OwedPayment,
        user_id: str,
    ) -> OwedPaymentRead:
        allocations = self.repository.list_allocations_for_payment(payment.id, user_id)
        allocated_amount = self.repository.get_allocated_total_for_payment(
            payment.id,
            user_id,
        )

        return OwedPaymentRead(
            id=payment.id,
            person=payment.person,
            payment_date=payment.payment_date,
            amount=payment.amount,
            currency=payment.currency,
            method=payment.method,
            notes=payment.notes,
            linked_transaction_id=payment.linked_transaction_id,
            unallocated_category=payment.unallocated_category,
            unallocated_notes=payment.unallocated_notes,
            allocated_amount=allocated_amount,
            unallocated_amount=payment.amount - allocated_amount,
            allocations=allocations,
            created_at=payment.created_at,
            updated_at=payment.updated_at,
        )

    def _validate_linked_payment_transaction(
        self,
        linked_transaction_id: int | None,
        amount: Decimal,
        user_id: str,
    ) -> None:
        if linked_transaction_id is None:
            return

        if self.transaction_repository is None:
            return

        transaction = self.transaction_repository.get_by_id(
            linked_transaction_id,
            user_id,
        )

        if transaction is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Linked payment transaction not found",
            )

        if transaction.direction != "in":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Owed payments can only be linked to money in transactions",
            )

        existing_payment_total = self.repository.get_linked_transaction_payment_total(
            linked_transaction_id=linked_transaction_id,
            user_id=user_id,
        )

        if existing_payment_total + amount > transaction.amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Linked payment total cannot exceed money in transaction amount",
            )

    def _validate_linked_transaction_capacity(
        self,
        linked_transaction_id: int | None,
        amount_total: Decimal,
        status_value: str,
        user_id: str,
        exclude_owed_item_id: int | None = None,
    ) -> None:
        if linked_transaction_id is None or status_value == "cancelled":
            return

        if self.transaction_repository is None:
            return

        transaction = self.transaction_repository.get_by_id(
            linked_transaction_id,
            user_id,
        )

        if transaction is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Linked transaction not found",
            )

        if transaction.direction != "out":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Owed items can only be linked to money out transactions",
            )

        existing_owed_total = self.repository.get_linked_transaction_owed_total(
            linked_transaction_id=linked_transaction_id,
            user_id=user_id,
            exclude_owed_item_id=exclude_owed_item_id,
        )

        if existing_owed_total + amount_total > transaction.amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Total owed amount cannot exceed linked transaction amount",
            )

    def _calculate_amount_remaining(
        self,
        amount_total: Decimal,
        amount_paid: Decimal,
    ) -> Decimal:
        if amount_paid > amount_total:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Amount paid cannot be greater than amount total",
            )

        return amount_total - amount_paid

    def _calculate_status(
        self,
        amount_paid: Decimal,
        amount_remaining: Decimal,
    ) -> str:
        if amount_remaining == 0:
            return "paid"

        if amount_paid > 0:
            return "partially_paid"

        return "open"


    def _with_dedupe_hash(
        self,
        owed_data: OwedItemCreate,
        user_id: str,
    ) -> OwedItemCreate:
        if owed_data.dedupe_hash is not None or owed_data.linked_transaction_id is None:
            return owed_data

        hash_input = "|".join(
            [
                user_id,
                str(owed_data.linked_transaction_id),
                owed_data.person.strip().lower(),
                owed_data.source,
            ]
        )
        dedupe_hash = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()

        return owed_data.model_copy(update={"dedupe_hash": dedupe_hash})

    def _get_user_id(self, current_user: CurrentUser | None) -> str:
        if current_user is None:
            return LOCAL_DEFAULT_USER_ID

        return current_user.id
