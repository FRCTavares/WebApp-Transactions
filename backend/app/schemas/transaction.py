from datetime import date as DateType
from datetime import datetime as DateTimeType
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


Direction = Literal["in", "out"]
CashflowType = Literal[
    "income",
    "expense",
    "internal_transfer",
    "investment",
    "reimbursement",
    "reimbursed_expense",
]


def default_cashflow_type(direction: Direction) -> CashflowType:
    if direction == "in":
        return "income"

    return "expense"


class TransactionBase(BaseModel):
    date: DateType
    description: str = Field(min_length=1, max_length=255)
    raw_description: str = Field(min_length=1)
    amount: Decimal = Field(gt=0)
    original_amount: Decimal | None = Field(default=None, gt=0)
    original_currency: str | None = Field(default=None, min_length=3, max_length=3)
    fx_rate_to_eur: Decimal | None = Field(default=None, gt=0)
    fx_rate_source: str | None = None
    direction: Direction
    cashflow_type: CashflowType | None = None
    source: str = "manual"
    account: str | None = None
    category: str | None = None
    subcategory: str | None = None
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    merchant: str | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def set_default_cashflow_type(self):
        if self.cashflow_type is None:
            self.cashflow_type = default_cashflow_type(self.direction)

        return self


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    date: DateType | None = None
    description: str | None = Field(default=None, min_length=1, max_length=255)
    raw_description: str | None = Field(default=None, min_length=1)
    amount: Decimal | None = Field(default=None, gt=0)
    original_amount: Decimal | None = Field(default=None, gt=0)
    original_currency: str | None = Field(default=None, min_length=3, max_length=3)
    fx_rate_to_eur: Decimal | None = Field(default=None, gt=0)
    fx_rate_source: str | None = None
    direction: Direction | None = None
    cashflow_type: CashflowType | None = None
    source: str | None = None
    account: str | None = None
    category: str | None = None
    subcategory: str | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    merchant: str | None = None
    notes: str | None = None


class TransactionRead(TransactionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    import_batch_id: int | None = None
    external_id: str | None = None
    dedupe_hash: str | None = None
    created_at: DateTimeType
    updated_at: DateTimeType
