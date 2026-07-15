from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.import_preview import ImportPreview


class ImportPreviewRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        *,
        user_id: str,
        mode: str,
        source: str,
        filename: str,
        file_sha256: str,
        created_at: datetime,
        expires_at: datetime,
        rows_total: int,
        rows_valid: int,
        rows_duplicates: int,
        rows_invalid: int,
        transactions_pending: int = 0,
        investment_events_pending: int = 0,
        owed_items_pending: int = 0,
        wealth_snapshots_pending: int = 0,
        commit: bool = True,
    ) -> ImportPreview:
        preview = ImportPreview(
            user_id=user_id,
            mode=mode,
            source=source,
            filename=filename,
            file_sha256=file_sha256,
            created_at=created_at,
            expires_at=expires_at,
            rows_total=rows_total,
            rows_valid=rows_valid,
            rows_duplicates=rows_duplicates,
            rows_invalid=rows_invalid,
            transactions_pending=transactions_pending,
            investment_events_pending=investment_events_pending,
            owed_items_pending=owed_items_pending,
            wealth_snapshots_pending=wealth_snapshots_pending,
        )
        self.db.add(preview)

        if commit:
            self.db.commit()
            self.db.refresh(preview)
        else:
            self.db.flush()

        return preview

    def get_by_id(
        self,
        preview_id: str,
        *,
        user_id: str,
    ) -> ImportPreview | None:
        statement = (
            select(ImportPreview)
            .where(ImportPreview.id == preview_id)
            .where(ImportPreview.user_id == user_id)
        )
        return self.db.scalar(statement)

    def claim_unconsumed(
        self,
        preview_id: str,
        *,
        user_id: str,
        consumed_at: datetime,
        commit: bool,
    ) -> bool:
        statement = (
            update(ImportPreview)
            .where(ImportPreview.id == preview_id)
            .where(ImportPreview.user_id == user_id)
            .where(ImportPreview.consumed_at.is_(None))
            .values(consumed_at=consumed_at)
            .execution_options(synchronize_session=False)
        )
        result = self.db.execute(statement)
        claimed = int(result.rowcount or 0) == 1

        if claimed and commit:
            self.db.commit()

        return claimed
