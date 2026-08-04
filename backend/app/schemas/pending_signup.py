from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PendingSignupRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    status: str
    requested_at: datetime
    decided_at: datetime | None = None
    decided_by: str | None = None


class AccessStatusRead(BaseModel):
    status: str
