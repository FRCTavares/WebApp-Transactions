from datetime import date

from fastapi import HTTPException, status

from app.models.investment_event import InvestmentEvent
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.schemas.investment_event import InvestmentEventCreate, InvestmentEventUpdate


class InvestmentEventService:
    def __init__(self, repository: InvestmentEventRepository) -> None:
        self.repository = repository

    def create_event(self, event_data: InvestmentEventCreate) -> InvestmentEvent:
        return self.repository.create(event_data)

    def list_events(
        self,
        source: str | None = None,
        event_type: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[InvestmentEvent]:
        return self.repository.list(
            source=source,
            event_type=event_type,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
        )

    def get_event(self, event_id: int) -> InvestmentEvent:
        event = self.repository.get_by_id(event_id)

        if event is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Investment event not found",
            )

        return event

    def update_event(
        self,
        event_id: int,
        event_data: InvestmentEventUpdate,
    ) -> InvestmentEvent:
        event = self.get_event(event_id)
        return self.repository.update(event, event_data)

    def delete_event(self, event_id: int) -> None:
        event = self.get_event(event_id)
        self.repository.delete(event)
