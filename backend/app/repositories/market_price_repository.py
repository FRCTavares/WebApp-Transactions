from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.market_price import MarketPrice
from app.schemas.market_price import MarketPriceCreate, MarketPriceUpdate


class MarketPriceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_or_update_latest(self, price_data: MarketPriceCreate) -> MarketPrice:
        existing_price = self.get_latest_by_ticker_or_isin(
            ticker=price_data.ticker,
            isin=price_data.isin,
        )

        data = price_data.model_dump()

        if existing_price is None:
            market_price = MarketPrice(**data)
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

    def get_latest_by_ticker_or_isin(
        self,
        ticker: str | None = None,
        isin: str | None = None,
    ) -> MarketPrice | None:
        filters = []

        if ticker:
            filters.append(MarketPrice.ticker == ticker)

        if isin:
            filters.append(MarketPrice.isin == isin)

        if not filters:
            return None

        statement = (
            select(MarketPrice)
            .where(or_(*filters))
            .order_by(MarketPrice.fetched_at.desc(), MarketPrice.id.desc())
            .limit(1)
        )

        return self.db.scalar(statement)

    def list_latest(self) -> list[MarketPrice]:
        statement = select(MarketPrice).order_by(
            MarketPrice.ticker.asc(),
            MarketPrice.isin.asc(),
            MarketPrice.fetched_at.desc(),
            MarketPrice.id.desc(),
        )

        prices = list(self.db.scalars(statement).all())
        latest_by_key: dict[tuple[str | None, str | None], MarketPrice] = {}

        for price in prices:
            key = (price.ticker, price.isin)

            if key not in latest_by_key:
                latest_by_key[key] = price

        return list(latest_by_key.values())


    def get_by_id(self, price_id: int) -> MarketPrice | None:
        return self.db.get(MarketPrice, price_id)

    def update(self, market_price: MarketPrice, price_data: MarketPriceUpdate) -> MarketPrice:
        data = price_data.model_dump(exclude_unset=True)

        for field, value in data.items():
            if value is not None:
                setattr(market_price, field, value)

        self.db.add(market_price)
        self.db.commit()
        self.db.refresh(market_price)

        return market_price

    def delete(self, market_price: MarketPrice) -> None:
        self.db.delete(market_price)
        self.db.commit()
