from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser, get_current_user
from app.database import get_db
from app.repositories.month_reset_repository import MonthResetRepository
from app.schemas.admin_reset import MonthResetRequest, MonthResetResponse
from app.services.admin_reset_service import AdminResetService


router = APIRouter(prefix="/api/admin", tags=["admin"])


def get_admin_reset_service(db: Session = Depends(get_db)) -> AdminResetService:
    return AdminResetService(repository=MonthResetRepository(db))


@router.post("/reset-month", response_model=MonthResetResponse)
def reset_month(
    request_data: MonthResetRequest,
    service: AdminResetService = Depends(get_admin_reset_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.reset_month(request_data, current_user)
