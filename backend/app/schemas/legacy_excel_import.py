from datetime import date as DateType
from decimal import Decimal

from pydantic import BaseModel


class LegacyExcelPreviewTransaction(BaseModel):
    row_number: int
    sheet_name: str
    date: DateType
    description: str
    raw_description: str
    amount: Decimal
    direction: str
    cashflow_type: str
    source: str
    account: str
    currency: str
    category: str | None = None
    external_id: str
    notes: str | None = None
    dedupe_hash: str
    is_duplicate: bool = False


class LegacyExcelPreviewOwedItem(BaseModel):
    row_number: int
    sheet_name: str
    person: str
    amount_total: Decimal
    amount_paid: Decimal
    amount_remaining: Decimal
    reason: str
    status: str
    due_date: DateType | None = None
    notes: str | None = None
    external_id: str
    is_duplicate: bool = False


class LegacyExcelPreviewInvalidRow(BaseModel):
    sheet_name: str
    row_number: int
    section: str
    error: str


class LegacyExcelPreviewSummary(BaseModel):
    transaction_count: int
    owed_item_count: int
    duplicate_transaction_count: int
    duplicate_owed_item_count: int
    invalid_row_count: int
    money_in_total: Decimal
    money_out_total: Decimal
    owed_open_total: Decimal
    owed_paid_total: Decimal


class LegacyExcelPreviewResponse(BaseModel):
    source: str
    filename: str
    rows_total: int
    rows_valid: int
    rows_duplicates: int
    rows_invalid: int
    summary: LegacyExcelPreviewSummary
    transactions: list[LegacyExcelPreviewTransaction]
    owed_items: list[LegacyExcelPreviewOwedItem]
    invalid_rows: list[LegacyExcelPreviewInvalidRow]
