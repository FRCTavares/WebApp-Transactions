from decimal import Decimal

from sqlalchemy import delete as sqlalchemy_delete, func, select
from sqlalchemy.orm import Session

from app.models.owed_item import OwedItem
from app.models.owed_payment import OwedPayment, OwedPaymentAllocation
from app.schemas.owed_item import OwedItemCreate, OwedItemUpdate


class OwedRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, owed_data: OwedItemCreate, amount_remaining) -> OwedItem:
        owed_item = OwedItem(
            **owed_data.model_dump(),
            amount_remaining=amount_remaining,
        )
        self.db.add(owed_item)
        self.db.commit()
        self.db.refresh(owed_item)
        return owed_item

    def list(
        self,
        status: str | None = None,
        person: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[OwedItem]:
        statement = select(OwedItem).order_by(OwedItem.created_at.desc(), OwedItem.id.desc())

        if status == "active":
            statement = statement.where(
                OwedItem.status.in_(["open", "partially_paid"])
            )
        elif status is not None:
            statement = statement.where(OwedItem.status == status)

        if person is not None:
            statement = statement.where(OwedItem.person == person)

        statement = statement.offset(offset).limit(limit)

        return list(self.db.scalars(statement).all())

    def get_by_id(self, owed_item_id: int) -> OwedItem | None:
        return self.db.get(OwedItem, owed_item_id)

    def update(
        self,
        owed_item: OwedItem,
        owed_data: OwedItemUpdate,
        amount_remaining,
    ) -> OwedItem:
        update_data = owed_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(owed_item, field, value)

        owed_item.amount_remaining = amount_remaining

        self.db.add(owed_item)
        self.db.commit()
        self.db.refresh(owed_item)
        return owed_item

    def delete(self, owed_item: OwedItem) -> None:
        self.db.delete(owed_item)
        self.db.commit()

    def exists_by_dedupe_hash(self, dedupe_hash: str) -> bool:
        statement = select(OwedItem.id).where(OwedItem.dedupe_hash == dedupe_hash)
        return self.db.scalar(statement) is not None

    def bulk_insert(self, owed_items: list[OwedItem]) -> list[OwedItem]:
        self.db.add_all(owed_items)
        self.db.commit()

        for owed_item in owed_items:
            self.db.refresh(owed_item)

        return owed_items


    def list_open_by_person(self, person: str) -> list[OwedItem]:
        statement = (
            select(OwedItem)
            .where(OwedItem.person == person)
            .where(OwedItem.status.in_(["open", "partially_paid"]))
            .order_by(OwedItem.created_at.asc(), OwedItem.id.asc())
        )

        return list(self.db.scalars(statement).all())

    def create_payment(self, payment: OwedPayment) -> OwedPayment:
        self.db.add(payment)
        self.db.flush()
        return payment

    def create_allocation(self, allocation: OwedPaymentAllocation) -> OwedPaymentAllocation:
        self.db.add(allocation)
        self.db.flush()
        return allocation

    def list_payments(
        self,
        person: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[OwedPayment]:
        statement = select(OwedPayment).order_by(
            OwedPayment.payment_date.desc(),
            OwedPayment.id.desc(),
        )

        if person is not None:
            statement = statement.where(OwedPayment.person == person)

        statement = statement.offset(offset).limit(limit)

        return list(self.db.scalars(statement).all())

    def get_payment_by_id(self, payment_id: int) -> OwedPayment | None:
        return self.db.get(OwedPayment, payment_id)

    def list_allocations_for_payment(self, payment_id: int) -> list[OwedPaymentAllocation]:
        statement = (
            select(OwedPaymentAllocation)
            .where(OwedPaymentAllocation.owed_payment_id == payment_id)
            .order_by(OwedPaymentAllocation.id.asc())
        )

        return list(self.db.scalars(statement).all())

    def get_allocated_total_for_payment(self, payment_id: int) -> Decimal:
        statement = select(func.coalesce(func.sum(OwedPaymentAllocation.amount), 0)).where(
            OwedPaymentAllocation.owed_payment_id == payment_id
        )

        return Decimal(self.db.scalar(statement) or 0)

    def get_allocated_total_for_owed_item(self, owed_item_id: int) -> Decimal:
        statement = select(func.coalesce(func.sum(OwedPaymentAllocation.amount), 0)).where(
            OwedPaymentAllocation.owed_item_id == owed_item_id
        )

        return Decimal(self.db.scalar(statement) or 0)

    def save_owed_item(self, owed_item: OwedItem) -> OwedItem:
        self.db.add(owed_item)
        self.db.flush()
        return owed_item

    def commit(self) -> None:
        self.db.commit()

    def refresh(self, item) -> None:
        self.db.refresh(item)

    def delete_by_import_batch(self, import_batch_id: int) -> int:
        statement = sqlalchemy_delete(OwedItem).where(
            OwedItem.import_batch_id == import_batch_id
        )
        result = self.db.execute(statement)
        self.db.commit()

        return result.rowcount or 0
