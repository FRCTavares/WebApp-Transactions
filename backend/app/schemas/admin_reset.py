from pydantic import BaseModel, Field


class MonthResetRequest(BaseModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    confirm: str
    dry_run: bool = True


class MonthResetResponse(BaseModel):
    month: str
    dry_run: bool
    before: dict[str, int]
    deleted: dict[str, int]
    after: dict[str, int]
    status: str
