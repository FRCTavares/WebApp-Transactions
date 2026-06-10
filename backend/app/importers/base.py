from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Protocol


@dataclass(frozen=True)
class NormalisedTransaction:
    date: date
    raw_description: str
    description: str
    amount: Decimal
    direction: str
    source: str
    account: str | None
    currency: str
    cashflow_type: str | None = None
    external_id: str | None = None
    notes: str | None = None


class TransactionImporter(Protocol):
    source: str

    def parse(self, csv_content: str) -> list[NormalisedTransaction]:
        pass
