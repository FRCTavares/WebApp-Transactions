from datetime import date

from sqlalchemy import delete as sqlalchemy_delete, select
from sqlalchemy.orm import Session

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.models.investment_event import InvestmentEvent
from app.schemas.investment_event import InvestmentEventCreate, InvestmentEventUpdate


class InvestmentEventRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        event_data: InvestmentEventCreate,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> InvestmentEvent:
        event = InvestmentEvent(
            user_id=user_id,
            **event_data.model_dump(),
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def list(
        self,
        source: str | None = None,
        event_type: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 100,
        offset: int = 0,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> list[InvestmentEvent]:
        statement = (
            select(InvestmentEvent)
            .where(InvestmentEvent.user_id == user_id)
            .order_by(
                InvestmentEvent.date.desc(),
                InvestmentEvent.id.desc(),
            )
        )

        if source is not None:
            statement = statement.where(InvestmentEvent.source == source)

        if event_type is not None:
            statement = statement.where(InvestmentEvent.event_type == event_type)

        if date_from is not None:
            statement = statement.where(InvestmentEvent.date >= date_from)

        if date_to is not None:
            statement = statement.where(InvestmentEvent.date <= date_to)

        statement = statement.offset(offset).limit(limit)

        return list(self.db.scalars(statement).all())

    def list_all(
        self,
        source: str | None = None,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> list[InvestmentEvent]:
        statement = (
            select(InvestmentEvent)
            .where(InvestmentEvent.user_id == user_id)
            .order_by(
                InvestmentEvent.date.asc(),
                InvestmentEvent.id.asc(),
            )
        )

        if source is not None:
            statement = statement.where(InvestmentEvent.source == source)

        return list(self.db.scalars(statement).all())

    def list_until(
        self,
        end_date: date,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> list[InvestmentEvent]:
        statement = (
            select(InvestmentEvent)
            .where(InvestmentEvent.user_id == user_id)
            .where(InvestmentEvent.date <= end_date)
            .order_by(InvestmentEvent.date.asc(), InvestmentEvent.id.asc())
        )

        return list(self.db.scalars(statement).all())

    def list_between(
        self,
        start_date: date,
        end_date: date,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> list[InvestmentEvent]:
        statement = (
            select(InvestmentEvent)
            .where(InvestmentEvent.user_id == user_id)
            .where(InvestmentEvent.date >= start_date)
            .where(InvestmentEvent.date < end_date)
            .order_by(InvestmentEvent.date.asc(), InvestmentEvent.id.asc())
        )

        return list(self.db.scalars(statement).all())

    def list_by_import_batch(
        self,
        import_batch_id: int,
        limit: int = 100,
        offset: int = 0,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> list[InvestmentEvent]:
        statement = (
            select(InvestmentEvent)
            .where(InvestmentEvent.user_id == user_id)
            .where(InvestmentEvent.import_batch_id == import_batch_id)
            .order_by(InvestmentEvent.date.desc(), InvestmentEvent.id.desc())
            .offset(offset)
            .limit(limit)
        )

        return list(self.db.scalars(statement).all())

    def get_by_id(
        self,
        event_id: int,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> InvestmentEvent | None:
        statement = (
            select(InvestmentEvent)
            .where(InvestmentEvent.id == event_id)
            .where(InvestmentEvent.user_id == user_id)
        )
        return self.db.scalar(statement)

    def update(
        self,
        event: InvestmentEvent,
        event_data: InvestmentEventUpdate,
    ) -> InvestmentEvent:
        update_data = event_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(event, field, value)

        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def delete(self, event: InvestmentEvent) -> None:
        self.db.delete(event)
        self.db.commit()

    def delete_by_import_batch(
        self,
        import_batch_id: int,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> int:
        statement = (
            sqlalchemy_delete(InvestmentEvent)
            .where(InvestmentEvent.user_id == user_id)
            .where(InvestmentEvent.import_batch_id == import_batch_id)
        )
        result = self.db.execute(statement)
        self.db.commit()

        return result.rowcount or 0

    def exists_by_dedupe_hash(
        self,
        dedupe_hash: str,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> bool:
        statement = (
            select(InvestmentEvent.id)
            .where(InvestmentEvent.user_id == user_id)
            .where(InvestmentEvent.dedupe_hash == dedupe_hash)
        )
        return self.db.scalar(statement) is not None

    def bulk_insert(
        self,
        events: list[InvestmentEvent],
        user_id: str = LOCAL_DEFAULT_USER_ID,
        commit: bool = True,
    ) -> list[InvestmentEvent]:
        for event in events:
            event.user_id = user_id

        self.db.add_all(events)

        if commit:
            self.db.commit()

            for event in events:
                self.db.refresh(event)
        else:
            self.db.flush()

        return events
