from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.owed_repository import OwedRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.legacy_excel_import import (
    LegacyExcelCommitResponse,
    LegacyExcelPreviewResponse,
)
from app.services.legacy_excel_import_service import LegacyExcelImportService


router = APIRouter(
    prefix="/api/legacy-excel-import",
    tags=["legacy-excel-import"],
)


def get_legacy_excel_import_service(
    db: Session = Depends(get_db),
) -> LegacyExcelImportService:
    transaction_repository = TransactionRepository(db)
    owed_repository = OwedRepository(db)
    import_batch_repository = ImportBatchRepository(db)

    return LegacyExcelImportService(
        transaction_repository=transaction_repository,
        owed_repository=owed_repository,
        import_batch_repository=import_batch_repository,
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



@router.post("/commit", response_model=LegacyExcelCommitResponse)
async def commit_legacy_excel_import(
    file: UploadFile = File(...),
    service: LegacyExcelImportService = Depends(get_legacy_excel_import_service),
):
    file_content = await file.read()
    filename = file.filename or "legacy_finance.xlsx"

    return service.commit_import_from_file(
        file_content=file_content,
        filename=filename,
    )
