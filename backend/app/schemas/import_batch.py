from datetime import datetime as DateTimeType

from pydantic import BaseModel, ConfigDict


class ImportBatchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    filename: str
    imported_at: DateTimeType
    rows_total: int
    rows_inserted: int
    rows_skipped: int
    status: str


class ImportBatchDeleteResponse(BaseModel):
    import_batch_id: int
    source: str
    filename: str
    deleted_transactions: int
    deleted_investment_events: int
    deleted_owed_items: int
    deleted_wealth_snapshots: int
    deleted_total: int
    status: str
