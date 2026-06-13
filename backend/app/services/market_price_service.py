from datetime import UTC, datetime

from fastapi import HTTPException, status

from app.models.market_price import MarketPrice
from app.repositories.market_price_repository import MarketPriceRepository
from app.schemas.market_price import MarketPriceCreate


class MarketPriceService:
    def __init__(self, repository: MarketPriceRepository) -> None:
        self.repository = repository

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
