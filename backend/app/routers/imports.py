from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser, get_current_user
from app.database import get_db
from app.repositories.category_rule_repository import CategoryRuleRepository
from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.repositories.owed_repository import OwedRepository
from app.repositories.transaction_repository import TransactionRepository
from app.repositories.wealth_repository import WealthRepository
from app.schemas.fx_match import FxMatchPreviewResponse
from app.schemas.import_batch import ImportBatchRead
from app.schemas.import_preview import ImportPreviewResponse
from app.schemas.transaction import TransactionRead
from app.services.category_rule_service import CategoryRuleService
from app.services.fx_match_service import FxMatchService
from app.services.import_service import ImportService


router = APIRouter(prefix="/api/import", tags=["import"])


def get_import_service(db: Session = Depends(get_db)) -> ImportService:
    transaction_repository = TransactionRepository(db)
    import_batch_repository = ImportBatchRepository(db)
    wealth_repository = WealthRepository(db)
    investment_event_repository = InvestmentEventRepository(db)
    owed_repository = OwedRepository(db)
    category_rule_repository = CategoryRuleRepository(db)
    category_rule_service = CategoryRuleService(
        category_rule_repository=category_rule_repository,
        transaction_repository=transaction_repository,
    )

    return ImportService(
        transaction_repository=transaction_repository,
        import_batch_repository=import_batch_repository,
        wealth_repository=wealth_repository,
        category_rule_service=category_rule_service,
        investment_event_repository=investment_event_repository,
        owed_repository=owed_repository,
    )


def get_fx_match_service(db: Session = Depends(get_db)) -> FxMatchService:
    transaction_repository = TransactionRepository(db)
    import_batch_repository = ImportBatchRepository(db)
    wealth_repository = WealthRepository(db)
    investment_event_repository = InvestmentEventRepository(db)
    category_rule_repository = CategoryRuleRepository(db)
    category_rule_service = CategoryRuleService(
        category_rule_repository=category_rule_repository,
        transaction_repository=transaction_repository,
    )
    import_service = ImportService(
        transaction_repository=transaction_repository,
        import_batch_repository=import_batch_repository,
        wealth_repository=wealth_repository,
        category_rule_service=category_rule_service,
        investment_event_repository=investment_event_repository,
        owed_repository=owed_repository,
    )

    return FxMatchService(
        transaction_repository=transaction_repository,
        import_service=import_service,
    )


@router.get("/batches", response_model=list[ImportBatchRead])
def list_import_batches(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: ImportService = Depends(get_import_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.list_import_batches(
        limit=limit,
        offset=offset,
        current_user=current_user,
    )


@router.get("/batches/{batch_id}", response_model=ImportBatchRead)
def get_import_batch(
    batch_id: int,
    service: ImportService = Depends(get_import_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_import_batch(batch_id, current_user)


@router.get("/batches/{batch_id}/transactions", response_model=list[TransactionRead])
def list_import_batch_transactions(
    batch_id: int,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: ImportService = Depends(get_import_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.list_import_batch_transactions(
        import_batch_id=batch_id,
        limit=limit,
        offset=offset,
        current_user=current_user,
    )


@router.delete("/batches/{batch_id}")
def delete_import_batch(
    batch_id: int,
    service: ImportService = Depends(get_import_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.delete_import_batch(batch_id, current_user)


@router.post("/preview", response_model=ImportPreviewResponse)
async def preview_import(
    source: str = Form(...),
    file: UploadFile = File(...),
    service: ImportService = Depends(get_import_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    file_content = await file.read()
    filename = file.filename or "uploaded"

    return service.preview_import_from_file(
        source=source,
        file_content=file_content,
        filename=filename,
        current_user=current_user,
    )


@router.post("/commit")
async def commit_import(
    source: str = Form(...),
    file: UploadFile = File(...),
    service: ImportService = Depends(get_import_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    file_content = await file.read()
    filename = file.filename or "uploaded"

    return service.commit_import_from_file(
        source=source,
        file_content=file_content,
        filename=filename,
        current_user=current_user,
    )

@router.post("/fx-matches/preview", response_model=FxMatchPreviewResponse)
async def preview_fx_matches(
    source: str = Form(...),
    file: UploadFile = File(...),
    service: FxMatchService = Depends(get_fx_match_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    file_content = await file.read()
    filename = file.filename or "uploaded"

    return service.preview_matches_from_file(
        source=source,
        file_content=file_content,
        filename=filename,
        current_user=current_user,
    )

