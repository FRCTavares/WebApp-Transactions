from datetime import date
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.investment_event import InvestmentEvent
from app.models.investment_funding_month import InvestmentFundingMonth
from app.models.owed_item import OwedItem
from app.models.owed_payment import OwedPayment, OwedPaymentAllocation
from app.models.transaction import Transaction


RESET_COUNT_KEYS = [
    "transactions",
    "owed_items",
    "owed_payments",
    "owed_payment_allocations",
    "investment_events",
    "investment_funding_months",
]


class MonthResetRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_reset_ids(
        self,
        *,
        user_id: str,
        start_date: date,
        end_date: date,
        month_label: str,
    ) -> dict[str, list[int]]:
        transaction_ids = self._list_ids(
            select(Transaction.id)
            .where(Transaction.user_id == user_id)
            .where(Transaction.date >= start_date)
            .where(Transaction.date < end_date)
        )

        owed_item_ids = self._list_ids(
            select(OwedItem.id)
            .where(OwedItem.user_id == user_id)
            .where(OwedItem.linked_transaction_id.in_(transaction_ids))
        )

        directly_relevant_payment_ids = self._list_ids(
            select(OwedPayment.id)
            .where(OwedPayment.user_id == user_id)
            .where(
                (OwedPayment.payment_date >= start_date)
                & (OwedPayment.payment_date < end_date)
                | OwedPayment.linked_transaction_id.in_(transaction_ids)
            )
        )

        payment_ids_from_owed_items = self._list_ids(
            select(OwedPaymentAllocation.owed_payment_id)
            .where(OwedPaymentAllocation.user_id == user_id)
            .where(OwedPaymentAllocation.owed_item_id.in_(owed_item_ids))
        )

        owed_payment_ids = sorted(
            set(directly_relevant_payment_ids) | set(payment_ids_from_owed_items)
        )

        owed_payment_allocation_ids = self._list_ids(
            select(OwedPaymentAllocation.id)
            .where(OwedPaymentAllocation.user_id == user_id)
            .where(
                OwedPaymentAllocation.owed_payment_id.in_(owed_payment_ids)
                | OwedPaymentAllocation.owed_item_id.in_(owed_item_ids)
            )
        )

        investment_event_ids = self._list_ids(
            select(InvestmentEvent.id)
            .where(InvestmentEvent.user_id == user_id)
            .where(InvestmentEvent.date >= start_date)
            .where(InvestmentEvent.date < end_date)
        )

        investment_funding_month_ids = self._list_ids(
            select(InvestmentFundingMonth.id)
            .where(InvestmentFundingMonth.user_id == user_id)
            .where(InvestmentFundingMonth.month == month_label)
        )

        return {
            "transactions": transaction_ids,
            "owed_items": owed_item_ids,
            "owed_payments": owed_payment_ids,
            "owed_payment_allocations": owed_payment_allocation_ids,
            "investment_events": investment_event_ids,
            "investment_funding_months": investment_funding_month_ids,
        }

    def count_reset_rows(
        self,
        *,
        user_id: str,
        start_date: date,
        end_date: date,
        month_label: str,
    ) -> dict[str, int]:
        reset_ids = self.get_reset_ids(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            month_label=month_label,
        )

        return {key: len(reset_ids[key]) for key in RESET_COUNT_KEYS}

    def delete_reset_rows(
        self,
        *,
        user_id: str,
        start_date: date,
        end_date: date,
        month_label: str,
    ) -> dict[str, int]:
        reset_ids = self.get_reset_ids(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            month_label=month_label,
        )

        deleted = {key: 0 for key in RESET_COUNT_KEYS}

        deleted["owed_payment_allocations"] = self._delete_by_ids(
            OwedPaymentAllocation,
            reset_ids["owed_payment_allocations"],
        )
        deleted["owed_payments"] = self._delete_by_ids(
            OwedPayment,
            reset_ids["owed_payments"],
        )
        deleted["owed_items"] = self._delete_by_ids(
            OwedItem,
            reset_ids["owed_items"],
        )
        deleted["investment_events"] = self._delete_by_ids(
            InvestmentEvent,
            reset_ids["investment_events"],
        )
        deleted["investment_funding_months"] = self._delete_by_ids(
            InvestmentFundingMonth,
            reset_ids["investment_funding_months"],
        )
        deleted["transactions"] = self._delete_by_ids(
            Transaction,
            reset_ids["transactions"],
        )

        return deleted

    def _list_ids(self, statement: Any) -> list[int]:
        return [int(row_id) for row_id in self.db.scalars(statement).all()]

    def _delete_by_ids(self, model: Any, row_ids: list[int]) -> int:
        if not row_ids:
            return 0

        result = self.db.execute(
            delete(model)
            .where(model.id.in_(row_ids))
            .execution_options(synchronize_session=False)
        )

        return int(result.rowcount or 0)
