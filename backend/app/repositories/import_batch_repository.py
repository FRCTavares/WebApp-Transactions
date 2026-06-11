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
    ) -> ImportBatch:
        import_batch = ImportBatch(
            source=source,
            filename=filename,
            rows_total=rows_total,
            rows_inserted=rows_inserted,
            rows_skipped=rows_skipped,
            status=status,
        )

        self.db.add(import_batch)
        self.db.commit()
        self.db.refresh(import_batch)
        return import_batch

    def list(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> list[ImportBatch]:
        statement = (
            select(ImportBatch)
            .order_by(ImportBatch.imported_at.desc(), ImportBatch.id.desc())
            .offset(offset)
            .limit(limit)
        )

        return list(self.db.scalars(statement).all())

    def get_by_id(self, import_batch_id: int) -> ImportBatch | None:
        return self.db.get(ImportBatch, import_batch_id)


    def delete(self, import_batch: ImportBatch) -> None:
        self.db.delete(import_batch)
        self.db.commit()
