from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.legacy_excel_import import LegacyExcelPreviewResponse
from app.services.legacy_excel_import_service import LegacyExcelImportService


router = APIRouter(
    prefix="/api/legacy-excel-import",
    tags=["legacy-excel-import"],
)


def get_legacy_excel_import_service(
    db: Session = Depends(get_db),
) -> LegacyExcelImportService:
    transaction_repository = TransactionRepository(db)

    return LegacyExcelImportService(
        transaction_repository=transaction_repository,
    )


@router.post("/preview", response_model=LegacyExcelPreviewResponse)
async def preview_legacy_excel_import(
    file: UploadFile = File(...),
    service: LegacyExcelImportService = Depends(get_legacy_excel_import_service),
):
    file_content = await file.read()
    filename = file.filename or "legacy_finance.xlsx"

    return service.preview_import_from_file(
        file_content=file_content,
        filename=filename,
    )
