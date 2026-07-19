from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser, get_current_user
from app.database import get_db
from app.repositories.account_deletion_repository import AccountDeletionRepository
from app.services.account_deletion_service import (
    AccountDeletionService,
    SupabaseAuthIdentityDeletionClient,
)


router = APIRouter(prefix="/api", tags=["auth"])


def get_account_deletion_service(
    db: Session = Depends(get_db),
) -> AccountDeletionService:
    return AccountDeletionService(
        repository=AccountDeletionRepository(db),
        identity_client=SupabaseAuthIdentityDeletionClient(),
    )


@router.get("/me")
def read_current_user(
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, str | None]:
    return {
        "user_id": current_user.id,
        "email": current_user.email,
    }


@router.delete("/me")
def delete_current_user_account(
    confirmation: str = Header(alias="X-Confirm-Account-Deletion"),
    service: AccountDeletionService = Depends(get_account_deletion_service),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, object]:
    expected_confirmation = current_user.email or current_user.id

    if confirmation.strip().lower() != expected_confirmation.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account deletion confirmation does not match",
        )

    return service.delete_current_user(current_user)
