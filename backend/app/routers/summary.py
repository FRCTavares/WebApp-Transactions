from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser, get_current_user
from app.database import get_db
from app.repositories.summary_repository import SummaryRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.summary import CategorySummaryResponse, MonthlySummary
from app.services.summary_service import SummaryService


router = APIRouter(prefix="/api/summary", tags=["summary"])


def get_summary_service(db: Session = Depends(get_db)) -> SummaryService:
    summary_repository = SummaryRepository(db)
    transaction_repository = TransactionRepository(db)

    return SummaryService(
        repository=summary_repository,
        transaction_repository=transaction_repository,
    )


@router.get("", response_model=MonthlySummary)
def get_monthly_summary(
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    service: SummaryService = Depends(get_summary_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_monthly_summary(
        year=year,
        month=month,
        current_user=current_user,
    )


@router.get("/categories", response_model=CategorySummaryResponse)
def get_category_summary(
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    direction: str | None = Query(default=None, pattern="^(in|out)$"),
    cashflow_type: str | None = Query(
        default=None,
        pattern="^(income|expense|transfer)$",
    ),
    service: SummaryService = Depends(get_summary_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_category_summary(
        year=year,
        month=month,
        direction=direction,
        cashflow_type=cashflow_type,
        current_user=current_user,
    )
