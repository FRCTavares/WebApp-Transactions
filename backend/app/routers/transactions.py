import csv
from datetime import date
from io import StringIO

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser, get_current_user
from app.database import get_db
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import TransactionCreate, TransactionRead, TransactionUpdate
from app.services.transaction_service import TransactionService


router = APIRouter(prefix="/api/transactions", tags=["transactions"])


TRANSACTION_EXPORT_COLUMNS = [
    "id",
    "date",
    "description",
    "raw_description",
    "amount",
    "direction",
    "cashflow_type",
    "source",
    "account",
    "category",
    "subcategory",
    "currency",
    "merchant",
    "notes",
    "import_batch_id",
    "external_id",
    "dedupe_hash",
    "created_at",
    "updated_at",
]


def get_csv_value(value: object) -> str:
    if value is None:
        return ""

    return str(value)


def build_transactions_csv(transactions: list[TransactionRead]) -> str:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=TRANSACTION_EXPORT_COLUMNS)
    writer.writeheader()

    for transaction in transactions:
        row = {
            column: get_csv_value(getattr(transaction, column))
            for column in TRANSACTION_EXPORT_COLUMNS
        }
        writer.writerow(row)

    return output.getvalue()


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
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.create_transaction(transaction_data, current_user)


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
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.list_transactions(
        current_user=current_user,
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


@router.get("/export")
def export_transactions(
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
    limit: int = Query(default=10000, ge=1, le=50000),
    offset: int = Query(default=0, ge=0),
    service: TransactionService = Depends(get_transaction_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    transactions = service.list_transactions(
        current_user=current_user,
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

    csv_content = build_transactions_csv(transactions)

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="transactions-export.csv"',
        },
    )



@router.get("/uncategorised", response_model=list[TransactionRead])
def list_uncategorised_transactions(
    direction: str | None = Query(default=None, pattern="^(in|out)$"),
    source: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    service: TransactionService = Depends(get_transaction_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.list_uncategorised_transactions(
        current_user=current_user,
        direction=direction,
        source=source,
        limit=limit,
    )


@router.get("/{transaction_id}", response_model=TransactionRead)
def get_transaction(
    transaction_id: int,
    service: TransactionService = Depends(get_transaction_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_transaction(transaction_id, current_user)


@router.patch("/{transaction_id}", response_model=TransactionRead)
def update_transaction(
    transaction_id: int,
    transaction_data: TransactionUpdate,
    service: TransactionService = Depends(get_transaction_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.update_transaction(transaction_id, transaction_data, current_user)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: int,
    service: TransactionService = Depends(get_transaction_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    service.delete_transaction(transaction_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
