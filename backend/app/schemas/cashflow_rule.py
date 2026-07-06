from datetime import datetime as DateTimeType
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


MatchField = Literal["description", "raw_description", "merchant"]
DirectionFilter = Literal["in", "out"]
CashflowType = Literal[
    "income",
    "expense",
    "transfer",
]


class CashflowRuleBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    cashflow_type: CashflowType

    match_text: str = Field(min_length=1, max_length=255)
    match_field: MatchField = "raw_description"
    direction: DirectionFilter | None = None
    source: str | None = Field(default=None, max_length=50)

    is_active: bool = True


class CashflowRuleCreate(CashflowRuleBase):
    pass


class CashflowRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    cashflow_type: CashflowType | None = None

    match_text: str | None = Field(default=None, min_length=1, max_length=255)
    match_field: MatchField | None = None
    direction: DirectionFilter | None = None
    source: str | None = Field(default=None, max_length=50)

    is_active: bool | None = None


class CashflowRuleRead(CashflowRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: DateTimeType
    updated_at: DateTimeType
