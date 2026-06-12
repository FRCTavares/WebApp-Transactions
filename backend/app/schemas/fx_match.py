from datetime import date as DateType
from decimal import Decimal

from pydantic import BaseModel


class FxMatchCandidate(BaseModel):
    transaction_id: int
    date: DateType
    description: str
    raw_description: str
    amount: Decimal
    currency: str
    source: str
    account: str | None = None
    cashflow_type: str
    date_distance_days: int
    score: Decimal


class PendingFxDepositMatch(BaseModel):
    row_number: int
    date: DateType
    description: str
    raw_description: str
    amount: Decimal
    currency: str
    original_amount: Decimal | None = None
    original_currency: str | None = None
    candidates: list[FxMatchCandidate]


class FxMatchPreviewResponse(BaseModel):
    source: str
    pending_deposits: list[PendingFxDepositMatch]
