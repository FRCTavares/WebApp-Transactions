from fastapi import HTTPException, status

from app.importers.activobank import ActivoBankImporter
from app.importers.base import NormalisedTransaction
from app.importers.revolut import RevolutImporter
from app.importers.trading212 import Trading212Importer
from app.models.import_batch import ImportBatch
from app.models.transaction import Transaction
from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.import_preview import (
    ImportInvalidRow,
    ImportPreviewResponse,
    ImportPreviewTransaction,
)
from app.services.category_rule_service import CategoryRuleService
from app.services.dedupe_service import DedupeService


class ImportService:
    def __init__(
        self,
        transaction_repository: TransactionRepository,
        import_batch_repository: ImportBatchRepository,
        category_rule_service: CategoryRuleService | None = None,
    ) -> None:
        self.transaction_repository = transaction_repository
        self.import_batch_repository = import_batch_repository
        self.category_rule_service = category_rule_service
        self.dedupe_service = DedupeService(transaction_repository)

    def list_import_batches(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> list[ImportBatch]:
        return self.import_batch_repository.list(
            limit=limit,
            offset=offset,
        )

    def get_import_batch(self, import_batch_id: int) -> ImportBatch:
        import_batch = self.import_batch_repository.get_by_id(import_batch_id)

        if import_batch is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Import batch not found",
            )

        return import_batch

    def preview_import_from_file(
        self,
        source: str,
        file_content: bytes,
        filename: str,
    ) -> ImportPreviewResponse:
        normalised_transactions = self._parse_file(
            source=source,
            file_content=file_content,
            filename=filename,
        )

        return self._build_preview_response(
            source=source,
            normalised_transactions=normalised_transactions,
        )

    def preview_import(self, source: str, csv_content: str) -> ImportPreviewResponse:
        normalised_transactions = self._parse_csv(
            source=source,
            csv_content=csv_content,
        )

        return self._build_preview_response(
            source=source,
            normalised_transactions=normalised_transactions,
        )

    def commit_import_from_file(
        self,
        source: str,
        file_content: bytes,
        filename: str,
    ) -> dict[str, int | str]:
        preview = self.preview_import_from_file(
            source=source,
            file_content=file_content,
            filename=filename,
        )

        return self._commit_preview(
            source=source,
            filename=filename,
            preview=preview,
        )

    def commit_import(
        self,
        source: str,
        csv_content: str,
        filename: str,
    ) -> dict[str, int | str]:
        preview = self.preview_import(source=source, csv_content=csv_content)

        return self._commit_preview(
            source=source,
            filename=filename,
            preview=preview,
        )

    def _parse_file(
        self,
        source: str,
        file_content: bytes,
        filename: str,
    ) -> list[NormalisedTransaction]:
        source = source.strip().lower()

        if source == "activobank":
            return self._parse_activobank_file(
                file_content=file_content,
                filename=filename,
            )

        csv_content = file_content.decode("utf-8-sig")
        return self._parse_csv(source=source, csv_content=csv_content)

    def _parse_activobank_file(
        self,
        file_content: bytes,
        filename: str,
    ) -> list[NormalisedTransaction]:
        if not filename.lower().endswith(".xlsx"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ActivoBank import requires an .xlsx file",
            )

        try:
            return ActivoBankImporter().parse_excel(file_content)
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(error),
            ) from error

    def _parse_csv(
        self,
        source: str,
        csv_content: str,
    ) -> list[NormalisedTransaction]:
        importer = self._get_csv_importer(source)

        try:
            return importer.parse(csv_content)
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(error),
            ) from error

    def _build_preview_response(
        self,
        source: str,
        normalised_transactions: list[NormalisedTransaction],
    ) -> ImportPreviewResponse:
        preview_transactions: list[ImportPreviewTransaction] = []
        invalid_rows: list[ImportInvalidRow] = []
        seen_hashes: set[str] = set()

        for index, transaction in enumerate(normalised_transactions, start=1):
            try:
                preview_row = self._build_preview_row(
                    row_number=index,
                    transaction=transaction,
                    seen_hashes=seen_hashes,
                )
                preview_transactions.append(preview_row)
                seen_hashes.add(preview_row.dedupe_hash)
            except ValueError as error:
                invalid_rows.append(
                    ImportInvalidRow(
                        row_number=index,
                        error=str(error),
                    )
                )

        rows_duplicates = sum(
            1 for transaction in preview_transactions if transaction.is_duplicate
        )

        return ImportPreviewResponse(
            source=source,
            rows_total=len(normalised_transactions),
            rows_valid=len(preview_transactions),
            rows_duplicates=rows_duplicates,
            rows_invalid=len(invalid_rows),
            transactions=preview_transactions,
            invalid_rows=invalid_rows,
        )

    def _commit_preview(
        self,
        source: str,
        filename: str,
        preview: ImportPreviewResponse,
    ) -> dict[str, int | str]:
        rows_skipped = preview.rows_duplicates + preview.rows_invalid
        rows_inserted = len(
            [
                preview_transaction
                for preview_transaction in preview.transactions
                if not preview_transaction.is_duplicate
            ]
        )

        import_batch = self.import_batch_repository.create(
            source=source,
            filename=filename,
            rows_total=preview.rows_total,
            rows_inserted=rows_inserted,
            rows_skipped=rows_skipped,
            status=self._get_import_status(
                rows_total=preview.rows_total,
                rows_inserted=rows_inserted,
                rows_skipped=rows_skipped,
            ),
        )

        transactions_to_insert: list[Transaction] = []

        for preview_transaction in preview.transactions:
            if preview_transaction.is_duplicate:
                continue

            transactions_to_insert.append(
                Transaction(
                    date=preview_transaction.date,
                    description=preview_transaction.description,
                    raw_description=preview_transaction.raw_description,
                    amount=preview_transaction.amount,
                    direction=preview_transaction.direction,
                    source=preview_transaction.source,
                    account=preview_transaction.account,
                    category=preview_transaction.category,
                    currency=preview_transaction.currency,
                    external_id=preview_transaction.external_id,
                    dedupe_hash=preview_transaction.dedupe_hash,
                    import_batch_id=import_batch.id,
                    notes=preview_transaction.notes,
                )
            )

        if transactions_to_insert:
            self.transaction_repository.bulk_insert(transactions_to_insert)

        return {
            "import_batch_id": import_batch.id,
            "source": source,
            "rows_total": preview.rows_total,
            "rows_inserted": len(transactions_to_insert),
            "rows_skipped": rows_skipped,
        }

    def _build_preview_row(
        self,
        row_number: int,
        transaction: NormalisedTransaction,
        seen_hashes: set[str],
    ) -> ImportPreviewTransaction:
        dedupe_hash = self.dedupe_service.create_hash(transaction)
        is_duplicate = (
            self.dedupe_service.is_duplicate(dedupe_hash)
            or dedupe_hash in seen_hashes
        )
        category, _subcategory = self._guess_category(transaction)

        return ImportPreviewTransaction(
            row_number=row_number,
            date=transaction.date,
            raw_description=transaction.raw_description,
            description=transaction.description,
            amount=transaction.amount,
            direction=transaction.direction,
            source=transaction.source,
            account=transaction.account,
            currency=transaction.currency,
            external_id=transaction.external_id,
            notes=transaction.notes,
            dedupe_hash=dedupe_hash,
            is_duplicate=is_duplicate,
            category=category,
        )

    def _guess_category(
        self,
        transaction: NormalisedTransaction,
    ) -> tuple[str | None, str | None]:
        if self.category_rule_service is None:
            return None, None

        return self.category_rule_service.guess_category(transaction)

    def _get_csv_importer(self, source: str):
        source = source.strip().lower()

        if source == "revolut":
            return RevolutImporter()

        if source == "trading212":
            return Trading212Importer()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported import source: {source}",
        )

    def _get_import_status(
        self,
        rows_total: int,
        rows_inserted: int,
        rows_skipped: int,
    ) -> str:
        if rows_inserted == rows_total:
            return "success"

        if rows_inserted > 0 and rows_skipped > 0:
            return "partial"

        if rows_inserted == 0 and rows_skipped == rows_total:
            return "partial"

        return "failed"
