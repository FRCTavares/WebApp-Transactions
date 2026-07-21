from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class PendingFxResolutionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_id: int
    event_date: date
    currency: str
    ticker: str | None = None
    resolved_rate: Decimal | None = None
    rate_date: date | None = None


class PendingFxSummaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pending_count: int
    resolvable_count: int
    unresolvable_count: int
    currencies: list[str]
    earliest_date: date | None = None
    latest_date: date | None = None
    resolutions: list[PendingFxResolutionRead]
