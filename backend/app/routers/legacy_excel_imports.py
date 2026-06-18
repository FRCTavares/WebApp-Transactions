from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser, get_current_user
from app.database import get_db
from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.owed_repository import OwedRepository
from app.repositories.transaction_repository import TransactionRepository
from app.repositories.wealth_repository import WealthRepository
from app.schemas.legacy_excel_import import (
    LegacyExcelCommitResponse,
    LegacyExcelPreviewResponse,
    LegacyExcelWealthCommitResponse,
    LegacyExcelWealthPreviewResponse,
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
    wealth_repository = WealthRepository(db)

    return LegacyExcelImportService(
        transaction_repository=transaction_repository,
        owed_repository=owed_repository,
        import_batch_repository=import_batch_repository,
        wealth_repository=wealth_repository,
    )


@router.post("/preview", response_model=LegacyExcelPreviewResponse)
async def preview_legacy_excel_import(
    file: UploadFile = File(...),
    service: LegacyExcelImportService = Depends(get_legacy_excel_import_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    file_content = await file.read()
    filename = file.filename or "legacy_finance.xlsx"

    return service.preview_import_from_file(
        file_content=file_content,
        filename=filename,
        current_user=current_user,
    )



@router.post("/commit", response_model=LegacyExcelCommitResponse)
async def commit_legacy_excel_import(
    file: UploadFile = File(...),
    service: LegacyExcelImportService = Depends(get_legacy_excel_import_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    file_content = await file.read()
    filename = file.filename or "legacy_finance.xlsx"

    return service.commit_import_from_file(
        file_content=file_content,
        filename=filename,
        current_user=current_user,
    )


@router.post("/wealth-preview", response_model=LegacyExcelWealthPreviewResponse)
async def preview_legacy_excel_wealth_import(
    file: UploadFile = File(...),
    service: LegacyExcelImportService = Depends(get_legacy_excel_import_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    file_content = await file.read()
    filename = file.filename or "legacy_finance.xlsx"

    return service.preview_wealth_import_from_file(
        file_content=file_content,
        filename=filename,
        current_user=current_user,
    )


@router.post("/wealth-commit", response_model=LegacyExcelWealthCommitResponse)
async def commit_legacy_excel_wealth_import(
    file: UploadFile = File(...),
    service: LegacyExcelImportService = Depends(get_legacy_excel_import_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    file_content = await file.read()
    filename = file.filename or "legacy_finance.xlsx"

    return service.commit_wealth_import_from_file(
        file_content=file_content,
        filename=filename,
        current_user=current_user,
    )
