from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.auth.current_user import (
    CurrentUser,
    get_current_user,
    get_privileged_user,
)
from app.database import get_db
from app.repositories.market_price_history_repository import MarketPriceHistoryRepository
from app.repositories.market_price_repository import MarketPriceRepository
from app.schemas.market_price import MarketPriceCreate, MarketPriceRead, MarketPriceUpdate
from app.security.rate_limit import enforce_market_fetch_rate_limit
from app.schemas.market_price_history import (
    MarketPriceFetchHistoryRequest,
    MarketPriceFetchLatestRequest,
    MarketPriceHistoryRead,
)
from app.services.market_data.yfinance_provider import YFinanceMarketDataProvider
from app.services.market_price_service import MarketPriceService


router = APIRouter(prefix="/api/market-prices", tags=["market-prices"])


def get_market_data_provider() -> YFinanceMarketDataProvider:
    return YFinanceMarketDataProvider()


def get_market_price_service(
    db: Session = Depends(get_db),
    provider: YFinanceMarketDataProvider = Depends(get_market_data_provider),
) -> MarketPriceService:
    repository = MarketPriceRepository(db)
    history_repository = MarketPriceHistoryRepository(db)
    return MarketPriceService(
        repository=repository,
        history_repository=history_repository,
        provider=provider,
    )


@router.get("", response_model=list[MarketPriceRead])
def list_market_prices(
    service: MarketPriceService = Depends(get_market_price_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.list_latest()


@router.get("/latest", response_model=MarketPriceRead)
def get_latest_market_price(
    ticker: str | None = Query(default=None),
    isin: str | None = Query(default=None),
    service: MarketPriceService = Depends(get_market_price_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_latest(
        ticker=ticker,
        isin=isin,
    )


@router.get("/history", response_model=list[MarketPriceHistoryRead])
def list_market_price_history(
    ticker: str | None = Query(default=None),
    isin: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=5000),
    service: MarketPriceService = Depends(get_market_price_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.list_history(
        ticker=ticker,
        isin=isin,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
    )


@router.post(
    "/fetch/latest",
    response_model=MarketPriceRead,
    dependencies=[Depends(enforce_market_fetch_rate_limit)],
)
def fetch_latest_market_price(
    request: MarketPriceFetchLatestRequest,
    service: MarketPriceService = Depends(get_market_price_service),
    current_user: CurrentUser = Depends(get_privileged_user),
):
    return service.fetch_latest(request)


@router.post(
    "/fetch/history",
    response_model=list[MarketPriceHistoryRead],
    dependencies=[Depends(enforce_market_fetch_rate_limit)],
)
def fetch_market_price_history(
    request: MarketPriceFetchHistoryRequest,
    service: MarketPriceService = Depends(get_market_price_service),
    current_user: CurrentUser = Depends(get_privileged_user),
):
    return service.fetch_history(request)


@router.post(
    "",
    response_model=MarketPriceRead,
    status_code=status.HTTP_201_CREATED,
)
def create_or_update_market_price(
    price_data: MarketPriceCreate,
    service: MarketPriceService = Depends(get_market_price_service),
    current_user: CurrentUser = Depends(get_privileged_user),
):
    return service.create_or_update_latest(price_data)


@router.patch("/{price_id}", response_model=MarketPriceRead)
def update_market_price(
    price_id: int,
    price_data: MarketPriceUpdate,
    service: MarketPriceService = Depends(get_market_price_service),
    current_user: CurrentUser = Depends(get_privileged_user),
):
    return service.update(price_id, price_data)


@router.delete("/{price_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_market_price(
    price_id: int,
    service: MarketPriceService = Depends(get_market_price_service),
    current_user: CurrentUser = Depends(get_privileged_user),
):
    service.delete(price_id)
