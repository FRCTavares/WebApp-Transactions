from datetime import date as DateType
from decimal import Decimal
from typing import Literal

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

TransactionLinkedOwedDeletionStrategy = Literal[
    "delete_with_owed",
    "preserve_owed",
]


class TransactionLinkedOwedItemRead(BaseModel):
    id: int
    person: str
    amount_total: Decimal
    amount_paid: Decimal
    amount_remaining: Decimal
    status: str
    allocation_count: int
    deleted: bool


class TransactionDeletionPreviewRead(BaseModel):
    transaction_id: int
    normal_delete_allowed: bool
    normal_delete_block_reason: str | None
    has_linked_owed: bool
    linked_owed_payment_count: int
    linked_owed_items: list[TransactionLinkedOwedItemRead]
    available_replacement_people: list[str]
    delete_with_owed_allowed: bool
    delete_with_owed_block_reason: str | None
    preserve_owed_allowed: bool
    preserve_owed_block_reason: str | None
    relationship_version: str


class TransactionLinkedOwedDeletionCommand(BaseModel):
    strategy: TransactionLinkedOwedDeletionStrategy
    expected_owed_item_ids: list[int] = Field(min_length=1)
    expected_relationship_version: str = Field(
        min_length=64,
        max_length=64,
    )
    replacement_person: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    @model_validator(mode="after")
    def validate_strategy_fields(self):
        if len(set(self.expected_owed_item_ids)) != len(
            self.expected_owed_item_ids
        ):
            raise ValueError(
                "Expected owed item IDs must be unique"
            )

        if (
            self.strategy == "preserve_owed"
            and self.replacement_person is None
        ):
            raise ValueError(
                "A replacement person is required when preserving owed items"
            )

        if (
            self.strategy == "delete_with_owed"
            and self.replacement_person is not None
        ):
            raise ValueError(
                "A replacement person is only valid when preserving owed items"
            )

        return self


class TransactionLinkedOwedDeletionRead(BaseModel):
    deleted_transaction_id: int
    strategy: TransactionLinkedOwedDeletionStrategy
    owed_items_deleted: int
    owed_items_preserved: int
    replacement_person: str | None
