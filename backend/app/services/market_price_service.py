from datetime import UTC, date, datetime

from fastapi import HTTPException, status

from app.models.market_price import MarketPrice
from app.models.market_price_history import MarketPriceHistory
from app.repositories.market_price_history_repository import MarketPriceHistoryRepository
from app.repositories.market_price_repository import MarketPriceRepository
from app.schemas.market_price import MarketPriceCreate, MarketPriceUpdate
from app.schemas.market_price_history import (
    MarketPriceFetchHistoryRequest,
    MarketPriceFetchLatestRequest,
    MarketPriceHistoryCreate,
)
from app.services.market_data.base import MarketDataProvider, MarketDataProviderError


class MarketPriceService:
    def __init__(
        self,
        repository: MarketPriceRepository,
        history_repository: MarketPriceHistoryRepository | None = None,
        provider: MarketDataProvider | None = None,
    ) -> None:
        self.repository = repository
        self.history_repository = history_repository
        self.provider = provider

    def create_or_update_latest(self, price_data: MarketPriceCreate) -> MarketPrice:
        if price_data.fetched_at is None:
            price_data = price_data.model_copy(
                update={"fetched_at": datetime.now(UTC)}
            )

        return self.repository.create_or_update_latest(price_data)

    def get_latest(
        self,
        ticker: str | None = None,
        isin: str | None = None,
    ) -> MarketPrice:
        market_price = self.repository.get_latest_by_ticker_or_isin(
            ticker=ticker,
            isin=isin,
        )

        if market_price is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Market price not found",
            )

        return market_price

    def list_latest(self) -> list[MarketPrice]:
        return self.repository.list_latest()

    def fetch_latest(self, request: MarketPriceFetchLatestRequest) -> MarketPrice:
        if self.provider is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Market data provider is not configured",
            )

        ticker = request.ticker or request.symbol

        try:
            latest_price = self.provider.get_latest_price(request.symbol)
        except MarketDataProviderError as error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(error),
            ) from error

        price_data = MarketPriceCreate(
            ticker=ticker,
            isin=request.isin,
            price=latest_price.price,
            currency=(request.currency or latest_price.currency).upper(),
            source="yfinance",
            fetched_at=latest_price.fetched_at,
        )

        return self.repository.create_or_update_latest(price_data)

    def fetch_history(
        self,
        request: MarketPriceFetchHistoryRequest,
    ) -> list[MarketPriceHistory]:
        if self.provider is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Market data provider is not configured",
            )

        if self.history_repository is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Market price history repository is not configured",
            )

        ticker = request.ticker or request.symbol

        try:
            history_points = self.provider.get_history(
                symbol=request.symbol,
                date_from=request.date_from,
                date_to=request.date_to,
            )
        except MarketDataProviderError as error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(error),
            ) from error

        fetched_at = datetime.now(UTC)
        history_data = [
            MarketPriceHistoryCreate(
                ticker=ticker,
                isin=request.isin,
                price_date=point.price_date,
                close_price=point.close_price,
                currency=(request.currency or point.currency).upper(),
                source="yfinance",
                fetched_at=fetched_at,
            )
            for point in history_points
        ]

        return self.history_repository.bulk_create_or_update(history_data)

    def list_history(
        self,
        ticker: str | None = None,
        isin: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 500,
    ) -> list[MarketPriceHistory]:
        if self.history_repository is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Market price history repository is not configured",
            )

        return self.history_repository.list_history(
            ticker=ticker,
            isin=isin,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
        )

    def update(self, price_id: int, price_data: MarketPriceUpdate) -> MarketPrice:
        market_price = self.repository.get_by_id(price_id)

        if market_price is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Market price not found",
            )

        if price_data.fetched_at is None:
            price_data = price_data.model_copy(
                update={"fetched_at": datetime.now(UTC)}
            )

        return self.repository.update(market_price, price_data)

    def delete(self, price_id: int) -> None:
        market_price = self.repository.get_by_id(price_id)

        if market_price is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Market price not found",
            )

        self.repository.delete(market_price)
