from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.schemas.investment_event import InvestmentEventRead
from app.services.investment_event_service import InvestmentEventService


router = APIRouter(prefix="/api/investment-events", tags=["investment-events"])


def get_investment_event_service(
    db: Session = Depends(get_db),
) -> InvestmentEventService:
    repository = InvestmentEventRepository(db)
    return InvestmentEventService(repository=repository)


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


@router.get("/{event_id}", response_model=InvestmentEventRead)
def get_investment_event(
    event_id: int,
    service: InvestmentEventService = Depends(get_investment_event_service),
):
    return service.get_event(event_id)
