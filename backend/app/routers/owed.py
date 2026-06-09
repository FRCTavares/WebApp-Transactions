from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.owed_repository import OwedRepository
from app.schemas.owed_item import OwedItemCreate, OwedItemRead, OwedItemUpdate
from app.services.owed_service import OwedService


router = APIRouter(prefix="/api/owed", tags=["owed"])


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
):
    return service.create_owed_item(owed_data)


@router.get("", response_model=list[OwedItemRead])
def list_owed_items(
    status: str | None = Query(default=None),
    person: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: OwedService = Depends(get_owed_service),
):
    return service.list_owed_items(
        status=status,
        person=person,
        limit=limit,
        offset=offset,
    )


@router.get("/{owed_item_id}", response_model=OwedItemRead)
def get_owed_item(
    owed_item_id: int,
    service: OwedService = Depends(get_owed_service),
):
    return service.get_owed_item(owed_item_id)


@router.patch("/{owed_item_id}", response_model=OwedItemRead)
def update_owed_item(
    owed_item_id: int,
    owed_data: OwedItemUpdate,
    service: OwedService = Depends(get_owed_service),
):
    return service.update_owed_item(owed_item_id, owed_data)


@router.delete("/{owed_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_owed_item(
    owed_item_id: int,
    service: OwedService = Depends(get_owed_service),
):
    service.delete_owed_item(owed_item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
