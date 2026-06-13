from datetime import date

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models.market_price_history import MarketPriceHistory
from app.schemas.market_price_history import MarketPriceHistoryCreate


class MarketPriceHistoryRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_or_update(self, price_data: MarketPriceHistoryCreate) -> MarketPriceHistory:
        existing_price = self.get_existing(
            ticker=price_data.ticker,
            isin=price_data.isin,
            price_date=price_data.price_date,
            source=price_data.source,
        )

        data = price_data.model_dump()

        if existing_price is None:
            market_price = MarketPriceHistory(**data)
            self.db.add(market_price)
            self.db.commit()
            self.db.refresh(market_price)
            return market_price

        for field, value in data.items():
            if value is not None:
                setattr(existing_price, field, value)

        self.db.add(existing_price)
        self.db.commit()
        self.db.refresh(existing_price)

        return existing_price

    def bulk_create_or_update(
        self,
        prices: list[MarketPriceHistoryCreate],
    ) -> list[MarketPriceHistory]:
        stored_prices: list[MarketPriceHistory] = []

        for price_data in prices:
            stored_prices.append(self.create_or_update(price_data))

        return stored_prices

    def get_existing(
        self,
        ticker: str | None,
        isin: str | None,
        price_date: date,
        source: str,
    ) -> MarketPriceHistory | None:
        identity_filters = []

        if ticker:
            identity_filters.append(MarketPriceHistory.ticker == ticker)

        if isin:
            identity_filters.append(MarketPriceHistory.isin == isin)

        if not identity_filters:
            return None

        statement = (
            select(MarketPriceHistory)
            .where(
                and_(
                    or_(*identity_filters),
                    MarketPriceHistory.price_date == price_date,
                    MarketPriceHistory.source == source,
                )
            )
            .limit(1)
        )

        return self.db.scalar(statement)

    def list_history(
        self,
        ticker: str | None = None,
        isin: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 500,
    ) -> list[MarketPriceHistory]:
        filters = []

        if ticker:
            filters.append(MarketPriceHistory.ticker == ticker)

        if isin:
            filters.append(MarketPriceHistory.isin == isin)

        if date_from:
            filters.append(MarketPriceHistory.price_date >= date_from)

        if date_to:
            filters.append(MarketPriceHistory.price_date <= date_to)

        statement = (
            select(MarketPriceHistory)
            .where(*filters)
            .order_by(MarketPriceHistory.price_date.desc(), MarketPriceHistory.id.desc())
            .limit(limit)
        )

        return list(self.db.scalars(statement).all())
