from datetime import date as DateType
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from app.schemas.owed_item import (
    OwedItemCreate,
    OwedPaymentAllocationCreate,
    OwedPaymentCreate,
    PaymentMethod,
)
from app.schemas.transaction import TransactionCreate, TransactionRead


class TransactionCreateWithOwedCommand(BaseModel):
    transaction: TransactionCreate
    owed_items: list[OwedItemCreate] = Field(default_factory=list)
    owed_payment: OwedPaymentCreate | None = None

    @model_validator(mode="after")
    def validate_directional_workflow(self):
        if self.owed_items and self.owed_payment is not None:
            raise ValueError(
                "A transaction command cannot create owed items and an owed payment together"
            )

        if self.owed_items and self.transaction.direction != "out":
            raise ValueError(
                "Owed items can only be created with a money out transaction"
            )

        if self.owed_payment is not None and self.transaction.direction != "in":
            raise ValueError(
                "An owed payment can only be created with a money in transaction"
            )

        return self

class ExistingTransactionPaymentCommand(BaseModel):
    linked_transaction_id: int
    payment_date: DateType
    amount: Decimal = Field(gt=0)
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    method: PaymentMethod = "bank_transfer"
    notes: str | None = None
    unallocated_category: str | None = Field(default=None, max_length=100)
    unallocated_notes: str | None = None
    extra_allocations: list[OwedPaymentAllocationCreate] = Field(
        default_factory=list
    )


class ExistingTransactionOwedRowCommand(BaseModel):
    person: str = Field(min_length=1, max_length=100)
    amount: Decimal = Field(gt=0)
    payment: ExistingTransactionPaymentCommand | None = None


class ExistingTransactionOwedSplitCommand(BaseModel):
    rows: list[ExistingTransactionOwedRowCommand] = Field(min_length=1)


class ExistingTransactionOwedSplitRead(BaseModel):
    transaction: TransactionRead
    owed_items_created: int
    payments_created: int
