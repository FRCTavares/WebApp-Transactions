from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class TripSavingsAllocationUpdate(BaseModel):
    amount_eur: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )


class TripSavingsAllocationRead(BaseModel):
    month: str
    amount_eur: Decimal
    goal_eur: Decimal
    source: Literal["default", "override"]
