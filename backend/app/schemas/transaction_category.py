from datetime import date as DateType
from datetime import datetime as DateTimeType
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


Direction = Literal["in", "out"]
CashflowType = Literal["income", "expense", "transfer"]


class TransactionCategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    direction: Direction
    cashflow_type: CashflowType
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def validate_direction_and_cashflow_type(self):
        if self.direction == "in" and self.cashflow_type == "expense":
            raise ValueError(
                "Money In categories cannot use expense cashflow type"
            )

        if self.direction == "out" and self.cashflow_type == "income":
            raise ValueError(
                "Money Out categories cannot use income cashflow type"
            )

        return self


class TransactionCategoryCreate(TransactionCategoryBase):
    pass


class TransactionCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    direction: Direction | None = None
    cashflow_type: CashflowType | None = None
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)


class TransactionCategoryRead(TransactionCategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: DateTimeType
    updated_at: DateTimeType


class TransactionCategoryUsageRead(BaseModel):
    transaction_count: int


class TransactionCategoryMigrationTransactionRead(BaseModel):
    id: int
    date: DateType
    description: str
    raw_description: str
    merchant: str | None = None
    source: str
    account: str | None = None
    amount: str
    currency: str


class TransactionCategoryMigrationPreviewRead(BaseModel):
    category: TransactionCategoryRead
    transactions: list[TransactionCategoryMigrationTransactionRead]
    replacement_categories: list[TransactionCategoryRead]


class TransactionCategoryMigrationTransactionAssignment(BaseModel):
    transaction_id: int = Field(gt=0)
    replacement_category_id: int = Field(gt=0)


class TransactionCategoryMigrationApply(BaseModel):
    transaction_assignments: list[
        TransactionCategoryMigrationTransactionAssignment
    ]


class TransactionCategoryMigrationApplyRead(BaseModel):
    deleted_category_id: int
    transactions_updated: int


class TransactionCategoryReplaceDelete(BaseModel):
    replacement_category_id: int = Field(gt=0)


class TransactionCategoryReplaceDeleteRead(BaseModel):
    deleted_category_id: int
    replacement_category_id: int
    transactions_updated: int
