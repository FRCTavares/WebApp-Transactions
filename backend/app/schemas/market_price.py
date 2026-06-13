from datetime import datetime as DateTimeType
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class MarketPriceCreate(BaseModel):
    ticker: str | None = Field(default=None, max_length=50)
    isin: str | None = Field(default=None, max_length=50)
    price: Decimal = Field(gt=0)
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    source: str = Field(default="manual", min_length=1, max_length=50)
    fetched_at: DateTimeType | None = None

    @model_validator(mode="after")
    def require_ticker_or_isin(self):
        if not self.ticker and not self.isin:
            raise ValueError("ticker or isin is required")

        return self


class MarketPriceUpdate(BaseModel):
    ticker: str | None = Field(default=None, max_length=50)
    isin: str | None = Field(default=None, max_length=50)
    price: Decimal | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    source: str | None = Field(default=None, min_length=1, max_length=50)
    fetched_at: DateTimeType | None = None


class MarketPriceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticker: str | None = None
    isin: str | None = None
    price: Decimal
    currency: str
    source: str
    fetched_at: DateTimeType
    created_at: DateTimeType
    updated_at: DateTimeType
