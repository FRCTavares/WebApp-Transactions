from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Protocol


class MarketDataProviderError(Exception):
    pass


@dataclass(frozen=True)
class MarketDataLatestPrice:
    price: Decimal
    currency: str
    fetched_at: datetime


@dataclass(frozen=True)
class MarketDataHistoryPoint:
    price_date: date
    close_price: Decimal
    currency: str


class MarketDataProvider(Protocol):
    def get_latest_price(self, symbol: str) -> MarketDataLatestPrice:
        raise NotImplementedError

    def get_history(
        self,
        symbol: str,
        date_from: date,
        date_to: date,
    ) -> list[MarketDataHistoryPoint]:
        raise NotImplementedError
