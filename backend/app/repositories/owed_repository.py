from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.owed_item import OwedItem
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

        if status is not None:
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
