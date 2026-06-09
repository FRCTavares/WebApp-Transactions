from datetime import date as DateType
from datetime import datetime as DateTimeType
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


Direction = Literal["in", "out"]


class TransactionBase(BaseModel):
    date: DateType
    description: str = Field(min_length=1, max_length=255)
    raw_description: str = Field(min_length=1)
    amount: Decimal = Field(gt=0)
    direction: Direction
    source: str = "manual"
    account: str | None = None
    category: str | None = None
    subcategory: str | None = None
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    merchant: str | None = None
    notes: str | None = None


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    date: DateType | None = None
    description: str | None = Field(default=None, min_length=1, max_length=255)
    raw_description: str | None = Field(default=None, min_length=1)
    amount: Decimal | None = Field(default=None, gt=0)
    direction: Direction | None = None
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
