from datetime import datetime as DateTimeType
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


MatchField = Literal["description", "raw_description", "merchant"]
DirectionFilter = Literal["in", "out"]


class DescriptionRuleBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    cleaned_description: str = Field(min_length=1, max_length=255)

    match_text: str = Field(min_length=1, max_length=255)
    match_field: MatchField = "raw_description"
    direction: DirectionFilter | None = None
    source: str | None = Field(default=None, max_length=50)

    is_active: bool = True


class DescriptionRuleCreate(DescriptionRuleBase):
    pass


class DescriptionRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    cleaned_description: str | None = Field(default=None, min_length=1, max_length=255)

    match_text: str | None = Field(default=None, min_length=1, max_length=255)
    match_field: MatchField | None = None
    direction: DirectionFilter | None = None
    source: str | None = Field(default=None, max_length=50)

    is_active: bool | None = None


class DescriptionRuleRead(DescriptionRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: DateTimeType
    updated_at: DateTimeType
