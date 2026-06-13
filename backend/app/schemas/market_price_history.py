from datetime import date as DateType
from datetime import datetime as DateTimeType
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class MarketPriceHistoryCreate(BaseModel):
    ticker: str | None = Field(default=None, max_length=50)
    isin: str | None = Field(default=None, max_length=50)
    price_date: DateType
    close_price: Decimal = Field(gt=0)
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    source: str = Field(default="yfinance", min_length=1, max_length=50)
    fetched_at: DateTimeType | None = None

    @model_validator(mode="after")
    def require_ticker_or_isin(self):
        if not self.ticker and not self.isin:
            raise ValueError("ticker or isin is required")

        return self


class MarketPriceHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticker: str | None = None
    isin: str | None = None
    price_date: DateType
    close_price: Decimal
    currency: str
    source: str
    fetched_at: DateTimeType
    created_at: DateTimeType
    updated_at: DateTimeType


class MarketPriceFetchLatestRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=50)
    ticker: str | None = Field(default=None, max_length=50)
    isin: str | None = Field(default=None, max_length=50)
    currency: str | None = Field(default=None, min_length=3, max_length=3)


class MarketPriceFetchHistoryRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=50)
    ticker: str | None = Field(default=None, max_length=50)
    isin: str | None = Field(default=None, max_length=50)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    date_from: DateType
    date_to: DateType

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.date_to < self.date_from:
            raise ValueError("date_to must be after or equal to date_from")

        return self
