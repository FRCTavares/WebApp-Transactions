from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser, get_current_user
from app.database import get_db
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.repositories.market_price_history_repository import MarketPriceHistoryRepository
from app.repositories.market_price_repository import MarketPriceRepository
from app.repositories.owed_repository import OwedRepository
from app.repositories.transaction_repository import TransactionRepository
from app.repositories.wealth_repository import WealthRepository
from app.schemas.wealth import (
    WealthAccountCreate,
    WealthAccountRead,
    WealthAccountUpdate,
    WealthMonthlyRead,
    WealthReconciliationRead,
    WealthSnapshotCreate,
    WealthSnapshotRead,
    WealthSnapshotUpdate,
    WealthSummaryRead,
)
from app.services.investment_event_service import InvestmentEventService
from app.services.wealth_service import WealthService


router = APIRouter(prefix="/api/wealth", tags=["wealth"])


def get_wealth_service(db: Session = Depends(get_db)) -> WealthService:
    repository = WealthRepository(db)
    owed_repository = OwedRepository(db)
    investment_event_service = InvestmentEventService(
        repository=InvestmentEventRepository(db),
        transaction_repository=TransactionRepository(db),
        market_price_repository=MarketPriceRepository(db),
        market_price_history_repository=MarketPriceHistoryRepository(db),
    )
    return WealthService(
        repository=repository,
        owed_repository=owed_repository,
        investment_event_service=investment_event_service,
    )


@router.post(
    "/accounts",
    response_model=WealthAccountRead,
    status_code=status.HTTP_201_CREATED,
)
def create_wealth_account(
    account_data: WealthAccountCreate,
    service: WealthService = Depends(get_wealth_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.create_account(account_data, current_user)


@router.get("/accounts", response_model=list[WealthAccountRead])
def list_wealth_accounts(
    active_only: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: WealthService = Depends(get_wealth_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.list_accounts(
        active_only=active_only,
        limit=limit,
        offset=offset,
        current_user=current_user,
    )


@router.get("/accounts/{account_id}", response_model=WealthAccountRead)
def get_wealth_account(
    account_id: int,
    service: WealthService = Depends(get_wealth_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_account(account_id, current_user)


@router.patch("/accounts/{account_id}", response_model=WealthAccountRead)
def update_wealth_account(
    account_id: int,
    account_data: WealthAccountUpdate,
    service: WealthService = Depends(get_wealth_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.update_account(account_id, account_data, current_user)


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wealth_account(
    account_id: int,
    service: WealthService = Depends(get_wealth_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    service.delete_account(account_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/snapshots",
    response_model=WealthSnapshotRead,
    status_code=status.HTTP_201_CREATED,
)
def create_wealth_snapshot(
    snapshot_data: WealthSnapshotCreate,
    service: WealthService = Depends(get_wealth_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.create_snapshot(snapshot_data, current_user)


@router.get("/snapshots", response_model=list[WealthSnapshotRead])
def list_wealth_snapshots(
    account_id: int | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: WealthService = Depends(get_wealth_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.list_snapshots(
        account_id=account_id,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
        current_user=current_user,
    )


@router.get("/snapshots/{snapshot_id}", response_model=WealthSnapshotRead)
def get_wealth_snapshot(
    snapshot_id: int,
    service: WealthService = Depends(get_wealth_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_snapshot(snapshot_id, current_user)


@router.patch("/snapshots/{snapshot_id}", response_model=WealthSnapshotRead)
def update_wealth_snapshot(
    snapshot_id: int,
    snapshot_data: WealthSnapshotUpdate,
    service: WealthService = Depends(get_wealth_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.update_snapshot(snapshot_id, snapshot_data, current_user)


@router.delete("/snapshots/{snapshot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wealth_snapshot(
    snapshot_id: int,
    service: WealthService = Depends(get_wealth_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    service.delete_snapshot(snapshot_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/summary", response_model=WealthSummaryRead)
def get_wealth_summary(
    service: WealthService = Depends(get_wealth_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_summary(current_user)


@router.get("/reconciliation", response_model=WealthReconciliationRead)
def get_wealth_reconciliation(
    service: WealthService = Depends(get_wealth_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_reconciliation(current_user)


@router.get("/monthly", response_model=list[WealthMonthlyRead])
def get_wealth_monthly(
    service: WealthService = Depends(get_wealth_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_monthly_totals(current_user)
