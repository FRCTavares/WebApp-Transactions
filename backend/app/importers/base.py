from dataclasses import dataclass, field
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
    original_amount: Decimal | None = None
    original_currency: str | None = None
    fx_rate_to_eur: Decimal | None = None
    fx_rate_source: str | None = None
    cashflow_type: str | None = None
    external_id: str | None = None
    notes: str | None = None


@dataclass(frozen=True)
class NormalisedInvestmentEvent:
    date: date
    source: str
    account: str | None
    event_type: str
    description: str
    raw_description: str
    amount: Decimal
    currency: str
    instrument_name: str | None = None
    ticker: str | None = None
    isin: str | None = None
    quantity: Decimal | None = None
    price: Decimal | None = None
    fees: Decimal | None = None
    taxes: Decimal | None = None
    original_amount: Decimal | None = None
    original_currency: str | None = None
    fx_rate_to_eur: Decimal | None = None
    fx_rate_source: str | None = None
    transaction_id: int | None = None
    funding_source: str | None = None
    funding_match_status: str | None = None
    matched_transaction_id: int | None = None
    external_id: str | None = None
    notes: str | None = None


@dataclass(frozen=True)
class ImportParseResult:
    transactions: list[NormalisedTransaction] = field(default_factory=list)
    investment_events: list[NormalisedInvestmentEvent] = field(default_factory=list)


class TransactionImporter(Protocol):
    source: str

    def parse(self, csv_content: str) -> list[NormalisedTransaction]:
        pass
