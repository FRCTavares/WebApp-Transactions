from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.investment_event import (
    InvestmentEventRead,
    InvestmentPositionRead,
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

    return InvestmentEventService(
        repository=repository,
        transaction_repository=transaction_repository,
    )


@router.get("", response_model=list[InvestmentEventRead])
def list_investment_events(
    source: str | None = Query(default=None),
    event_type: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: InvestmentEventService = Depends(get_investment_event_service),
):
    return service.list_events(
        source=source,
        event_type=event_type,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )


@router.get("/positions", response_model=list[InvestmentPositionRead])
def list_investment_positions(
    source: str | None = Query(default=None),
    service: InvestmentEventService = Depends(get_investment_event_service),
):
    return service.list_positions(source=source)


@router.get("/{event_id}", response_model=InvestmentEventRead)
def get_investment_event(
    event_id: int,
    service: InvestmentEventService = Depends(get_investment_event_service),
):
    return service.get_event(event_id)


@router.post(
    "/{event_id}/resolve-manual-funding",
    response_model=ManualFundingResolutionRead,
)
def resolve_manual_funding(
    event_id: int,
    resolution_data: ManualFundingResolutionCreate,
    service: InvestmentEventService = Depends(get_investment_event_service),
):
    investment_event, transaction_id = service.resolve_manual_funding(
        event_id=event_id,
        resolution_data=resolution_data,
    )

    return {
        "investment_event": investment_event,
        "transaction_id": transaction_id,
    }
