from app.importers.base import NormalisedTransaction
from app.repositories.transaction_repository import TransactionRepository
from app.utils.hashing import create_dedupe_hash


class DedupeService:
    def __init__(self, transaction_repository: TransactionRepository) -> None:
        self.transaction_repository = transaction_repository

    def create_hash(self, transaction: NormalisedTransaction) -> str:
        return create_dedupe_hash(
            source=transaction.source,
            transaction_date=transaction.date,
            amount=transaction.amount,
            direction=transaction.direction,
            raw_description=transaction.raw_description,
            currency=transaction.currency,
        )

    def is_duplicate(self, dedupe_hash: str) -> bool:
        return self.transaction_repository.exists_by_dedupe_hash(dedupe_hash)
