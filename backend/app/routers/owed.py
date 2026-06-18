import csv
from io import StringIO

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser, get_current_user
from app.database import get_db
from app.repositories.owed_repository import OwedRepository
from app.schemas.owed_item import (
    OwedItemCreate,
    OwedItemRead,
    OwedItemUpdate,
    OwedPaymentCreate,
    OwedPaymentRead,
)
from app.services.owed_service import OwedService


router = APIRouter(prefix="/api/owed", tags=["owed"])


OWED_EXPORT_COLUMNS = [
    "id",
    "person",
    "reason",
    "status",
    "amount_total",
    "amount_paid",
    "amount_remaining",
    "due_date",
    "linked_transaction_id",
    "notes",
    "created_at",
    "updated_at",
]


def get_csv_value(value: object) -> str:
    if value is None:
        return ""

    return str(value)


def build_owed_items_csv(owed_items: list[OwedItemRead]) -> str:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=OWED_EXPORT_COLUMNS)
    writer.writeheader()

    for owed_item in owed_items:
        row = {
            column: get_csv_value(getattr(owed_item, column))
            for column in OWED_EXPORT_COLUMNS
        }
        writer.writerow(row)

    return output.getvalue()


def get_owed_service(db: Session = Depends(get_db)) -> OwedService:
    repository = OwedRepository(db)
    return OwedService(repository)


@router.post(
    "",
    response_model=OwedItemRead,
    status_code=status.HTTP_201_CREATED,
)
def create_owed_item(
    owed_data: OwedItemCreate,
    service: OwedService = Depends(get_owed_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.create_owed_item(owed_data, current_user)


@router.get("", response_model=list[OwedItemRead])
def list_owed_items(
    status: str | None = Query(default=None),
    person: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: OwedService = Depends(get_owed_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.list_owed_items(
        current_user=current_user,
        status=status,
        person=person,
        limit=limit,
        offset=offset,
    )


@router.get("/export")
def export_owed_items(
    status: str | None = Query(default=None),
    person: str | None = Query(default=None),
    limit: int = Query(default=10000, ge=1, le=50000),
    offset: int = Query(default=0, ge=0),
    service: OwedService = Depends(get_owed_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    owed_items = service.list_owed_items(
        current_user=current_user,
        status=status,
        person=person,
        limit=limit,
        offset=offset,
    )

    csv_content = build_owed_items_csv(owed_items)

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="owed-items-export.csv"',
        },
    )



@router.post(
    "/payments",
    response_model=OwedPaymentRead,
    status_code=status.HTTP_201_CREATED,
)
def record_owed_payment(
    payment_data: OwedPaymentCreate,
    service: OwedService = Depends(get_owed_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.record_payment(payment_data, current_user)


@router.get("/payments", response_model=list[OwedPaymentRead])
def list_owed_payments(
    person: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: OwedService = Depends(get_owed_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.list_payments(
        current_user=current_user,
        person=person,
        limit=limit,
        offset=offset,
    )


@router.get("/payments/{payment_id}", response_model=OwedPaymentRead)
def get_owed_payment(
    payment_id: int,
    service: OwedService = Depends(get_owed_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_payment(payment_id, current_user)


@router.get("/{owed_item_id}", response_model=OwedItemRead)
def get_owed_item(
    owed_item_id: int,
    service: OwedService = Depends(get_owed_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_owed_item(owed_item_id, current_user)


@router.patch("/{owed_item_id}", response_model=OwedItemRead)
def update_owed_item(
    owed_item_id: int,
    owed_data: OwedItemUpdate,
    service: OwedService = Depends(get_owed_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.update_owed_item(owed_item_id, owed_data, current_user)


@router.delete("/{owed_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_owed_item(
    owed_item_id: int,
    service: OwedService = Depends(get_owed_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    service.delete_owed_item(owed_item_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
