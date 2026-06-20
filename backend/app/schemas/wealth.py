from datetime import date as DateType
from datetime import datetime as DateTimeType
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


WealthAccountType = Literal[
    "current_account",
    "savings_account",
    "brokerage",
    "cash",
    "other",
]


class WealthAccountBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    account_type: WealthAccountType
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    institution: str | None = Field(default=None, max_length=100)
    is_active: bool = True
    notes: str | None = None


class WealthAccountCreate(WealthAccountBase):
    pass


class WealthAccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    account_type: WealthAccountType | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    institution: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None
    notes: str | None = None


class WealthAccountRead(WealthAccountBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: DateTimeType
    updated_at: DateTimeType


class WealthSnapshotBase(BaseModel):
    snapshot_date: DateType
    account_id: int
    balance: Decimal = Field(ge=0)
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    balance_eur: Decimal | None = Field(default=None, ge=0)
    fx_rate_to_eur: Decimal | None = Field(default=None, gt=0)
    interest_earned: Decimal | None = Field(default=None, ge=0)
    notes: str | None = None

    @model_validator(mode="after")
    def validate_currency_conversion(self):
        currency = self.currency.upper()

        if currency == "EUR":
            if self.fx_rate_to_eur is None:
                self.fx_rate_to_eur = Decimal("1")
            if self.balance_eur is None:
                self.balance_eur = self.balance
            return self

        if self.fx_rate_to_eur is None:
            raise ValueError("fx_rate_to_eur is required for non-EUR snapshots")

        if self.balance_eur is None:
            self.balance_eur = self.balance * self.fx_rate_to_eur

        return self


class WealthSnapshotCreate(WealthSnapshotBase):
    pass


class WealthSnapshotUpdate(BaseModel):
    snapshot_date: DateType | None = None
    account_id: int | None = None
    balance: Decimal | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    balance_eur: Decimal | None = Field(default=None, ge=0)
    fx_rate_to_eur: Decimal | None = Field(default=None, gt=0)
    interest_earned: Decimal | None = Field(default=None, ge=0)
    notes: str | None = None


class WealthSnapshotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    snapshot_date: DateType
    account_id: int
    balance: Decimal
    currency: str
    balance_eur: Decimal
    fx_rate_to_eur: Decimal
    interest_earned: Decimal | None = None
    notes: str | None = None
    source: str = "manual"
    import_batch_id: int | None = None
    external_id: str | None = None
    dedupe_hash: str | None = None
    created_at: DateTimeType
    updated_at: DateTimeType


class WealthSummaryRead(BaseModel):
    current_total_wealth_eur: Decimal
    account_count: int
    latest_snapshot_date: DateType | None = None
    total_interest_earned: Decimal
    money_owed_to_me_eur: Decimal = Decimal("0")


class WealthMonthlyRead(BaseModel):
    month: str
    total_wealth_eur: Decimal
