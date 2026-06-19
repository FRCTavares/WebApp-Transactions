from fastapi import HTTPException, status

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.importers.activobank import ActivoBankImporter
from app.importers.base import (
    ImportParseResult,
    NormalisedInvestmentEvent,
    NormalisedTransaction,
)
from app.importers.revolut import RevolutImporter
from app.importers.trading212 import Trading212Importer
from app.models.import_batch import ImportBatch
from app.models.investment_event import InvestmentEvent
from app.models.transaction import Transaction
from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.repositories.owed_repository import OwedRepository
from app.repositories.transaction_repository import TransactionRepository
from app.repositories.wealth_repository import WealthRepository
from app.schemas.import_preview import (
    ImportInvalidRow,
    ImportPreviewInvestmentEvent,
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
        wealth_repository: WealthRepository | None = None,
        category_rule_service: CategoryRuleService | None = None,
        investment_event_repository: InvestmentEventRepository | None = None,
        owed_repository: OwedRepository | None = None,
    ) -> None:
        self.transaction_repository = transaction_repository
        self.import_batch_repository = import_batch_repository
        self.wealth_repository = wealth_repository
        self.category_rule_service = category_rule_service
        self.investment_event_repository = investment_event_repository
        self.owed_repository = owed_repository
        self.dedupe_service = DedupeService(
            transaction_repository=transaction_repository,
            investment_event_repository=investment_event_repository,
        )

    def list_import_batches(
        self,
        limit: int = 100,
        offset: int = 0,
        current_user: CurrentUser | None = None,
    ) -> list[ImportBatch]:
        return self.import_batch_repository.list(
            limit=limit,
            offset=offset,
            user_id=self._get_user_id(current_user),
        )

    def get_import_batch(
        self,
        import_batch_id: int,
        current_user: CurrentUser | None = None,
    ) -> ImportBatch:
        import_batch = self.import_batch_repository.get_by_id(
            import_batch_id,
            user_id=self._get_user_id(current_user),
        )

        if import_batch is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Import batch not found",
            )

        return import_batch

    def list_import_batch_transactions(
        self,
        import_batch_id: int,
        limit: int = 100,
        offset: int = 0,
        current_user: CurrentUser | None = None,
    ) -> list[Transaction]:
        self.get_import_batch(import_batch_id, current_user)

        return self.transaction_repository.list_by_import_batch(
            import_batch_id=import_batch_id,
            limit=limit,
            offset=offset,
            user_id=self._get_user_id(current_user),
        )

    def delete_import_batch(
        self,
        import_batch_id: int,
        current_user: CurrentUser | None = None,
    ) -> dict[str, int | str]:
        import_batch = self.get_import_batch(import_batch_id, current_user)

        deleted_investment_events = 0
        deleted_owed_items = 0
        deleted_wealth_snapshots = 0

        if self.investment_event_repository is not None:
            deleted_investment_events = (
                self.investment_event_repository.delete_by_import_batch(
                    import_batch_id=import_batch_id,
                    user_id=self._get_user_id(current_user),
                )
            )

        deleted_transactions = self.transaction_repository.delete_by_import_batch(
            import_batch_id=import_batch_id,
            user_id=self._get_user_id(current_user),
        )

        if self.owed_repository is not None:
            deleted_owed_items = self.owed_repository.delete_by_import_batch(
                import_batch_id=import_batch_id,
                user_id=self._get_user_id(current_user),
            )

        if self.wealth_repository is not None:
            deleted_wealth_snapshots = self.wealth_repository.delete_snapshots_by_import_batch(
                import_batch_id,
                user_id=self._get_user_id(current_user),
            )

        deleted_total = (
            deleted_transactions
            + deleted_investment_events
            + deleted_owed_items
            + deleted_wealth_snapshots
        )

        source = import_batch.source
        filename = import_batch.filename

        self.import_batch_repository.delete(import_batch)

        return {
            "import_batch_id": import_batch_id,
            "source": source,
            "filename": filename,
            "deleted_transactions": deleted_transactions,
            "deleted_investment_events": deleted_investment_events,
            "deleted_owed_items": deleted_owed_items,
            "deleted_wealth_snapshots": deleted_wealth_snapshots,
            "deleted_total": deleted_total,
            "status": "deleted",
        }

    def preview_import_from_file(
        self,
        source: str,
        file_content: bytes,
        filename: str,
        current_user: CurrentUser | None = None,
    ) -> ImportPreviewResponse:
        parse_result = self._parse_file(
            source=source,
            file_content=file_content,
            filename=filename,
        )

        return self._build_preview_response(
            source=source,
            parse_result=parse_result,
            current_user=current_user,
        )

    def preview_import(
        self,
        source: str,
        csv_content: str,
        current_user: CurrentUser | None = None,
    ) -> ImportPreviewResponse:
        parse_result = self._parse_csv(
            source=source,
            csv_content=csv_content,
        )

        return self._build_preview_response(
            source=source,
            parse_result=parse_result,
            current_user=current_user,
        )

    def commit_import_from_file(
        self,
        source: str,
        file_content: bytes,
        filename: str,
        current_user: CurrentUser | None = None,
    ) -> dict[str, int | str]:
        preview = self.preview_import_from_file(
            source=source,
            file_content=file_content,
            filename=filename,
            current_user=current_user,
        )

        return self._commit_preview(
            source=source,
            filename=filename,
            preview=preview,
            current_user=current_user,
        )

    def commit_import(
        self,
        source: str,
        csv_content: str,
        filename: str,
        current_user: CurrentUser | None = None,
    ) -> dict[str, int | str]:
        preview = self.preview_import(
            source=source,
            csv_content=csv_content,
            current_user=current_user,
        )

        return self._commit_preview(
            source=source,
            filename=filename,
            preview=preview,
            current_user=current_user,
        )

    def _parse_file(
        self,
        source: str,
        file_content: bytes,
        filename: str,
    ) -> ImportParseResult:
        source = source.strip().lower()

        if source == "activobank":
            transactions = self._parse_activobank_file(
                file_content=file_content,
                filename=filename,
            )
            return ImportParseResult(transactions=transactions)

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
    ) -> ImportParseResult:
        source = source.strip().lower()
        importer = self._get_csv_importer(source)

        try:
            if source == "trading212":
                return importer.parse_full(csv_content)

            return ImportParseResult(transactions=importer.parse(csv_content))
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(error),
            ) from error

    def _build_preview_response(
        self,
        source: str,
        parse_result: ImportParseResult,
        current_user: CurrentUser | None = None,
    ) -> ImportPreviewResponse:
        preview_transactions: list[ImportPreviewTransaction] = []
        preview_investment_events: list[ImportPreviewInvestmentEvent] = []
        invalid_rows: list[ImportInvalidRow] = []
        seen_transaction_hashes: set[str] = set()
        seen_event_hashes: set[str] = set()

        for index, transaction in enumerate(parse_result.transactions, start=1):
            try:
                preview_row = self._build_preview_row(
                    row_number=index,
                    transaction=transaction,
                    seen_hashes=seen_transaction_hashes,
                    current_user=current_user,
                )
                preview_transactions.append(preview_row)
                seen_transaction_hashes.add(preview_row.dedupe_hash)
            except ValueError as error:
                invalid_rows.append(
                    ImportInvalidRow(
                        row_number=index,
                        error=str(error),
                    )
                )

        event_start_index = len(parse_result.transactions) + 1

        for index, event in enumerate(parse_result.investment_events, start=event_start_index):
            try:
                preview_event = self._build_preview_investment_event(
                    row_number=index,
                    event=event,
                    seen_hashes=seen_event_hashes,
                    current_user=current_user,
                )
                preview_investment_events.append(preview_event)
                seen_event_hashes.add(preview_event.dedupe_hash)
            except ValueError as error:
                invalid_rows.append(
                    ImportInvalidRow(
                        row_number=index,
                        error=str(error),
                    )
                )

        rows_duplicates = sum(
            1 for transaction in preview_transactions if transaction.is_duplicate
        ) + sum(
            1 for event in preview_investment_events if event.is_duplicate
        )

        rows_total = len(parse_result.transactions) + len(parse_result.investment_events)
        rows_valid = len(preview_transactions) + len(preview_investment_events)

        return ImportPreviewResponse(
            source=source,
            rows_total=rows_total,
            rows_valid=rows_valid,
            rows_duplicates=rows_duplicates,
            rows_invalid=len(invalid_rows),
            transactions=preview_transactions,
            investment_events=preview_investment_events,
            invalid_rows=invalid_rows,
        )

    def _commit_preview(
        self,
        source: str,
        filename: str,
        preview: ImportPreviewResponse,
        current_user: CurrentUser | None = None,
    ) -> dict[str, int | str]:
        self._raise_for_pending_fx(preview)

        rows_skipped = preview.rows_duplicates + preview.rows_invalid
        rows_inserted = len(
            [
                preview_transaction
                for preview_transaction in preview.transactions
                if not preview_transaction.is_duplicate
            ]
        ) + len(
            [
                preview_event
                for preview_event in preview.investment_events
                if not preview_event.is_duplicate
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
            user_id=self._get_user_id(current_user),
        )

        transactions_to_insert = self._build_transactions_to_insert(
            import_batch_id=import_batch.id,
            preview=preview,
            current_user=current_user,
        )
        investment_events_to_insert = self._build_investment_events_to_insert(
            import_batch_id=import_batch.id,
            preview=preview,
            current_user=current_user,
        )

        if transactions_to_insert:
            self.transaction_repository.bulk_insert(
                transactions_to_insert,
                user_id=self._get_user_id(current_user),
            )

        if investment_events_to_insert and self.investment_event_repository is not None:
            self.investment_event_repository.bulk_insert(
                investment_events_to_insert,
                user_id=self._get_user_id(current_user),
            )

        return {
            "import_batch_id": import_batch.id,
            "source": source,
            "rows_total": preview.rows_total,
            "rows_inserted": len(transactions_to_insert) + len(investment_events_to_insert),
            "rows_skipped": rows_skipped,
            "transactions_inserted": len(transactions_to_insert),
            "investment_events_inserted": len(investment_events_to_insert),
        }

    def _raise_for_pending_fx(self, preview: ImportPreviewResponse) -> None:
        pending_transaction_rows = [
            preview_transaction.row_number
            for preview_transaction in preview.transactions
            if (
                not preview_transaction.is_duplicate
                and preview_transaction.fx_rate_source == "pending"
            )
        ]
        if not pending_transaction_rows:
            return

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Import contains transaction rows with pending FX conversion. Preview is allowed, but commit is blocked until EUR conversion is resolved.",
                "pending_transaction_rows": pending_transaction_rows,
                "pending_investment_event_rows": [],
            },
        )

    def _build_transactions_to_insert(
        self,
        import_batch_id: int,
        preview: ImportPreviewResponse,
        current_user: CurrentUser | None = None,
    ) -> list[Transaction]:
        transactions_to_insert: list[Transaction] = []

        for preview_transaction in preview.transactions:
            if preview_transaction.is_duplicate:
                continue

            transactions_to_insert.append(
                Transaction(
                    user_id=self._get_user_id(current_user),
                    date=preview_transaction.date,
                    description=preview_transaction.description,
                    raw_description=preview_transaction.raw_description,
                    amount=preview_transaction.amount,
                    original_amount=preview_transaction.original_amount,
                    original_currency=preview_transaction.original_currency,
                    fx_rate_to_eur=preview_transaction.fx_rate_to_eur,
                    fx_rate_source=preview_transaction.fx_rate_source,
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

    def _build_investment_events_to_insert(
        self,
        import_batch_id: int,
        preview: ImportPreviewResponse,
        current_user: CurrentUser | None = None,
    ) -> list[InvestmentEvent]:
        events_to_insert: list[InvestmentEvent] = []

        for preview_event in preview.investment_events:
            if preview_event.is_duplicate:
                continue

            events_to_insert.append(
                InvestmentEvent(
                    user_id=self._get_user_id(current_user),
                    date=preview_event.date,
                    source=preview_event.source,
                    account=preview_event.account,
                    event_type=preview_event.event_type,
                    description=preview_event.description,
                    raw_description=preview_event.raw_description,
                    instrument_name=preview_event.instrument_name,
                    ticker=preview_event.ticker,
                    isin=preview_event.isin,
                    quantity=preview_event.quantity,
                    price=preview_event.price,
                    fees=preview_event.fees,
                    taxes=preview_event.taxes,
                    amount=preview_event.amount,
                    currency=preview_event.currency,
                    original_amount=preview_event.original_amount,
                    original_currency=preview_event.original_currency,
                    fx_rate_to_eur=preview_event.fx_rate_to_eur,
                    fx_rate_source=preview_event.fx_rate_source,
                    transaction_id=preview_event.transaction_id,
                    funding_source=preview_event.funding_source,
                    funding_match_status=preview_event.funding_match_status,
                    matched_transaction_id=preview_event.matched_transaction_id,
                    external_id=preview_event.external_id,
                    dedupe_hash=preview_event.dedupe_hash,
                    import_batch_id=import_batch_id,
                    notes=preview_event.notes,
                )
            )

        return events_to_insert

    def _build_preview_row(
        self,
        row_number: int,
        transaction: NormalisedTransaction,
        seen_hashes: set[str],
        current_user: CurrentUser | None = None,
    ) -> ImportPreviewTransaction:
        dedupe_hash = self.dedupe_service.create_hash(transaction)
        is_duplicate = (
            self.dedupe_service.is_duplicate(
                dedupe_hash,
                self._get_user_id(current_user),
            )
            or dedupe_hash in seen_hashes
        )
        category, _subcategory = self._guess_category(transaction, current_user)

        return ImportPreviewTransaction(
            row_number=row_number,
            date=transaction.date,
            raw_description=transaction.raw_description,
            description=transaction.description,
            amount=transaction.amount,
            original_amount=transaction.original_amount,
            original_currency=transaction.original_currency,
            fx_rate_to_eur=transaction.fx_rate_to_eur,
            fx_rate_source=transaction.fx_rate_source,
            direction=transaction.direction,
            cashflow_type=self._get_cashflow_type(transaction),
            source=transaction.source,
            account=transaction.account,
            currency=transaction.currency,
            external_id=transaction.external_id,
            notes=transaction.notes,
            dedupe_hash=dedupe_hash,
            is_duplicate=is_duplicate,
            category=category,
        )

    def _build_preview_investment_event(
        self,
        row_number: int,
        event: NormalisedInvestmentEvent,
        seen_hashes: set[str],
        current_user: CurrentUser | None = None,
    ) -> ImportPreviewInvestmentEvent:
        dedupe_hash = self.dedupe_service.create_investment_event_hash(event)
        is_duplicate = (
            self.dedupe_service.is_duplicate_investment_event(
                dedupe_hash,
                self._get_user_id(current_user),
            )
            or dedupe_hash in seen_hashes
        )

        return ImportPreviewInvestmentEvent(
            row_number=row_number,
            date=event.date,
            source=event.source,
            account=event.account,
            event_type=event.event_type,
            description=event.description,
            raw_description=event.raw_description,
            instrument_name=event.instrument_name,
            ticker=event.ticker,
            isin=event.isin,
            quantity=event.quantity,
            price=event.price,
            fees=event.fees,
            taxes=event.taxes,
            amount=event.amount,
            currency=event.currency,
            original_amount=event.original_amount,
            original_currency=event.original_currency,
            fx_rate_to_eur=event.fx_rate_to_eur,
            fx_rate_source=event.fx_rate_source,
            transaction_id=event.transaction_id,
            funding_source=event.funding_source,
            funding_match_status=event.funding_match_status,
            matched_transaction_id=event.matched_transaction_id,
            external_id=event.external_id,
            notes=event.notes,
            dedupe_hash=dedupe_hash,
            is_duplicate=is_duplicate,
        )

    def _get_cashflow_type(self, transaction: NormalisedTransaction) -> str:
        if transaction.cashflow_type is not None:
            return transaction.cashflow_type

        if transaction.direction == "in":
            return "income"

        return "expense"

    def _guess_category(
        self,
        transaction: NormalisedTransaction,
        current_user: CurrentUser | None = None,
    ) -> tuple[str | None, str | None]:
        if self.category_rule_service is None:
            return None, None

        return self.category_rule_service.guess_category(transaction, current_user)

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


    def _get_user_id(self, current_user: CurrentUser | None) -> str:
        if current_user is None:
            return LOCAL_DEFAULT_USER_ID

        return current_user.id
