from decimal import Decimal

from fastapi import HTTPException, status

from app.models.owed_item import OwedItem
from app.repositories.owed_repository import OwedRepository
from app.schemas.owed_item import OwedItemCreate, OwedItemUpdate


class OwedService:
    def __init__(self, repository: OwedRepository) -> None:
        self.repository = repository

    def create_owed_item(self, owed_data: OwedItemCreate) -> OwedItem:
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
    ) -> list[OwedItem]:
        return self.repository.list(
            status=status,
            person=person,
            limit=limit,
            offset=offset,
        )

    def get_owed_item(self, owed_item_id: int) -> OwedItem:
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
    ) -> OwedItem:
        owed_item = self.get_owed_item(owed_item_id)

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

    def delete_owed_item(self, owed_item_id: int) -> None:
        owed_item = self.get_owed_item(owed_item_id)
        self.repository.delete(owed_item)

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
