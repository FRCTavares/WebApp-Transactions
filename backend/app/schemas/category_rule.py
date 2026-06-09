from datetime import datetime as DateTimeType
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


MatchField = Literal["description", "raw_description", "merchant"]
DirectionFilter = Literal["in", "out"]


class CategoryRuleBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    category: str = Field(min_length=1, max_length=100)
    subcategory: str | None = Field(default=None, max_length=100)

    match_text: str = Field(min_length=1, max_length=255)
    match_field: MatchField = "description"
    direction: DirectionFilter | None = None
    source: str | None = Field(default=None, max_length=50)

    is_active: bool = True


class CategoryRuleCreate(CategoryRuleBase):
    pass


class CategoryRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    subcategory: str | None = Field(default=None, max_length=100)

    match_text: str | None = Field(default=None, min_length=1, max_length=255)
    match_field: MatchField | None = None
    direction: DirectionFilter | None = None
    source: str | None = Field(default=None, max_length=50)

    is_active: bool | None = None


class CategoryRuleRead(CategoryRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: DateTimeType
    updated_at: DateTimeType


class CategoryRuleSuggestion(BaseModel):
    description: str
    source: str
    direction: DirectionFilter
    count: int
    total: Decimal
