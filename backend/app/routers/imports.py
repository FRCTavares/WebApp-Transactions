from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.category_rule_repository import CategoryRuleRepository
from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.import_preview import ImportPreviewResponse
from app.services.category_rule_service import CategoryRuleService
from app.services.import_service import ImportService


router = APIRouter(prefix="/api/import", tags=["import"])


def get_import_service(db: Session = Depends(get_db)) -> ImportService:
    transaction_repository = TransactionRepository(db)
    import_batch_repository = ImportBatchRepository(db)
    category_rule_repository = CategoryRuleRepository(db)
    category_rule_service = CategoryRuleService(
        category_rule_repository=category_rule_repository,
        transaction_repository=transaction_repository,
    )

    return ImportService(
        transaction_repository=transaction_repository,
        import_batch_repository=import_batch_repository,
        category_rule_service=category_rule_service,
    )


@router.post("/preview", response_model=ImportPreviewResponse)
async def preview_import(
    source: str = Form(...),
    file: UploadFile = File(...),
    service: ImportService = Depends(get_import_service),
):
    file_content = await file.read()
    filename = file.filename or "uploaded"

    return service.preview_import_from_file(
        source=source,
        file_content=file_content,
        filename=filename,
    )


@router.post("/commit")
async def commit_import(
    source: str = Form(...),
    file: UploadFile = File(...),
    service: ImportService = Depends(get_import_service),
):
    file_content = await file.read()
    filename = file.filename or "uploaded"

    return service.commit_import_from_file(
        source=source,
        file_content=file_content,
        filename=filename,
    )
