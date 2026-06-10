from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import TransactionCreate, TransactionRead, TransactionUpdate
from app.services.transaction_service import TransactionService


router = APIRouter(prefix="/api/transactions", tags=["transactions"])


def get_transaction_service(db: Session = Depends(get_db)) -> TransactionService:
    repository = TransactionRepository(db)
    return TransactionService(repository)


@router.post(
    "",
    response_model=TransactionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_transaction(
    transaction_data: TransactionCreate,
    service: TransactionService = Depends(get_transaction_service),
):
    return service.create_transaction(transaction_data)


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    direction: str | None = Query(default=None, pattern="^(in|out)$"),
    category: str | None = Query(default=None),
    source: str | None = Query(default=None),
    cashflow_type: str | None = Query(
        default=None,
        pattern="^(income|expense|internal_transfer|investment|reimbursement|reimbursed_expense)$",
    ),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    search: str | None = Query(default=None, min_length=1),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: TransactionService = Depends(get_transaction_service),
):
    return service.list_transactions(
        direction=direction,
        category=category,
        source=source,
        cashflow_type=cashflow_type,
        date_from=date_from,
        date_to=date_to,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.get("/uncategorised", response_model=list[TransactionRead])
def list_uncategorised_transactions(
    direction: str | None = Query(default=None, pattern="^(in|out)$"),
    source: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    service: TransactionService = Depends(get_transaction_service),
):
    return service.list_uncategorised_transactions(
        direction=direction,
        source=source,
        limit=limit,
    )


@router.get("/{transaction_id}", response_model=TransactionRead)
def get_transaction(
    transaction_id: int,
    service: TransactionService = Depends(get_transaction_service),
):
    return service.get_transaction(transaction_id)


@router.patch("/{transaction_id}", response_model=TransactionRead)
def update_transaction(
    transaction_id: int,
    transaction_data: TransactionUpdate,
    service: TransactionService = Depends(get_transaction_service),
):
    return service.update_transaction(transaction_id, transaction_data)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: int,
    service: TransactionService = Depends(get_transaction_service),
):
    service.delete_transaction(transaction_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
