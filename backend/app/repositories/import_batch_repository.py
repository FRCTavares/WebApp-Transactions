from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.import_batch import ImportBatch


class ImportBatchRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        source: str,
        filename: str,
        rows_total: int,
        rows_inserted: int,
        rows_skipped: int,
        status: str,
        *,
        user_id: str,
        commit: bool = True,
    ) -> ImportBatch:
        import_batch = ImportBatch(
            user_id=user_id,
            source=source,
            filename=filename,
            rows_total=rows_total,
            rows_inserted=rows_inserted,
            rows_skipped=rows_skipped,
            status=status,
        )

        self.db.add(import_batch)

        if commit:
            self.db.commit()
            self.db.refresh(import_batch)
        else:
            self.db.flush()

        return import_batch

    def list(
        self,
        limit: int = 100,
        offset: int = 0,
        *,
        user_id: str,
    ) -> list[ImportBatch]:
        statement = (
            select(ImportBatch)
            .where(ImportBatch.user_id == user_id)
            .order_by(ImportBatch.imported_at.desc(), ImportBatch.id.desc())
            .offset(offset)
            .limit(limit)
        )

        return list(self.db.scalars(statement).all())

    def get_by_id(
        self,
        import_batch_id: int,
        *,
        user_id: str,
    ) -> ImportBatch | None:
        statement = (
            select(ImportBatch)
            .where(ImportBatch.id == import_batch_id)
            .where(ImportBatch.user_id == user_id)
        )
        return self.db.scalar(statement)


    def delete(self, import_batch: ImportBatch) -> None:
        self.db.delete(import_batch)
        self.db.commit()
