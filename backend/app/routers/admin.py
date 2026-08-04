from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.current_user import (
    CurrentUser,
    get_current_user,
    get_privileged_user,
)
from app.database import get_db
from app.repositories.month_reset_repository import MonthResetRepository
from app.repositories.pending_signup_repository import PendingSignupRepository
from app.schemas.admin_reset import MonthResetRequest, MonthResetResponse
from app.schemas.pending_signup import PendingSignupRead
from app.services.admin_reset_service import AdminResetService
from app.services.pending_signup_service import PendingSignupService


router = APIRouter(prefix="/api/admin", tags=["admin"])


def get_admin_reset_service(db: Session = Depends(get_db)) -> AdminResetService:
    return AdminResetService(repository=MonthResetRepository(db))


def get_pending_signup_service(
    db: Session = Depends(get_db),
) -> PendingSignupService:
    return PendingSignupService(repository=PendingSignupRepository(db))


@router.post("/reset-month", response_model=MonthResetResponse)
def reset_month(
    request_data: MonthResetRequest,
    service: AdminResetService = Depends(get_admin_reset_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.reset_month(request_data, current_user)


@router.get("/pending-signups", response_model=list[PendingSignupRead])
def list_pending_signups(
    service: PendingSignupService = Depends(get_pending_signup_service),
    current_user: CurrentUser = Depends(get_privileged_user),
):
    return service.list_pending()


@router.post("/pending-signups/{pending_signup_id}/approve", response_model=PendingSignupRead)
def approve_pending_signup(
    pending_signup_id: int,
    service: PendingSignupService = Depends(get_pending_signup_service),
    current_user: CurrentUser = Depends(get_privileged_user),
):
    return service.approve(pending_signup_id, decided_by=current_user.email or current_user.id)


@router.post("/pending-signups/{pending_signup_id}/deny", response_model=PendingSignupRead)
def deny_pending_signup(
    pending_signup_id: int,
    service: PendingSignupService = Depends(get_pending_signup_service),
    current_user: CurrentUser = Depends(get_privileged_user),
):
    return service.deny(pending_signup_id, decided_by=current_user.email or current_user.id)
