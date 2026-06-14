from decimal import Decimal

from app.importers.legacy_excel import LegacyExcelImporter
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.legacy_excel_import import (
    LegacyExcelPreviewInvalidRow,
    LegacyExcelPreviewOwedItem,
    LegacyExcelPreviewResponse,
    LegacyExcelPreviewSummary,
    LegacyExcelPreviewTransaction,
)
from app.utils.hashing import create_dedupe_hash


class LegacyExcelImportService:
    def __init__(
        self,
        transaction_repository: TransactionRepository,
    ) -> None:
        self.transaction_repository = transaction_repository
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
        seen_owed_external_ids: set[str] = set()

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
            is_duplicate = owed_item.external_id in seen_owed_external_ids
            seen_owed_external_ids.add(owed_item.external_id)
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
            source="legacy_excel",
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
