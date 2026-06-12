from datetime import timedelta
from decimal import Decimal

from fastapi import HTTPException, status

from app.models.transaction import Transaction
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.fx_match import (
    FxMatchCandidate,
    FxMatchPreviewResponse,
    PendingFxDepositMatch,
)
from app.schemas.import_preview import ImportPreviewTransaction
from app.services.import_service import ImportService


class FxMatchService:
    def __init__(
        self,
        transaction_repository: TransactionRepository,
        import_service: ImportService,
    ) -> None:
        self.transaction_repository = transaction_repository
        self.import_service = import_service

    def preview_matches_from_file(
        self,
        source: str,
        file_content: bytes,
        filename: str,
    ) -> FxMatchPreviewResponse:
        source = source.strip().lower()

        if source != "trading212":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="FX match preview is currently only supported for Trading 212 imports",
            )

        preview = self.import_service.preview_import_from_file(
            source=source,
            file_content=file_content,
            filename=filename,
        )

        pending_deposits = [
            transaction
            for transaction in preview.transactions
            if self._is_pending_trading212_deposit(transaction)
        ]

        return FxMatchPreviewResponse(
            source=source,
            pending_deposits=[
                self._build_pending_deposit_match(transaction)
                for transaction in pending_deposits
            ],
        )

    def _is_pending_trading212_deposit(
        self,
        transaction: ImportPreviewTransaction,
    ) -> bool:
        return (
            not transaction.is_duplicate
            and transaction.source == "trading212"
            and transaction.direction == "out"
            and transaction.cashflow_type == "investment"
            and transaction.fx_rate_source == "pending"
        )

    def _build_pending_deposit_match(
        self,
        pending_deposit: ImportPreviewTransaction,
    ) -> PendingFxDepositMatch:
        candidates = self.transaction_repository.list_fx_match_candidates(
            target_date=pending_deposit.date,
            source="activobank",
            days_window=3,
            limit=20,
        )

        ranked_candidates = sorted(
            [
                self._build_candidate(
                    pending_deposit=pending_deposit,
                    transaction=transaction,
                )
                for transaction in candidates
            ],
            key=lambda candidate: candidate.score,
        )

        return PendingFxDepositMatch(
            row_number=pending_deposit.row_number,
            date=pending_deposit.date,
            description=pending_deposit.description,
            raw_description=pending_deposit.raw_description,
            amount=pending_deposit.amount,
            currency=pending_deposit.currency,
            original_amount=pending_deposit.original_amount,
            original_currency=pending_deposit.original_currency,
            candidates=ranked_candidates,
        )

    def _build_candidate(
        self,
        pending_deposit: ImportPreviewTransaction,
        transaction: Transaction,
    ) -> FxMatchCandidate:
        date_distance_days = abs((transaction.date - pending_deposit.date).days)
        score = self._score_candidate(
            pending_deposit=pending_deposit,
            transaction=transaction,
            date_distance_days=date_distance_days,
        )

        return FxMatchCandidate(
            transaction_id=transaction.id,
            date=transaction.date,
            description=transaction.description,
            raw_description=transaction.raw_description,
            amount=transaction.amount,
            currency=transaction.currency,
            source=transaction.source,
            account=transaction.account,
            cashflow_type=transaction.cashflow_type,
            date_distance_days=date_distance_days,
            score=score,
        )

    def _score_candidate(
        self,
        pending_deposit: ImportPreviewTransaction,
        transaction: Transaction,
        date_distance_days: int,
    ) -> Decimal:
        score = Decimal(date_distance_days * 10)

        if pending_deposit.currency.upper() == "USD" and transaction.currency.upper() == "EUR":
            expected_eur = pending_deposit.amount * Decimal("0.92")

            if expected_eur > 0:
                amount_distance = abs(transaction.amount - expected_eur) / expected_eur
                score += amount_distance * Decimal("100")

        description = f"{transaction.description} {transaction.raw_description}".lower()

        if (
            "trading" not in description
            and "t212" not in description
            and "212" not in description
        ):
            score += Decimal("5")

        return score.quantize(Decimal("0.0001"))
