from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.importers.legacy_excel import LegacyExcelImporter
from app.models.owed_item import OwedItem
from app.models.transaction import Transaction
from app.models.wealth_snapshot import WealthSnapshot
from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.owed_repository import OwedRepository
from app.repositories.transaction_repository import TransactionRepository
from app.repositories.wealth_repository import WealthRepository
from app.schemas.legacy_excel_import import (
    LegacyExcelCommitResponse,
    LegacyExcelPreviewInvalidRow,
    LegacyExcelPreviewOwedItem,
    LegacyExcelPreviewResponse,
    LegacyExcelPreviewSummary,
    LegacyExcelPreviewTransaction,
    LegacyExcelPreviewWealthSnapshot,
    LegacyExcelWealthCommitResponse,
    LegacyExcelWealthPreviewResponse,
    LegacyExcelWealthPreviewSummary,
)
from app.utils.hashing import create_dedupe_hash, create_owed_item_dedupe_hash


SOURCE = "legacy_excel"


class LegacyExcelImportService:
    def __init__(
        self,
        transaction_repository: TransactionRepository,
        owed_repository: OwedRepository,
        import_batch_repository: ImportBatchRepository,
        wealth_repository: WealthRepository | None = None,
    ) -> None:
        self.transaction_repository = transaction_repository
        self.owed_repository = owed_repository
        self.import_batch_repository = import_batch_repository
        self.wealth_repository = wealth_repository
        self.importer = LegacyExcelImporter()

    def preview_import_from_file(
        self,
        file_content: bytes,
        filename: str,
        current_user: CurrentUser | None = None,
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
                self.transaction_repository.exists_by_dedupe_hash(
                    dedupe_hash,
                    self._get_user_id(current_user),
                )
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
                self.owed_repository.exists_by_dedupe_hash(
                    dedupe_hash,
                    self._get_user_id(current_user),
                )
                or dedupe_hash in seen_owed_hashes
            )
            seen_owed_hashes.add(dedupe_hash)
            amount_paid = owed_item.amount_total
            amount_remaining = Decimal("0.00")
            status = "paid"

            owed_items.append(
                LegacyExcelPreviewOwedItem(
                    row_number=owed_item.row_number,
                    sheet_name=owed_item.sheet_name,
                    person=owed_item.person,
                    amount_total=owed_item.amount_total,
                    amount_paid=amount_paid,
                    amount_remaining=amount_remaining,
                    reason=owed_item.reason,
                    status=status,
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
        current_user: CurrentUser | None = None,
    ) -> LegacyExcelCommitResponse:
        preview = self.preview_import_from_file(
            file_content=file_content,
            filename=filename,
            current_user=current_user,
        )

        rows_skipped = preview.rows_duplicates + preview.rows_invalid
        user_id = self._get_user_id(current_user)
        transactions_to_insert = self._build_transactions_to_insert(
            preview=preview,
            import_batch_id=None,
            user_id=user_id,
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

        db = self.import_batch_repository.db

        try:
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
                user_id=user_id,
                commit=False,
            )

            transactions_to_insert = self._build_transactions_to_insert(
                preview=preview,
                import_batch_id=import_batch.id,
                user_id=user_id,
            )
            owed_items_to_insert = self._build_owed_items_to_insert(
                preview=preview,
                import_batch_id=import_batch.id,
            )

            if transactions_to_insert:
                self.transaction_repository.bulk_insert(
                    transactions_to_insert,
                    user_id,
                    commit=False,
                )

            if owed_items_to_insert:
                self.owed_repository.bulk_insert(
                    owed_items_to_insert,
                    user_id,
                    commit=False,
                )

            db.commit()
        except IntegrityError as error:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Import conflicts with records committed by another request",
            ) from error
        except Exception:
            db.rollback()
            raise

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


    def preview_wealth_import_from_file(
        self,
        file_content: bytes,
        filename: str,
        current_user: CurrentUser | None = None,
    ) -> LegacyExcelWealthPreviewResponse:
        if self.wealth_repository is None:
            raise RuntimeError("Wealth repository is required for wealth import")

        snapshots: list[LegacyExcelPreviewWealthSnapshot] = []
        seen_hashes: set[str] = set()

        for snapshot in self.importer.parse_wealth_snapshots(file_content):
            dedupe_hash = self._build_wealth_snapshot_dedupe_hash(
                account_name=snapshot.account_name,
                snapshot_date=snapshot.snapshot_date,
                balance=snapshot.balance_eur,
            )
            account = self.wealth_repository.get_account_by_name(
                snapshot.account_name,
                self._get_user_id(current_user),
            )
            is_duplicate = (
                dedupe_hash in seen_hashes
                or self.wealth_repository.exists_snapshot_by_dedupe_hash(
                    dedupe_hash,
                    self._get_user_id(current_user),
                )
                or (
                    account is not None
                    and self.wealth_repository.exists_snapshot_for_account_date(
                        account_id=account.id,
                        snapshot_date=snapshot.snapshot_date,
                        user_id=self._get_user_id(current_user),
                    )
                )
            )
            seen_hashes.add(dedupe_hash)

            snapshots.append(
                LegacyExcelPreviewWealthSnapshot(
                    sheet_name=snapshot.sheet_name,
                    row_number=snapshot.row_number,
                    column_number=snapshot.column_number,
                    snapshot_date=snapshot.snapshot_date,
                    account_name=snapshot.account_name,
                    account_type=snapshot.account_type,
                    balance=snapshot.balance,
                    currency=snapshot.currency,
                    balance_eur=snapshot.balance_eur,
                    fx_rate_to_eur=snapshot.fx_rate_to_eur,
                    interest_earned=snapshot.interest_earned,
                    notes=snapshot.notes,
                    external_id=snapshot.external_id,
                    dedupe_hash=dedupe_hash,
                    is_duplicate=is_duplicate,
                )
            )

        duplicate_count = sum(1 for snapshot in snapshots if snapshot.is_duplicate)
        snapshot_dates = [snapshot.snapshot_date for snapshot in snapshots]

        return LegacyExcelWealthPreviewResponse(
            source=SOURCE,
            filename=filename,
            rows_total=len(snapshots),
            rows_valid=len(snapshots),
            rows_duplicates=duplicate_count,
            rows_invalid=0,
            summary=LegacyExcelWealthPreviewSummary(
                snapshot_count=len(snapshots),
                duplicate_snapshot_count=duplicate_count,
                account_count=len({snapshot.account_name for snapshot in snapshots}),
                latest_snapshot_date=max(snapshot_dates) if snapshot_dates else None,
            ),
            snapshots=snapshots,
        )

    def commit_wealth_import_from_file(
        self,
        file_content: bytes,
        filename: str,
        current_user: CurrentUser | None = None,
    ) -> LegacyExcelWealthCommitResponse:
        if self.wealth_repository is None:
            raise RuntimeError("Wealth repository is required for wealth import")

        preview = self.preview_wealth_import_from_file(
            file_content=file_content,
            filename=filename,
            current_user=current_user,
        )

        snapshots_to_insert = [
            snapshot for snapshot in preview.snapshots if not snapshot.is_duplicate
        ]

        if not snapshots_to_insert:
            return LegacyExcelWealthCommitResponse(
                import_batch_id=0,
                source=SOURCE,
                filename=filename,
                rows_total=preview.rows_total,
                rows_inserted=0,
                rows_skipped=preview.rows_duplicates,
                accounts_created=0,
                snapshots_inserted=0,
                duplicate_snapshots_skipped=preview.rows_duplicates,
                status="skipped",
            )

        accounts_created = 0
        user_id = self._get_user_id(current_user)
        db = self.import_batch_repository.db

        try:
            for preview_snapshot in snapshots_to_insert:
                account = self.wealth_repository.get_account_by_name(
                    preview_snapshot.account_name,
                    user_id,
                )

                if account is None:
                    self.wealth_repository.create_account(
                        self._build_wealth_account_create_payload(preview_snapshot),
                        user_id,
                        commit=False,
                    )
                    accounts_created += 1

            import_batch = self.import_batch_repository.create(
                source="legacy_excel_wealth",
                filename=filename,
                rows_total=preview.rows_total,
                rows_inserted=len(snapshots_to_insert),
                rows_skipped=preview.rows_duplicates,
                status=self._get_import_status(
                    rows_total=preview.rows_total,
                    rows_inserted=len(snapshots_to_insert),
                    rows_skipped=preview.rows_duplicates,
                ),
                user_id=user_id,
                commit=False,
            )

            snapshot_models: list[WealthSnapshot] = []

            for preview_snapshot in snapshots_to_insert:
                account = self.wealth_repository.get_account_by_name(
                    preview_snapshot.account_name,
                    user_id,
                )

                if account is None:
                    continue

                snapshot_models.append(
                    WealthSnapshot(
                        user_id=user_id,
                        snapshot_date=preview_snapshot.snapshot_date,
                        account_id=account.id,
                        balance=preview_snapshot.balance,
                        currency=preview_snapshot.currency,
                        balance_eur=preview_snapshot.balance_eur,
                        fx_rate_to_eur=preview_snapshot.fx_rate_to_eur,
                        interest_earned=preview_snapshot.interest_earned,
                        notes=preview_snapshot.notes,
                        source="legacy_excel_wealth",
                        import_batch_id=import_batch.id,
                        external_id=preview_snapshot.external_id,
                        dedupe_hash=preview_snapshot.dedupe_hash,
                    )
                )

            self.wealth_repository.bulk_insert_snapshots(
                snapshot_models,
                user_id,
                commit=False,
            )

            db.commit()
        except IntegrityError as error:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Import conflicts with records committed by another request",
            ) from error
        except Exception:
            db.rollback()
            raise

        return LegacyExcelWealthCommitResponse(
            import_batch_id=import_batch.id,
            source=SOURCE,
            filename=filename,
            rows_total=preview.rows_total,
            rows_inserted=len(snapshot_models),
            rows_skipped=preview.rows_duplicates,
            accounts_created=accounts_created,
            snapshots_inserted=len(snapshot_models),
            duplicate_snapshots_skipped=preview.rows_duplicates,
            status=import_batch.status,
        )

    def _build_wealth_snapshot_dedupe_hash(
        self,
        account_name: str,
        snapshot_date,
        balance,
    ) -> str:
        raw_value = f"{SOURCE}:wealth:{account_name}:{snapshot_date}:{balance}"
        return create_dedupe_hash(
            source=SOURCE,
            transaction_date=snapshot_date,
            amount=balance,
            direction="wealth",
            raw_description=raw_value,
            currency="EUR",
        )

    def _build_wealth_account_create_payload(self, preview_snapshot):
        from app.schemas.wealth import WealthAccountCreate

        return WealthAccountCreate(
            name=preview_snapshot.account_name,
            account_type=preview_snapshot.account_type,
            currency=preview_snapshot.currency,
            institution=preview_snapshot.account_name,
            is_active=True,
            notes="Created from legacy Excel wealth import.",
        )


    def _build_transactions_to_insert(
        self,
        preview: LegacyExcelPreviewResponse,
        import_batch_id: int | None,
        user_id: str,
    ) -> list[Transaction]:
        transactions_to_insert: list[Transaction] = []

        for preview_transaction in preview.transactions:
            if preview_transaction.is_duplicate:
                continue

            transactions_to_insert.append(
                Transaction(
                    user_id=user_id,
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

    def _get_user_id(self, current_user: CurrentUser | None) -> str:
        if current_user is None:
            return LOCAL_DEFAULT_USER_ID

        return current_user.id

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
