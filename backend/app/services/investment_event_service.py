from datetime import date

from fastapi import HTTPException, status

from app.models.investment_event import InvestmentEvent
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.investment_event import (
    InvestmentEventCreate,
    InvestmentEventUpdate,
    ManualFundingResolutionCreate,
)
from app.schemas.transaction import TransactionCreate


class InvestmentEventService:
    def __init__(
        self,
        repository: InvestmentEventRepository,
        transaction_repository: TransactionRepository | None = None,
    ) -> None:
        self.repository = repository
        self.transaction_repository = transaction_repository

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
        events = self.repository.list(
            source=source,
            event_type=event_type,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
        )

        return [self._attach_matched_transaction(event) for event in events]

    def get_event(self, event_id: int) -> InvestmentEvent:
        event = self.repository.get_by_id(event_id)

        if event is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Investment event not found",
            )

        return self._attach_matched_transaction(event)

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


    def _attach_matched_transaction(self, event: InvestmentEvent) -> InvestmentEvent:
        matched_transaction = None

        if (
            self.transaction_repository is not None
            and event.matched_transaction_id is not None
        ):
            matched_transaction = self.transaction_repository.get_by_id(
                event.matched_transaction_id
            )

        event.matched_transaction = matched_transaction

        return event

    def resolve_manual_funding(
        self,
        event_id: int,
        resolution_data: ManualFundingResolutionCreate,
    ) -> tuple[InvestmentEvent, int]:
        if self.transaction_repository is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Transaction repository is required",
            )

        event = self.get_event(event_id)

        if event.event_type != "deposit":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only deposit investment events can be manually resolved",
            )

        if event.funding_match_status != "unmatched":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only unmatched funding events can be manually resolved",
            )

        transaction = self.transaction_repository.create(
            TransactionCreate(
                date=resolution_data.date,
                description=resolution_data.description,
                raw_description=(
                    f"Manual funding resolution for investment event {event.id}: "
                    f"{event.raw_description}"
                ),
                amount=resolution_data.eur_amount,
                original_amount=event.amount,
                original_currency=event.currency,
                fx_rate_to_eur=resolution_data.eur_amount / event.amount,
                fx_rate_source="manual",
                direction="out",
                cashflow_type="investment",
                source="manual",
                account="ActivoBank",
                currency="EUR",
                notes=resolution_data.notes,
            )
        )

        updated_event = self.repository.update(
            event,
            InvestmentEventUpdate(
                transaction_id=transaction.id,
                matched_transaction_id=transaction.id,
                funding_match_status="manual",
                fx_rate_to_eur=resolution_data.eur_amount / event.amount,
                fx_rate_source="manual",
            ),
        )

        return updated_event, transaction.id
