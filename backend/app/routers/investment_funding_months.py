from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser, get_current_user
from app.database import get_db
from app.repositories.investment_funding_month_repository import (
    InvestmentFundingMonthRepository,
)
from app.schemas.investment_funding_month import (
    InvestmentFundingMonthCreate,
    InvestmentFundingMonthRead,
)
from app.services.investment_funding_month_service import InvestmentFundingMonthService


router = APIRouter(
    prefix="/api/investment-funding-months",
    tags=["investment-funding-months"],
)


def get_investment_funding_month_service(
    db: Session = Depends(get_db),
) -> InvestmentFundingMonthService:
    return InvestmentFundingMonthService(
        repository=InvestmentFundingMonthRepository(db),
    )


@router.get("", response_model=list[InvestmentFundingMonthRead])
def list_investment_funding_months(
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    source: str | None = Query(default=None),
    service: InvestmentFundingMonthService = Depends(get_investment_funding_month_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.list_funding_months(
        month=month,
        source=source,
        current_user=current_user,
    )


@router.post("", response_model=InvestmentFundingMonthRead, status_code=status.HTTP_200_OK)
def upsert_investment_funding_month(
    data: InvestmentFundingMonthCreate,
    service: InvestmentFundingMonthService = Depends(get_investment_funding_month_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.upsert_funding_month(data, current_user=current_user)
