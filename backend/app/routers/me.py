from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.current_user import (
    CurrentUser,
    get_authenticated_supabase_user,
    get_current_user,
)
from app.database import get_db
from app.repositories.account_deletion_repository import AccountDeletionRepository
from app.repositories.pending_signup_repository import PendingSignupRepository
from app.schemas.pending_signup import AccessStatusRead
from app.services.account_deletion_service import (
    AccountDeletionService,
    SupabaseAuthIdentityDeletionClient,
)
from app.services.pending_signup_service import PendingSignupService


router = APIRouter(prefix="/api", tags=["auth"])


def get_account_deletion_service(
    db: Session = Depends(get_db),
) -> AccountDeletionService:
    return AccountDeletionService(
        repository=AccountDeletionRepository(db),
        identity_client=SupabaseAuthIdentityDeletionClient(),
    )


def get_pending_signup_service(
    db: Session = Depends(get_db),
) -> PendingSignupService:
    return PendingSignupService(repository=PendingSignupRepository(db))


@router.get("/me/access-status", response_model=AccessStatusRead)
def read_access_status(
    service: PendingSignupService = Depends(get_pending_signup_service),
    current_user: CurrentUser = Depends(get_authenticated_supabase_user),
) -> AccessStatusRead:
    """Report whether the signed-in Google account can use the app.

    Unlike every other endpoint, this one accepts any validly-signed
    Supabase JWT - including an email that isn't on the allow-list yet -
    so a brand-new sign-up can be told they're pending approval instead of
    just getting an opaque 403 from every request.
    """

    status_value = service.get_or_create_status(
        user_id=current_user.id,
        email=current_user.email or "",
    )
    return AccessStatusRead(status=status_value)


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
