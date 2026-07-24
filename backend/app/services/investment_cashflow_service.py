"""Authoritative monthly investment cash-flow calculation.

Only broker deposits and withdrawals move personal cash into or out of the
investment account. Purchases, sales, dividends, interest, fees, taxes, FX
conversions, and market-value changes are investment-account activity and do
not change contributed personal cash.

When an investment event is linked to a bank transaction, the investment event
is authoritative. The bank transaction is reconciliation provenance and must
not be counted as a second economic movement.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Literal

from app.models.investment_event import InvestmentEvent
from app.repositories.investment_event_repository import (
    InvestmentEventRepository,
)
from app.repositories.transaction_repository import TransactionRepository


MONEY_QUANTUM = Decimal("0.01")
CASH_EVENT_TYPES = {"deposit", "withdrawal"}

InvestmentCashflowStatus = Literal["available", "unavailable"]
InvestmentReconciliationStatus = Literal[
    "not_applicable",
    "complete",
    "partial",
]


@dataclass(frozen=True)
class InvestmentCashflowResult:
    net_invested_cash: Decimal | None
    cashflow_status: InvestmentCashflowStatus
    reconciliation_status: InvestmentReconciliationStatus


class InvestmentCashflowService:
    def __init__(
        self,
        investment_event_repository: InvestmentEventRepository,
        transaction_repository: TransactionRepository,
    ) -> None:
        self.investment_event_repository = investment_event_repository
        self.transaction_repository = transaction_repository

    def calculate_month(
        self,
        start_date: date,
        end_date: date,
        *,
        user_id: str,
    ) -> InvestmentCashflowResult:
        events = [
            event
            for event in self.investment_event_repository.list_between(
                start_date=start_date,
                end_date=end_date,
                user_id=user_id,
            )
            if event.event_type in CASH_EVENT_TYPES
        ]

        reconciliation_status = self._get_reconciliation_status(
            events,
            user_id=user_id,
        )
        net_invested_cash = Decimal("0")

        for event in events:
            amount_eur = self._get_amount_eur(event)

            if amount_eur is None:
                return InvestmentCashflowResult(
                    net_invested_cash=None,
                    cashflow_status="unavailable",
                    reconciliation_status=reconciliation_status,
                )

            if event.event_type == "deposit":
                net_invested_cash += amount_eur
            else:
                net_invested_cash -= amount_eur

        return InvestmentCashflowResult(
            net_invested_cash=net_invested_cash.quantize(
                MONEY_QUANTUM
            ),
            cashflow_status="available",
            reconciliation_status=reconciliation_status,
        )

    @staticmethod
    def _get_amount_eur(
        event: InvestmentEvent,
    ) -> Decimal | None:
        if event.currency.upper() == "EUR":
            return event.amount

        if (
            event.fx_rate_to_eur is None
            or event.fx_rate_to_eur <= 0
            or event.fx_rate_source == "pending"
        ):
            return None

        return event.amount * event.fx_rate_to_eur

    def _get_reconciliation_status(
        self,
        events: list[InvestmentEvent],
        *,
        user_id: str,
    ) -> InvestmentReconciliationStatus:
        if not events:
            return "not_applicable"

        has_reconciliation_metadata = False

        for event in events:
            link_ids = {
                link_id
                for link_id in (
                    event.transaction_id,
                    event.matched_transaction_id,
                )
                if link_id is not None
            }
            has_event_metadata = bool(
                event.funding_source
                or event.funding_match_status
                or link_ids
            )
            has_reconciliation_metadata = (
                has_reconciliation_metadata or has_event_metadata
            )

            if not has_event_metadata:
                continue

            if event.funding_match_status == "unmatched":
                return "partial"

            if len(link_ids) != 1:
                return "partial"

            transaction_id = next(iter(link_ids))

            if (
                self.transaction_repository.get_by_id(
                    transaction_id,
                    user_id=user_id,
                )
                is None
            ):
                return "partial"

        if has_reconciliation_metadata:
            return "complete"

        return "not_applicable"
