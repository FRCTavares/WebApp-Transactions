from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.importers.base import NormalisedInvestmentEvent, NormalisedTransaction
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.repositories.transaction_repository import TransactionRepository
from app.utils.hashing import create_dedupe_hash, create_investment_event_dedupe_hash


class DedupeService:
    def __init__(
        self,
        transaction_repository: TransactionRepository,
        investment_event_repository: InvestmentEventRepository | None = None,
    ) -> None:
        self.transaction_repository = transaction_repository
        self.investment_event_repository = investment_event_repository

    def create_hash(self, transaction: NormalisedTransaction) -> str:
        return create_dedupe_hash(
            source=transaction.source,
            transaction_date=transaction.date,
            amount=transaction.amount,
            direction=transaction.direction,
            raw_description=transaction.raw_description,
            currency=transaction.currency,
        )

    def create_investment_event_hash(self, event: NormalisedInvestmentEvent) -> str:
        return create_investment_event_dedupe_hash(
            source=event.source,
            event_date=event.date,
            amount=event.amount,
            event_type=event.event_type,
            raw_description=event.raw_description,
            currency=event.currency,
        )

    def is_duplicate(
        self,
        dedupe_hash: str,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> bool:
        return self.transaction_repository.exists_by_dedupe_hash(dedupe_hash, user_id)

    def is_duplicate_investment_event(
        self,
        dedupe_hash: str,
        user_id: str,
    ) -> bool:
        if self.investment_event_repository is None:
            return False

        return self.investment_event_repository.exists_by_dedupe_hash(
            dedupe_hash,
            user_id,
        )
