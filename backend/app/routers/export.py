from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser, get_current_user
from app.database import get_db
from app.repositories.export_repository import ExportRepository
from app.security.rate_limit import enforce_export_rate_limit
from app.services.export_service import ExportService


router = APIRouter(prefix="/api/export", tags=["export"])


def get_export_service(db: Session = Depends(get_db)) -> ExportService:
    repository = ExportRepository(db)
    return ExportService(repository)


@router.get(
    "/json",
    dependencies=[Depends(enforce_export_rate_limit)],
)
def export_current_user_json(
    service: ExportService = Depends(get_export_service),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return service.export_current_user(current_user)
