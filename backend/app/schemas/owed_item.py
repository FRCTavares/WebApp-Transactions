from datetime import date as DateType
from datetime import datetime as DateTimeType
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


OwedStatus = Literal["open", "partially_paid", "paid", "cancelled"]


class OwedItemBase(BaseModel):
    person: str = Field(min_length=1, max_length=100)
    amount_total: Decimal = Field(gt=0)
    amount_paid: Decimal = Field(default=Decimal("0.00"), ge=0)
    reason: str = Field(min_length=1, max_length=255)
    status: OwedStatus = "open"
    due_date: DateType | None = None
    linked_transaction_id: int | None = None
    notes: str | None = None


class OwedItemCreate(OwedItemBase):
    pass


class OwedItemUpdate(BaseModel):
    person: str | None = Field(default=None, min_length=1, max_length=100)
    amount_total: Decimal | None = Field(default=None, gt=0)
    amount_paid: Decimal | None = Field(default=None, ge=0)
    reason: str | None = Field(default=None, min_length=1, max_length=255)
    status: OwedStatus | None = None
    due_date: DateType | None = None
    linked_transaction_id: int | None = None
    notes: str | None = None


class OwedItemRead(OwedItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount_remaining: Decimal
    created_at: DateTimeType
    updated_at: DateTimeType
