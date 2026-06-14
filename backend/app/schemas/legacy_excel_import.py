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
    dedupe_hash: str
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



class LegacyExcelCommitResponse(BaseModel):
    import_batch_id: int
    source: str
    filename: str
    rows_total: int
    rows_inserted: int
    rows_skipped: int
    transactions_inserted: int
    owed_items_inserted: int
    duplicate_transactions_skipped: int
    duplicate_owed_items_skipped: int
    invalid_rows_skipped: int
    status: str


class LegacyExcelPreviewWealthSnapshot(BaseModel):
    sheet_name: str
    row_number: int
    column_number: int
    snapshot_date: DateType
    account_name: str
    account_type: str
    balance: Decimal
    currency: str
    balance_eur: Decimal
    fx_rate_to_eur: Decimal
    interest_earned: Decimal
    notes: str | None = None
    external_id: str
    dedupe_hash: str
    is_duplicate: bool = False


class LegacyExcelWealthPreviewSummary(BaseModel):
    snapshot_count: int
    duplicate_snapshot_count: int
    account_count: int
    latest_snapshot_date: DateType | None = None


class LegacyExcelWealthPreviewResponse(BaseModel):
    source: str
    filename: str
    rows_total: int
    rows_valid: int
    rows_duplicates: int
    rows_invalid: int
    summary: LegacyExcelWealthPreviewSummary
    snapshots: list[LegacyExcelPreviewWealthSnapshot]


class LegacyExcelWealthCommitResponse(BaseModel):
    import_batch_id: int
    source: str
    filename: str
    rows_total: int
    rows_inserted: int
    rows_skipped: int
    accounts_created: int
    snapshots_inserted: int
    duplicate_snapshots_skipped: int
    status: str
