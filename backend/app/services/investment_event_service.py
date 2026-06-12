from datetime import date
from decimal import Decimal

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

    def list_positions(
        self,
        source: str | None = None,
    ) -> list[dict[str, object]]:
        events = self.repository.list_all(source=source)
        positions: dict[tuple[str, str | None, str | None, str | None, str], dict[str, object]] = {}

        for event in events:
            if event.event_type not in {"market_buy", "market_sell"}:
                continue

            if event.quantity is None or event.quantity <= 0:
                continue

            key = (
                event.source,
                event.account,
                event.ticker,
                event.isin,
                event.currency,
            )

            if key not in positions:
                positions[key] = {
                    "source": event.source,
                    "account": event.account,
                    "instrument_name": event.instrument_name,
                    "ticker": event.ticker,
                    "isin": event.isin,
                    "quantity": Decimal("0"),
                    "total_cost": Decimal("0"),
                    "currency": event.currency,
                    "average_price": Decimal("0"),
                }

            position = positions[key]

            if event.event_type == "market_buy":
                position["quantity"] = position["quantity"] + event.quantity
                position["total_cost"] = position["total_cost"] + event.amount

                if position["instrument_name"] is None:
                    position["instrument_name"] = event.instrument_name

            if event.event_type == "market_sell":
                position["quantity"] = position["quantity"] - event.quantity
                position["total_cost"] = position["total_cost"] - event.amount

        open_positions = []

        for position in positions.values():
            quantity = position["quantity"]

            if quantity <= 0:
                continue

            position["average_price"] = (position["total_cost"] / quantity).quantize(Decimal("0.00000001"))
            open_positions.append(position)

        return sorted(
            open_positions,
            key=lambda position: (
                str(position["ticker"] or ""),
                str(position["instrument_name"] or ""),
            ),
        )

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
