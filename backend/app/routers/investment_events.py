from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser, get_current_user
from app.database import get_db
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.repositories.market_price_history_repository import (
    MarketPriceHistoryRepository,
)
from app.repositories.market_price_repository import MarketPriceRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.investment_event import (
    InvestmentEventCreate,
    InvestmentEventRead,
    InvestmentMonthlyChangeRead,
    InvestmentMonthlySeriesPointRead,
    InvestmentPositionRead,
    InvestmentRealisedGainRead,
    ManualFundingResolutionCreate,
    ManualFundingResolutionRead,
)
from app.services.investment_event_service import InvestmentEventService


router = APIRouter(prefix="/api/investment-events", tags=["investment-events"])


def get_investment_event_service(
    db: Session = Depends(get_db),
) -> InvestmentEventService:
    repository = InvestmentEventRepository(db)
    transaction_repository = TransactionRepository(db)
    market_price_repository = MarketPriceRepository(db)
    market_price_history_repository = MarketPriceHistoryRepository(db)

    return InvestmentEventService(
        repository=repository,
        transaction_repository=transaction_repository,
        market_price_repository=market_price_repository,
        market_price_history_repository=market_price_history_repository,
    )


@router.post(
    "", response_model=InvestmentEventRead, status_code=status.HTTP_201_CREATED
)
def create_investment_event(
    event_data: InvestmentEventCreate,
    service: InvestmentEventService = Depends(get_investment_event_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.create_event(event_data, current_user=current_user)


@router.get("", response_model=list[InvestmentEventRead])
def list_investment_events(
    source: str | None = Query(default=None),
    event_type: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: InvestmentEventService = Depends(get_investment_event_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.list_events(
        source=source,
        event_type=event_type,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
        current_user=current_user,
    )


@router.get("/positions", response_model=list[InvestmentPositionRead])
def list_investment_positions(
    source: str | None = Query(default=None),
    service: InvestmentEventService = Depends(get_investment_event_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.list_positions(
        source=source,
        current_user=current_user,
    )


@router.get("/monthly-change", response_model=InvestmentMonthlyChangeRead)
def get_investment_monthly_change(
    year: int = Query(ge=1900, le=2200),
    month: int = Query(ge=1, le=12),
    service: InvestmentEventService = Depends(get_investment_event_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_monthly_change(
        year=year,
        month=month,
        current_user=current_user,
    )


@router.get("/realised-gains", response_model=list[InvestmentRealisedGainRead])
def list_investment_realised_gains(
    source: str | None = Query(default=None),
    service: InvestmentEventService = Depends(get_investment_event_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.list_realised_gains(source=source, current_user=current_user)


@router.get("/monthly-series", response_model=list[InvestmentMonthlySeriesPointRead])
def get_investment_monthly_series(
    months: int = Query(default=24, ge=1, le=60),
    service: InvestmentEventService = Depends(get_investment_event_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_monthly_series(
        months=months,
        current_user=current_user,
    )


@router.get("/{event_id}", response_model=InvestmentEventRead)
def get_investment_event(
    event_id: int,
    service: InvestmentEventService = Depends(get_investment_event_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_event(event_id, current_user=current_user)


@router.post(
    "/{event_id}/resolve-manual-funding",
    response_model=ManualFundingResolutionRead,
)
def resolve_manual_funding(
    event_id: int,
    resolution_data: ManualFundingResolutionCreate,
    service: InvestmentEventService = Depends(get_investment_event_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    investment_event, transaction_id = service.resolve_manual_funding(
        event_id=event_id,
        resolution_data=resolution_data,
        current_user=current_user,
    )

    return {
        "investment_event": investment_event,
        "transaction_id": transaction_id,
    }
