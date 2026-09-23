from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.investment_event import InvestmentEvent
from app.models.owed_payment import OwedPayment
from app.models.transaction import Transaction
from app.models.trip_savings_allocation import TripSavingsAllocation
from app.models.user_preferences import UserPreferences


DEFAULT_TRIP_SAVINGS_GOAL = Decimal("50.00")


class TripSavingsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_allocation(
        self,
        *,
        user_id: str,
        month: str,
    ) -> TripSavingsAllocation | None:
        statement = (
            select(TripSavingsAllocation)
            .where(TripSavingsAllocation.user_id == user_id)
            .where(TripSavingsAllocation.month == month)
        )
        return self.db.scalar(statement)

    def get_default_goal(self, *, user_id: str) -> Decimal:
        preferences = self.db.get(UserPreferences, user_id)

        if preferences is None:
            return DEFAULT_TRIP_SAVINGS_GOAL

        return Decimal(str(preferences.monthly_trip_savings_goal_eur))

    def get_history_start(self, *, user_id: str) -> date | None:
        candidates: list[date] = []

        preferences = self.db.get(UserPreferences, user_id)
        if preferences is not None and preferences.created_at is not None:
            candidates.append(preferences.created_at.date())

        dated_columns = (
            (Transaction, Transaction.date),
            (InvestmentEvent, InvestmentEvent.date),
            (OwedPayment, OwedPayment.payment_date),
        )

        for model, column in dated_columns:
            value = self.db.scalar(
                select(func.min(column)).where(model.user_id == user_id)
            )
            if isinstance(value, datetime):
                candidates.append(value.date())
            elif isinstance(value, date):
                candidates.append(value)

        return min(candidates) if candidates else None

    def list_months(
        self,
        *,
        user_id: str,
        start_month: str,
        before_month: str,
    ) -> set[str]:
        statement = (
            select(TripSavingsAllocation.month)
            .where(TripSavingsAllocation.user_id == user_id)
            .where(TripSavingsAllocation.month >= start_month)
            .where(TripSavingsAllocation.month < before_month)
        )
        return set(self.db.scalars(statement).all())

    def add_default_snapshot(
        self,
        *,
        user_id: str,
        month: str,
        goal_eur: Decimal,
    ) -> TripSavingsAllocation:
        allocation = TripSavingsAllocation(
            user_id=user_id,
            month=month,
            amount_eur=goal_eur,
            goal_eur=goal_eur,
            source="default",
        )
        self.db.add(allocation)
        return allocation

    def upsert_allocation(
        self,
        *,
        user_id: str,
        month: str,
        amount_eur: Decimal,
        goal_eur: Decimal,
        source: str,
    ) -> TripSavingsAllocation:
        allocation = self.get_allocation(user_id=user_id, month=month)

        if allocation is None:
            allocation = TripSavingsAllocation(
                user_id=user_id,
                month=month,
                amount_eur=amount_eur,
                goal_eur=goal_eur,
                source=source,
            )
            self.db.add(allocation)
            return allocation

        allocation.amount_eur = amount_eur
        allocation.goal_eur = goal_eur
        allocation.source = source
        return allocation

    def update_rows_for_new_default(
        self,
        *,
        user_id: str,
        from_month: str,
        goal_eur: Decimal,
    ) -> None:
        statement = (
            select(TripSavingsAllocation)
            .where(TripSavingsAllocation.user_id == user_id)
            .where(TripSavingsAllocation.month >= from_month)
        )

        for allocation in self.db.scalars(statement):
            allocation.goal_eur = goal_eur
            if allocation.source == "default":
                allocation.amount_eur = goal_eur
