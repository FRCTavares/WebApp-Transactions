from decimal import Decimal

from fastapi import HTTPException, status

from app.auth.current_user import CurrentUser
from app.models.owed_item import OwedItem
from app.models.owed_payment import OwedPayment, OwedPaymentAllocation
from app.repositories.owed_repository import OwedRepository
from app.schemas.owed_item import (
    OwedItemCreate,
    OwedItemUpdate,
    OwedPaymentCreate,
    OwedPaymentRead,
)


class OwedService:
    def __init__(self, repository: OwedRepository) -> None:
        self.repository = repository

    def create_owed_item(
        self,
        owed_data: OwedItemCreate,
        current_user: CurrentUser | None = None,
    ) -> OwedItem:
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

        return self.repository.create(owed_data, amount_remaining)

    def list_owed_items(
        self,
        status: str | None = None,
        person: str | None = None,
        limit: int = 100,
        offset: int = 0,
        current_user: CurrentUser | None = None,
    ) -> list[OwedItem]:
        return self.repository.list(
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
        owed_item = self.repository.get_by_id(owed_item_id)

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

        if owed_data.status is None:
            owed_data = owed_data.model_copy(
                update={
                    "status": self._calculate_status(
                        amount_paid=amount_paid,
                        amount_remaining=amount_remaining,
                    )
                }
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
        )

        payment = self.repository.create_payment(payment)

        remaining_to_allocate = payment_data.amount

        if payment_data.allocations:
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

                remaining_to_allocate = self._allocate_to_owed_item(
                    payment_id=payment.id,
                    owed_item=owed_item,
                    amount=allocation_data.amount,
                    remaining_to_allocate=remaining_to_allocate,
                )
        else:
            for owed_item in self.repository.list_open_by_person(payment_data.person):
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

        return self._build_payment_read(payment)

    def list_payments(
        self,
        person: str | None = None,
        limit: int = 100,
        offset: int = 0,
        current_user: CurrentUser | None = None,
    ) -> list[OwedPaymentRead]:
        return [
            self._build_payment_read(payment)
            for payment in self.repository.list_payments(
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
        payment = self.repository.get_payment_by_id(payment_id)

        if payment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Owed payment not found",
            )

        return self._build_payment_read(payment)

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
        self.repository.create_allocation(allocation)

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

    def _build_payment_read(self, payment: OwedPayment) -> OwedPaymentRead:
        allocations = self.repository.list_allocations_for_payment(payment.id)
        allocated_amount = self.repository.get_allocated_total_for_payment(payment.id)

        return OwedPaymentRead(
            id=payment.id,
            person=payment.person,
            payment_date=payment.payment_date,
            amount=payment.amount,
            currency=payment.currency,
            method=payment.method,
            notes=payment.notes,
            linked_transaction_id=payment.linked_transaction_id,
            allocated_amount=allocated_amount,
            unallocated_amount=payment.amount - allocated_amount,
            allocations=allocations,
            created_at=payment.created_at,
            updated_at=payment.updated_at,
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
