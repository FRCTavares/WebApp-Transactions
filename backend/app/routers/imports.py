from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.category_rule_repository import CategoryRuleRepository
from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.import_batch import ImportBatchRead
from app.schemas.import_preview import ImportPreviewResponse
from app.schemas.transaction import TransactionRead
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


@router.get("/batches", response_model=list[ImportBatchRead])
def list_import_batches(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: ImportService = Depends(get_import_service),
):
    return service.list_import_batches(
        limit=limit,
        offset=offset,
    )


@router.get("/batches/{batch_id}", response_model=ImportBatchRead)
def get_import_batch(
    batch_id: int,
    service: ImportService = Depends(get_import_service),
):
    return service.get_import_batch(batch_id)


@router.get("/batches/{batch_id}/transactions", response_model=list[TransactionRead])
def list_import_batch_transactions(
    batch_id: int,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: ImportService = Depends(get_import_service),
):
    return service.list_import_batch_transactions(
        import_batch_id=batch_id,
        limit=limit,
        offset=offset,
    )


@router.delete("/batches/{batch_id}")
def delete_import_batch(
    batch_id: int,
    service: ImportService = Depends(get_import_service),
):
    return service.delete_import_batch(batch_id)


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
