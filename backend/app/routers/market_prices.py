from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.market_price_repository import MarketPriceRepository
from app.schemas.market_price import MarketPriceCreate, MarketPriceRead, MarketPriceUpdate
from app.services.market_price_service import MarketPriceService


router = APIRouter(prefix="/api/market-prices", tags=["market-prices"])


def get_market_price_service(
    db: Session = Depends(get_db),
) -> MarketPriceService:
    repository = MarketPriceRepository(db)
    return MarketPriceService(repository)


@router.get("", response_model=list[MarketPriceRead])
def list_market_prices(
    service: MarketPriceService = Depends(get_market_price_service),
):
    return service.list_latest()


@router.get("/latest", response_model=MarketPriceRead)
def get_latest_market_price(
    ticker: str | None = Query(default=None),
    isin: str | None = Query(default=None),
    service: MarketPriceService = Depends(get_market_price_service),
):
    return service.get_latest(
        ticker=ticker,
        isin=isin,
    )


@router.post(
    "",
    response_model=MarketPriceRead,
    status_code=status.HTTP_201_CREATED,
)
def create_or_update_market_price(
    price_data: MarketPriceCreate,
    service: MarketPriceService = Depends(get_market_price_service),
):
    return service.create_or_update_latest(price_data)



@router.patch("/{price_id}", response_model=MarketPriceRead)
def update_market_price(
    price_id: int,
    price_data: MarketPriceUpdate,
    service: MarketPriceService = Depends(get_market_price_service),
):
    return service.update(price_id, price_data)


@router.delete("/{price_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_market_price(
    price_id: int,
    service: MarketPriceService = Depends(get_market_price_service),
):
    service.delete(price_id)
