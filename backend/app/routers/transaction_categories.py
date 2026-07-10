from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser, get_current_user
from app.database import get_db
from app.repositories.transaction_category_repository import (
    TransactionCategoryRepository,
)
from app.schemas.transaction_category import (
    TransactionCategoryCreate,
    TransactionCategoryRead,
    TransactionCategoryUpdate,
)
from app.services.transaction_category_service import (
    TransactionCategoryService,
)


router = APIRouter(
    prefix="/api/transaction-categories",
    tags=["transaction-categories"],
)


def get_transaction_category_service(
    db: Session = Depends(get_db),
) -> TransactionCategoryService:
    return TransactionCategoryService(
        TransactionCategoryRepository(db)
    )


@router.post(
    "",
    response_model=TransactionCategoryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_transaction_category(
    category_data: TransactionCategoryCreate,
    service: TransactionCategoryService = Depends(
        get_transaction_category_service
    ),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.create_category(
        category_data,
        current_user,
    )


@router.get(
    "",
    response_model=list[TransactionCategoryRead],
)
def list_transaction_categories(
    active_only: bool = Query(default=False),
    direction: str | None = Query(
        default=None,
        pattern="^(in|out)$",
    ),
    cashflow_type: str | None = Query(
        default=None,
        pattern="^(income|expense|transfer)$",
    ),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: TransactionCategoryService = Depends(
        get_transaction_category_service
    ),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.list_categories(
        active_only=active_only,
        direction=direction,
        cashflow_type=cashflow_type,
        limit=limit,
        offset=offset,
        current_user=current_user,
    )


@router.get(
    "/{category_id}",
    response_model=TransactionCategoryRead,
)
def get_transaction_category(
    category_id: int,
    service: TransactionCategoryService = Depends(
        get_transaction_category_service
    ),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_category(
        category_id,
        current_user,
    )


@router.patch(
    "/{category_id}",
    response_model=TransactionCategoryRead,
)
def update_transaction_category(
    category_id: int,
    category_data: TransactionCategoryUpdate,
    service: TransactionCategoryService = Depends(
        get_transaction_category_service
    ),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.update_category(
        category_id,
        category_data,
        current_user,
    )


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_transaction_category(
    category_id: int,
    service: TransactionCategoryService = Depends(
        get_transaction_category_service
    ),
    current_user: CurrentUser = Depends(get_current_user),
):
    service.delete_category(
        category_id,
        current_user,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
