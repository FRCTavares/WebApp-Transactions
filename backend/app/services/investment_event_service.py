from datetime import date

from fastapi import HTTPException, status

from app.auth.current_user import CurrentUser
from app.models.investment_event import InvestmentEvent
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.repositories.market_price_history_repository import (
    MarketPriceHistoryRepository,
)
from app.repositories.market_price_repository import MarketPriceRepository
from app.repositories.transaction_repository import TransactionRepository
from app.services.investment_market_validation import (
    build_create_event_candidate,
    build_update_event_candidate,
    validate_market_event_candidate,
    validate_market_sell_timeline,
)
from app.services.investment_event_relationship_validation import (
    validate_investment_transaction_links,
)
from app.services.investment_valuation_service import InvestmentValuationMixin
from app.schemas.investment_event import (
    InvestmentEventCreate,
    InvestmentEventUpdate,
    ManualFundingResolutionCreate,
)
from app.schemas.transaction import TransactionCreate


class InvestmentEventService(InvestmentValuationMixin):
    """Investment event CRUD and mutation logic.

    Portfolio valuation, cost-basis, and FX-rate analytics live in
    `InvestmentValuationMixin` (`investment_valuation_service.py`) — split
    out to keep this file under the project's line-count limits. Both
    halves form a single service; callers should keep instantiating and
    calling `InvestmentEventService` exactly as before.
    """

    def __init__(
        self,
        repository: InvestmentEventRepository,
        transaction_repository: TransactionRepository | None = None,
        market_price_repository: MarketPriceRepository | None = None,
        market_price_history_repository: MarketPriceHistoryRepository | None = None,
    ) -> None:
        self.repository = repository
        self.transaction_repository = transaction_repository
        self.market_price_repository = market_price_repository
        self.market_price_history_repository = market_price_history_repository

    def create_event(
        self,
        event_data: InvestmentEventCreate,
        *,
        current_user: CurrentUser,
    ) -> InvestmentEvent:
        user_id = current_user.id
        candidate = build_create_event_candidate(event_data)

        validate_investment_transaction_links(
            event_data,
            transaction_repository=self.transaction_repository,
            investment_event_repository=self.repository,
            user_id=user_id,
        )
        validate_market_event_candidate(candidate)
        validate_market_sell_timeline(
            candidate=candidate,
            existing_events=self.repository.list_all(user_id=user_id),
        )

        return self.repository.create(
            event_data,
            user_id=user_id,
        )

    def get_activity_months(
        self,
        *,
        current_user: CurrentUser,
    ) -> set[str]:
        return {
            event.date.strftime("%Y-%m")
            for event in self.repository.list_all(user_id=current_user.id)
        }

    def list_events(
        self,
        source: str | None = None,
        event_type: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 100,
        offset: int = 0,
        *,
        current_user: CurrentUser,
    ) -> list[InvestmentEvent]:
        user_id = current_user.id
        events = self.repository.list(
            source=source,
            event_type=event_type,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
            user_id=user_id,
        )

        return [
            self._attach_matched_transaction(event, user_id=user_id) for event in events
        ]

    def get_event(
        self,
        event_id: int,
        *,
        current_user: CurrentUser,
    ) -> InvestmentEvent:
        event = self.repository.get_by_id(
            event_id,
            user_id=current_user.id,
        )

        if event is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Investment event not found",
            )

        return self._attach_matched_transaction(event, user_id=current_user.id)

    def update_event(
        self,
        event_id: int,
        event_data: InvestmentEventUpdate,
        *,
        current_user: CurrentUser,
    ) -> InvestmentEvent:
        user_id = current_user.id
        event = self.get_event(event_id, current_user=current_user)
        candidate = build_update_event_candidate(event, event_data)

        validate_investment_transaction_links(
            event_data,
            transaction_repository=self.transaction_repository,
            investment_event_repository=self.repository,
            user_id=user_id,
            existing_event_id=event.id,
            existing_transaction_id=event.transaction_id,
            existing_matched_transaction_id=(
                event.matched_transaction_id
            ),
        )
        validate_market_event_candidate(candidate)
        validate_market_sell_timeline(
            candidate=candidate,
            existing_events=self.repository.list_all(user_id=user_id),
            existing_event=event,
        )

        return self.repository.update(event, event_data)

    def delete_event(
        self,
        event_id: int,
        *,
        current_user: CurrentUser,
    ) -> None:
        event = self.get_event(event_id, current_user=current_user)
        self.repository.delete(event)

    def _attach_matched_transaction(
        self,
        event: InvestmentEvent,
        *,
        user_id: str,
    ) -> InvestmentEvent:
        matched_transaction = None

        if (
            self.transaction_repository is not None
            and event.matched_transaction_id is not None
        ):
            matched_transaction = self.transaction_repository.get_by_id(
                event.matched_transaction_id,
                user_id=user_id,
            )

        event.matched_transaction = matched_transaction

        return event

    def resolve_manual_funding(
        self,
        event_id: int,
        resolution_data: ManualFundingResolutionCreate,
        *,
        current_user: CurrentUser,
    ) -> tuple[InvestmentEvent, int]:
        if self.transaction_repository is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Transaction repository is required",
            )

        event = self.get_event(event_id, current_user=current_user)

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

        db = self.repository.db

        if self.transaction_repository.db is not db:
            raise RuntimeError(
                "Investment and transaction repositories must share a session"
            )

        try:
            transaction = self.transaction_repository.create(
                TransactionCreate(
                    date=resolution_data.date,
                    description=resolution_data.description,
                    raw_description=(
                        "Manual funding resolution for investment "
                        f"event {event.id}: {event.raw_description}"
                    ),
                    amount=resolution_data.eur_amount,
                    original_amount=event.amount,
                    original_currency=event.currency,
                    fx_rate_to_eur=(
                        resolution_data.eur_amount / event.amount
                    ),
                    fx_rate_source="manual",
                    direction="out",
                    cashflow_type="transfer",
                    source="manual",
                    account="ActivoBank",
                    currency="EUR",
                    notes=resolution_data.notes,
                ),
                user_id=current_user.id,
                commit=False,
            )

            updated_event = self.repository.update(
                event,
                InvestmentEventUpdate(
                    transaction_id=transaction.id,
                    matched_transaction_id=transaction.id,
                    funding_match_status="manual",
                    fx_rate_to_eur=(
                        resolution_data.eur_amount / event.amount
                    ),
                    fx_rate_source="manual",
                ),
                commit=False,
            )

            db.commit()
            db.refresh(transaction)
            db.refresh(updated_event)
        except Exception:
            db.rollback()
            raise

        return updated_event, transaction.id
