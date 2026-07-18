from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser, get_current_user
from app.database import get_db
from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.import_preview_repository import ImportPreviewRepository
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.repositories.owed_repository import OwedRepository
from app.repositories.transaction_repository import TransactionRepository
from app.repositories.wealth_repository import WealthRepository
from app.schemas.fx_match import FxMatchPreviewResponse
from app.security.rate_limit import enforce_upload_rate_limit
from app.schemas.import_batch import ImportBatchDeleteResponse, ImportBatchRead
from app.schemas.import_preview import ImportPreviewResponse
from app.schemas.investment_event import InvestmentEventRead
from app.schemas.transaction import TransactionRead
from app.services.fx_match_service import FxMatchService
from app.services.import_fx_resolution_service import (
    ImportFxResolutionService,
)
from app.services.import_preview_binding_service import (
    ImportPreviewBindingService,
)
from app.services.import_service import ImportService
from app.services.market_data.yfinance_provider import (
    YFinanceMarketDataProvider,
)
from app.services.upload_validation import (
    get_standard_upload_policy,
    read_validated_upload,
)


router = APIRouter(prefix="/api/import", tags=["import"])


def get_import_market_data_provider() -> YFinanceMarketDataProvider:
    return YFinanceMarketDataProvider()


def get_import_service(
    db: Session = Depends(get_db),
    provider: YFinanceMarketDataProvider = Depends(
        get_import_market_data_provider
    ),
) -> ImportService:
    transaction_repository = TransactionRepository(db)
    import_batch_repository = ImportBatchRepository(db)
    wealth_repository = WealthRepository(db)
    investment_event_repository = InvestmentEventRepository(db)
    owed_repository = OwedRepository(db)
    preview_binding_service = ImportPreviewBindingService(
        ImportPreviewRepository(db)
    )
    return ImportService(
        transaction_repository=transaction_repository,
        import_batch_repository=import_batch_repository,
        wealth_repository=wealth_repository,
        investment_event_repository=investment_event_repository,
        owed_repository=owed_repository,
        preview_binding_service=preview_binding_service,
        fx_resolution_service=ImportFxResolutionService(provider),
    )


def get_fx_match_service(
    db: Session = Depends(get_db),
    provider: YFinanceMarketDataProvider = Depends(
        get_import_market_data_provider
    ),
) -> FxMatchService:
    transaction_repository = TransactionRepository(db)
    import_batch_repository = ImportBatchRepository(db)
    wealth_repository = WealthRepository(db)
    investment_event_repository = InvestmentEventRepository(db)
    owed_repository = OwedRepository(db)
    import_service = ImportService(
        transaction_repository=transaction_repository,
        import_batch_repository=import_batch_repository,
        wealth_repository=wealth_repository,
        investment_event_repository=investment_event_repository,
        owed_repository=owed_repository,
    )

    return FxMatchService(
        transaction_repository=transaction_repository,
        import_service=import_service,
        fx_resolution_service=ImportFxResolutionService(provider),
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
    return service.get_import_batch(batch_id, current_user=current_user)


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


@router.get(
    "/batches/{batch_id}/investment-events",
    response_model=list[InvestmentEventRead],
)
def list_import_batch_investment_events(
    batch_id: int,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: ImportService = Depends(get_import_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.list_import_batch_investment_events(
        import_batch_id=batch_id,
        limit=limit,
        offset=offset,
        current_user=current_user,
    )


@router.delete("/batches/{batch_id}", response_model=ImportBatchDeleteResponse)
def delete_import_batch(
    batch_id: int,
    service: ImportService = Depends(get_import_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.delete_import_batch(batch_id, current_user=current_user)


@router.post(
    "/preview",
    response_model=ImportPreviewResponse,
    dependencies=[Depends(enforce_upload_rate_limit)],
)
async def preview_import(
    source: str = Form(...),
    file: UploadFile = File(...),
    service: ImportService = Depends(get_import_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    upload = await read_validated_upload(
        file,
        policy=get_standard_upload_policy(source),
    )

    return service.preview_import_from_file(
        source=source,
        file_content=upload.content,
        filename=upload.filename,
        current_user=current_user,
    )


@router.post(
    "/commit",
    dependencies=[Depends(enforce_upload_rate_limit)],
)
async def commit_import(
    source: str = Form(...),
    preview_id: str = Form(...),
    file: UploadFile = File(...),
    service: ImportService = Depends(get_import_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    upload = await read_validated_upload(
        file,
        policy=get_standard_upload_policy(source),
    )

    return service.commit_import_from_file(
        source=source,
        preview_id=preview_id,
        file_content=upload.content,
        filename=upload.filename,
        current_user=current_user,
    )

@router.post(
    "/fx-matches/preview",
    response_model=FxMatchPreviewResponse,
    dependencies=[Depends(enforce_upload_rate_limit)],
)
async def preview_fx_matches(
    source: str = Form(...),
    file: UploadFile = File(...),
    service: FxMatchService = Depends(get_fx_match_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    upload = await read_validated_upload(
        file,
        policy=get_standard_upload_policy(source),
    )

    return service.preview_matches_from_file(
        source=source,
        file_content=upload.content,
        filename=upload.filename,
        current_user=current_user,
    )
