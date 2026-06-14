from decimal import Decimal

from app.importers.legacy_excel import LegacyExcelImporter
from app.models.owed_item import OwedItem
from app.models.transaction import Transaction
from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.owed_repository import OwedRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.legacy_excel_import import (
    LegacyExcelCommitResponse,
    LegacyExcelPreviewInvalidRow,
    LegacyExcelPreviewOwedItem,
    LegacyExcelPreviewResponse,
    LegacyExcelPreviewSummary,
    LegacyExcelPreviewTransaction,
)
from app.utils.hashing import create_dedupe_hash, create_owed_item_dedupe_hash


SOURCE = "legacy_excel"


class LegacyExcelImportService:
    def __init__(
        self,
        transaction_repository: TransactionRepository,
        owed_repository: OwedRepository,
        import_batch_repository: ImportBatchRepository,
    ) -> None:
        self.transaction_repository = transaction_repository
        self.owed_repository = owed_repository
        self.import_batch_repository = import_batch_repository
        self.importer = LegacyExcelImporter()

    def preview_import_from_file(
        self,
        file_content: bytes,
        filename: str,
    ) -> LegacyExcelPreviewResponse:
        parse_result = self.importer.parse_excel(file_content)

        transactions: list[LegacyExcelPreviewTransaction] = []
        owed_items: list[LegacyExcelPreviewOwedItem] = []
        seen_transaction_hashes: set[str] = set()
        seen_owed_hashes: set[str] = set()

        for transaction in parse_result.transactions:
            dedupe_hash = create_dedupe_hash(
                source=transaction.source,
                transaction_date=transaction.date,
                amount=transaction.amount,
                direction=transaction.direction,
                raw_description=transaction.raw_description,
                currency=transaction.currency,
            )
            is_duplicate = (
                self.transaction_repository.exists_by_dedupe_hash(dedupe_hash)
                or dedupe_hash in seen_transaction_hashes
            )
            seen_transaction_hashes.add(dedupe_hash)

            transactions.append(
                LegacyExcelPreviewTransaction(
                    row_number=transaction.row_number,
                    sheet_name=transaction.sheet_name,
                    date=transaction.date,
                    description=transaction.description,
                    raw_description=transaction.raw_description,
                    amount=transaction.amount,
                    direction=transaction.direction,
                    cashflow_type=transaction.cashflow_type,
                    source=transaction.source,
                    account=transaction.account,
                    currency=transaction.currency,
                    category=transaction.category,
                    external_id=transaction.external_id,
                    notes=transaction.notes,
                    dedupe_hash=dedupe_hash,
                    is_duplicate=is_duplicate,
                )
            )

        for owed_item in parse_result.owed_items:
            dedupe_hash = create_owed_item_dedupe_hash(
                source=SOURCE,
                due_date=owed_item.due_date,
                amount_total=owed_item.amount_total,
                person=owed_item.person,
                reason=owed_item.reason,
            )
            is_duplicate = (
                self.owed_repository.exists_by_dedupe_hash(dedupe_hash)
                or dedupe_hash in seen_owed_hashes
            )
            seen_owed_hashes.add(dedupe_hash)
            amount_remaining = owed_item.amount_total - owed_item.amount_paid

            owed_items.append(
                LegacyExcelPreviewOwedItem(
                    row_number=owed_item.row_number,
                    sheet_name=owed_item.sheet_name,
                    person=owed_item.person,
                    amount_total=owed_item.amount_total,
                    amount_paid=owed_item.amount_paid,
                    amount_remaining=amount_remaining,
                    reason=owed_item.reason,
                    status=owed_item.status,
                    due_date=owed_item.due_date,
                    notes=owed_item.notes,
                    external_id=owed_item.external_id,
                    dedupe_hash=dedupe_hash,
                    is_duplicate=is_duplicate,
                )
            )

        invalid_rows = [
            LegacyExcelPreviewInvalidRow(
                sheet_name=invalid_row.sheet_name,
                row_number=invalid_row.row_number,
                section=invalid_row.section,
                error=invalid_row.error,
            )
            for invalid_row in parse_result.invalid_rows
        ]

        duplicate_transaction_count = sum(
            1 for transaction in transactions if transaction.is_duplicate
        )
        duplicate_owed_item_count = sum(
            1 for owed_item in owed_items if owed_item.is_duplicate
        )

        rows_valid = len(transactions) + len(owed_items)
        rows_duplicates = duplicate_transaction_count + duplicate_owed_item_count
        rows_invalid = len(invalid_rows)

        return LegacyExcelPreviewResponse(
            source=SOURCE,
            filename=filename,
            rows_total=rows_valid + rows_invalid,
            rows_valid=rows_valid,
            rows_duplicates=rows_duplicates,
            rows_invalid=rows_invalid,
            summary=self._build_summary(
                transactions=transactions,
                owed_items=owed_items,
                duplicate_transaction_count=duplicate_transaction_count,
                duplicate_owed_item_count=duplicate_owed_item_count,
                invalid_row_count=rows_invalid,
            ),
            transactions=transactions,
            owed_items=owed_items,
            invalid_rows=invalid_rows,
        )

    def commit_import_from_file(
        self,
        file_content: bytes,
        filename: str,
    ) -> LegacyExcelCommitResponse:
        preview = self.preview_import_from_file(
            file_content=file_content,
            filename=filename,
        )

        rows_skipped = preview.rows_duplicates + preview.rows_invalid
        transactions_to_insert = self._build_transactions_to_insert(
            preview=preview,
            import_batch_id=None,
        )
        owed_items_to_insert = self._build_owed_items_to_insert(
            preview=preview,
            import_batch_id=None,
        )
        rows_inserted = len(transactions_to_insert) + len(owed_items_to_insert)

        if rows_inserted == 0:
            return LegacyExcelCommitResponse(
                import_batch_id=0,
                source=SOURCE,
                filename=filename,
                rows_total=preview.rows_total,
                rows_inserted=0,
                rows_skipped=rows_skipped,
                transactions_inserted=0,
                owed_items_inserted=0,
                duplicate_transactions_skipped=preview.summary.duplicate_transaction_count,
                duplicate_owed_items_skipped=preview.summary.duplicate_owed_item_count,
                invalid_rows_skipped=preview.rows_invalid,
                status="skipped",
            )

        import_batch = self.import_batch_repository.create(
            source=SOURCE,
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

        transactions_to_insert = self._build_transactions_to_insert(
            preview=preview,
            import_batch_id=import_batch.id,
        )
        owed_items_to_insert = self._build_owed_items_to_insert(
            preview=preview,
            import_batch_id=import_batch.id,
        )

        if transactions_to_insert:
            self.transaction_repository.bulk_insert(transactions_to_insert)

        if owed_items_to_insert:
            self.owed_repository.bulk_insert(owed_items_to_insert)

        return LegacyExcelCommitResponse(
            import_batch_id=import_batch.id,
            source=SOURCE,
            filename=filename,
            rows_total=preview.rows_total,
            rows_inserted=len(transactions_to_insert) + len(owed_items_to_insert),
            rows_skipped=rows_skipped,
            transactions_inserted=len(transactions_to_insert),
            owed_items_inserted=len(owed_items_to_insert),
            duplicate_transactions_skipped=preview.summary.duplicate_transaction_count,
            duplicate_owed_items_skipped=preview.summary.duplicate_owed_item_count,
            invalid_rows_skipped=preview.rows_invalid,
            status=import_batch.status,
        )

    def _build_transactions_to_insert(
        self,
        preview: LegacyExcelPreviewResponse,
        import_batch_id: int | None,
    ) -> list[Transaction]:
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
                    cashflow_type=preview_transaction.cashflow_type,
                    source=preview_transaction.source,
                    account=preview_transaction.account,
                    category=preview_transaction.category,
                    currency=preview_transaction.currency,
                    external_id=preview_transaction.external_id,
                    dedupe_hash=preview_transaction.dedupe_hash,
                    import_batch_id=import_batch_id,
                    notes=preview_transaction.notes,
                )
            )

        return transactions_to_insert

    def _build_owed_items_to_insert(
        self,
        preview: LegacyExcelPreviewResponse,
        import_batch_id: int | None,
    ) -> list[OwedItem]:
        owed_items_to_insert: list[OwedItem] = []

        for preview_owed_item in preview.owed_items:
            if preview_owed_item.is_duplicate:
                continue

            owed_items_to_insert.append(
                OwedItem(
                    person=preview_owed_item.person,
                    amount_total=preview_owed_item.amount_total,
                    amount_paid=preview_owed_item.amount_paid,
                    amount_remaining=preview_owed_item.amount_remaining,
                    reason=preview_owed_item.reason,
                    status=preview_owed_item.status,
                    due_date=preview_owed_item.due_date,
                    notes=preview_owed_item.notes,
                    source=SOURCE,
                    import_batch_id=import_batch_id,
                    external_id=preview_owed_item.external_id,
                    dedupe_hash=preview_owed_item.dedupe_hash,
                )
            )

        return owed_items_to_insert

    def _build_summary(
        self,
        transactions: list[LegacyExcelPreviewTransaction],
        owed_items: list[LegacyExcelPreviewOwedItem],
        duplicate_transaction_count: int,
        duplicate_owed_item_count: int,
        invalid_row_count: int,
    ) -> LegacyExcelPreviewSummary:
        money_in_total = Decimal("0.00")
        money_out_total = Decimal("0.00")
        owed_open_total = Decimal("0.00")
        owed_paid_total = Decimal("0.00")

        for transaction in transactions:
            if transaction.is_duplicate:
                continue

            if transaction.direction == "in":
                money_in_total += transaction.amount
            else:
                money_out_total += transaction.amount

        for owed_item in owed_items:
            if owed_item.is_duplicate:
                continue

            if owed_item.status == "paid":
                owed_paid_total += owed_item.amount_total
            else:
                owed_open_total += owed_item.amount_remaining

        return LegacyExcelPreviewSummary(
            transaction_count=len(transactions),
            owed_item_count=len(owed_items),
            duplicate_transaction_count=duplicate_transaction_count,
            duplicate_owed_item_count=duplicate_owed_item_count,
            invalid_row_count=invalid_row_count,
            money_in_total=money_in_total,
            money_out_total=money_out_total,
            owed_open_total=owed_open_total,
            owed_paid_total=owed_paid_total,
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
