from datetime import date as DateType, datetime
from decimal import Decimal

from pydantic import BaseModel


class ImportPreviewTransaction(BaseModel):
    row_number: int
    date: DateType
    raw_description: str
    description: str
    amount: Decimal
    original_amount: Decimal | None = None
    original_currency: str | None = None
    fx_rate_to_eur: Decimal | None = None
    fx_rate_source: str | None = None
    direction: str
    cashflow_type: str
    source: str
    account: str | None = None
    currency: str
    external_id: str | None = None
    notes: str | None = None
    dedupe_hash: str
    is_duplicate: bool = False
    category: str | None = None


class ImportPreviewInvestmentEvent(BaseModel):
    row_number: int
    date: DateType
    source: str
    account: str | None = None
    event_type: str
    description: str
    raw_description: str
    amount: Decimal
    currency: str
    instrument_name: str | None = None
    ticker: str | None = None
    isin: str | None = None
    quantity: Decimal | None = None
    price: Decimal | None = None
    fees: Decimal | None = None
    taxes: Decimal | None = None
    original_amount: Decimal | None = None
    original_currency: str | None = None
    fx_rate_to_eur: Decimal | None = None
    fx_rate_source: str | None = None
    transaction_id: int | None = None
    funding_source: str | None = None
    funding_match_status: str | None = None
    matched_transaction_id: int | None = None
    external_id: str | None = None
    notes: str | None = None
    dedupe_hash: str
    is_duplicate: bool = False


class ImportInvalidRow(BaseModel):
    row_number: int
    error: str


class ImportPreviewResponse(BaseModel):
    source: str
    rows_total: int
    rows_valid: int
    rows_duplicates: int
    rows_invalid: int
    transactions: list[ImportPreviewTransaction]
    investment_events: list[ImportPreviewInvestmentEvent] = []
    invalid_rows: list[ImportInvalidRow]
    preview_id: str | None = None
    expires_at: datetime | None = None
