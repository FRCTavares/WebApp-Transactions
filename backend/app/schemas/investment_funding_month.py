from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class InvestmentFundingMonthBase(BaseModel):
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    source: str = Field(min_length=1, max_length=50)
    manual_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    cashback_rounding_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    notes: str | None = None


class InvestmentFundingMonthCreate(InvestmentFundingMonthBase):
    pass


class InvestmentFundingMonthUpdate(BaseModel):
    manual_amount: Decimal | None = Field(default=None, ge=0)
    cashback_rounding_amount: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    notes: str | None = None


class InvestmentFundingMonthRead(InvestmentFundingMonthBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
