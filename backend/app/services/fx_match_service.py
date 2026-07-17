from datetime import timedelta
from decimal import Decimal

from fastapi import HTTPException, status

from app.auth.current_user import CurrentUser
from app.models.transaction import Transaction
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.fx_match import (
    FxMatchCandidate,
    FxMatchPreviewResponse,
    PendingFxDepositMatch,
)
from app.schemas.import_preview import ImportPreviewInvestmentEvent
from app.services.import_fx_resolution_service import (
    ImportFxResolutionService,
)
from app.services.import_service import ImportService


class FxMatchService:
    def __init__(
        self,
        transaction_repository: TransactionRepository,
        import_service: ImportService,
        fx_resolution_service: ImportFxResolutionService,
    ) -> None:
        self.transaction_repository = transaction_repository
        self.import_service = import_service
        self.fx_resolution_service = fx_resolution_service

    def preview_matches_from_file(
        self,
        source: str,
        file_content: bytes,
        filename: str,
        current_user: CurrentUser,
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
            current_user=current_user,
        )

        pending_deposits = [
            event
            for event in preview.investment_events
            if self._is_pending_trading212_deposit(event)
        ]

        return FxMatchPreviewResponse(
            source=source,
            pending_deposits=[
                self._build_pending_deposit_match(
                    transaction,
                    current_user.id,
                )
                for transaction in pending_deposits
            ],
        )

    def _is_pending_trading212_deposit(
        self,
        transaction: ImportPreviewInvestmentEvent,
    ) -> bool:
        return (
            not transaction.is_duplicate
            and transaction.source == "trading212"
            and transaction.event_type == "deposit"
            and transaction.fx_rate_source == "pending"
        )

    def _build_pending_deposit_match(
        self,
        pending_deposit: ImportPreviewInvestmentEvent,
        user_id: str,
    ) -> PendingFxDepositMatch:
        resolved_rate = self.fx_resolution_service.resolve_rate_to_eur(
            currency=pending_deposit.currency,
            value_date=pending_deposit.date,
        )

        if resolved_rate is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Historical FX rate is unavailable for "
                    f"{pending_deposit.currency.upper()} on "
                    f"{pending_deposit.date.isoformat()}"
                ),
            )

        fx_rate_to_eur, _ = resolved_rate
        candidates = self.transaction_repository.list_fx_match_candidates(
            target_date=pending_deposit.date,
            source="activobank",
            days_window=3,
            limit=20,
            user_id=user_id,
        )

        ranked_candidates = sorted(
            [
                self._build_candidate(
                    pending_deposit=pending_deposit,
                    transaction=transaction,
                    fx_rate_to_eur=fx_rate_to_eur,
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
        pending_deposit: ImportPreviewInvestmentEvent,
        transaction: Transaction,
        fx_rate_to_eur: Decimal,
    ) -> FxMatchCandidate:
        date_distance_days = abs((transaction.date - pending_deposit.date).days)
        score = self._score_candidate(
            pending_deposit=pending_deposit,
            transaction=transaction,
            date_distance_days=date_distance_days,
            fx_rate_to_eur=fx_rate_to_eur,
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
        pending_deposit: ImportPreviewInvestmentEvent,
        transaction: Transaction,
        date_distance_days: int,
        fx_rate_to_eur: Decimal,
    ) -> Decimal:
        score = Decimal(date_distance_days * 10)

        if pending_deposit.currency.upper() == "USD" and transaction.currency.upper() == "EUR":
            expected_eur = pending_deposit.amount * fx_rate_to_eur

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
