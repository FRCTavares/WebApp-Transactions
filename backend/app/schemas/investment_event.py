from datetime import date as DateType
from datetime import datetime as DateTimeType
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class InvestmentEventBase(BaseModel):
    date: DateType
    source: str = "manual"
    account: str | None = None

    event_type: str = Field(min_length=1, max_length=50)
    description: str = Field(min_length=1, max_length=255)
    raw_description: str = Field(min_length=1)

    instrument_name: str | None = None
    ticker: str | None = None
    isin: str | None = None

    quantity: Decimal | None = None
    price: Decimal | None = None
    fees: Decimal | None = None
    taxes: Decimal | None = None

    amount: Decimal = Field(gt=0)
    currency: str = Field(default="EUR", min_length=3, max_length=3)

    original_amount: Decimal | None = Field(default=None, gt=0)
    original_currency: str | None = Field(default=None, min_length=3, max_length=3)
    fx_rate_to_eur: Decimal | None = Field(default=None, gt=0)
    fx_rate_source: str | None = None

    transaction_id: int | None = None
    funding_source: str | None = None
    funding_match_status: str | None = None
    matched_transaction_id: int | None = None
    import_batch_id: int | None = None
    external_id: str | None = None
    dedupe_hash: str | None = None
    notes: str | None = None


class InvestmentEventCreate(InvestmentEventBase):
    pass


class InvestmentEventUpdate(BaseModel):
    date: DateType | None = None
    source: str | None = None
    account: str | None = None

    event_type: str | None = Field(default=None, min_length=1, max_length=50)
    description: str | None = Field(default=None, min_length=1, max_length=255)
    raw_description: str | None = Field(default=None, min_length=1)

    instrument_name: str | None = None
    ticker: str | None = None
    isin: str | None = None

    quantity: Decimal | None = None
    price: Decimal | None = None
    fees: Decimal | None = None
    taxes: Decimal | None = None

    amount: Decimal | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)

    original_amount: Decimal | None = Field(default=None, gt=0)
    original_currency: str | None = Field(default=None, min_length=3, max_length=3)
    fx_rate_to_eur: Decimal | None = Field(default=None, gt=0)
    fx_rate_source: str | None = None

    transaction_id: int | None = None
    funding_source: str | None = None
    funding_match_status: str | None = None
    matched_transaction_id: int | None = None
    import_batch_id: int | None = None
    external_id: str | None = None
    dedupe_hash: str | None = None
    notes: str | None = None


class InvestmentEventRead(InvestmentEventBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: DateTimeType
    updated_at: DateTimeType
