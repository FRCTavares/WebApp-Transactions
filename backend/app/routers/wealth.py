from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.wealth_repository import WealthRepository
from app.schemas.wealth import (
    WealthAccountCreate,
    WealthAccountRead,
    WealthAccountUpdate,
    WealthMonthlyRead,
    WealthSnapshotCreate,
    WealthSnapshotRead,
    WealthSnapshotUpdate,
    WealthSummaryRead,
)
from app.services.wealth_service import WealthService


router = APIRouter(prefix="/api/wealth", tags=["wealth"])


def get_wealth_service(db: Session = Depends(get_db)) -> WealthService:
    repository = WealthRepository(db)
    return WealthService(repository)


@router.post(
    "/accounts",
    response_model=WealthAccountRead,
    status_code=status.HTTP_201_CREATED,
)
def create_wealth_account(
    account_data: WealthAccountCreate,
    service: WealthService = Depends(get_wealth_service),
):
    return service.create_account(account_data)


@router.get("/accounts", response_model=list[WealthAccountRead])
def list_wealth_accounts(
    active_only: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: WealthService = Depends(get_wealth_service),
):
    return service.list_accounts(
        active_only=active_only,
        limit=limit,
        offset=offset,
    )


@router.get("/accounts/{account_id}", response_model=WealthAccountRead)
def get_wealth_account(
    account_id: int,
    service: WealthService = Depends(get_wealth_service),
):
    return service.get_account(account_id)


@router.patch("/accounts/{account_id}", response_model=WealthAccountRead)
def update_wealth_account(
    account_id: int,
    account_data: WealthAccountUpdate,
    service: WealthService = Depends(get_wealth_service),
):
    return service.update_account(account_id, account_data)


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wealth_account(
    account_id: int,
    service: WealthService = Depends(get_wealth_service),
):
    service.delete_account(account_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/snapshots",
    response_model=WealthSnapshotRead,
    status_code=status.HTTP_201_CREATED,
)
def create_wealth_snapshot(
    snapshot_data: WealthSnapshotCreate,
    service: WealthService = Depends(get_wealth_service),
):
    return service.create_snapshot(snapshot_data)


@router.get("/snapshots", response_model=list[WealthSnapshotRead])
def list_wealth_snapshots(
    account_id: int | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: WealthService = Depends(get_wealth_service),
):
    return service.list_snapshots(
        account_id=account_id,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )


@router.get("/snapshots/{snapshot_id}", response_model=WealthSnapshotRead)
def get_wealth_snapshot(
    snapshot_id: int,
    service: WealthService = Depends(get_wealth_service),
):
    return service.get_snapshot(snapshot_id)


@router.patch("/snapshots/{snapshot_id}", response_model=WealthSnapshotRead)
def update_wealth_snapshot(
    snapshot_id: int,
    snapshot_data: WealthSnapshotUpdate,
    service: WealthService = Depends(get_wealth_service),
):
    return service.update_snapshot(snapshot_id, snapshot_data)


@router.delete("/snapshots/{snapshot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wealth_snapshot(
    snapshot_id: int,
    service: WealthService = Depends(get_wealth_service),
):
    service.delete_snapshot(snapshot_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/summary", response_model=WealthSummaryRead)
def get_wealth_summary(
    service: WealthService = Depends(get_wealth_service),
):
    return service.get_summary()


@router.get("/monthly", response_model=list[WealthMonthlyRead])
def get_wealth_monthly(
    service: WealthService = Depends(get_wealth_service),
):
    return service.get_monthly_totals()
