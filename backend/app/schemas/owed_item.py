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
    source: str = "manual"
    import_batch_id: int | None = None
    external_id: str | None = None
    dedupe_hash: str | None = None


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
    source: str | None = None
    import_batch_id: int | None = None
    external_id: str | None = None
    dedupe_hash: str | None = None


class OwedItemRead(OwedItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount_remaining: Decimal
    created_at: DateTimeType
    updated_at: DateTimeType


PaymentMethod = Literal["cash", "bank_transfer", "mbway", "other"]


class OwedPaymentAllocationCreate(BaseModel):
    owed_item_id: int
    amount: Decimal = Field(gt=0)


class OwedPaymentAllocationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owed_payment_id: int
    owed_item_id: int
    amount: Decimal
    created_at: DateTimeType


class OwedPaymentCreate(BaseModel):
    person: str = Field(min_length=1, max_length=100)
    payment_date: DateType
    amount: Decimal = Field(gt=0)
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    method: PaymentMethod = "cash"
    notes: str | None = None
    linked_transaction_id: int | None = None
    unallocated_category: str | None = Field(default=None, max_length=100)
    unallocated_notes: str | None = None
    allocations: list[OwedPaymentAllocationCreate] = Field(default_factory=list)


class OwedPaymentRead(BaseModel):
    id: int
    person: str
    payment_date: DateType
    amount: Decimal
    currency: str
    method: PaymentMethod
    notes: str | None
    linked_transaction_id: int | None
    unallocated_category: str | None
    unallocated_notes: str | None
    allocated_amount: Decimal
    unallocated_amount: Decimal
    allocations: list[OwedPaymentAllocationRead]
    created_at: DateTimeType
    updated_at: DateTimeType
