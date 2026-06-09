from datetime import date as DateType
from decimal import Decimal

from pydantic import BaseModel


class ImportPreviewTransaction(BaseModel):
    row_number: int
    date: DateType
    raw_description: str
    description: str
    amount: Decimal
    direction: str
    source: str
    account: str | None = None
    currency: str
    external_id: str | None = None
    notes: str | None = None
    dedupe_hash: str
    is_duplicate: bool = False
    category: str | None = None


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
    invalid_rows: list[ImportInvalidRow]
