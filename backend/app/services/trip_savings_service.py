from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.trip_savings_allocation import TripSavingsAllocation
from app.repositories.trip_savings_repository import TripSavingsRepository


CENT = Decimal("0.01")


@dataclass(frozen=True)
class ResolvedTripSavings:
    month: str
    amount_eur: Decimal
    goal_eur: Decimal
    source: str


class TripSavingsService:
    def __init__(
        self,
        db: Session,
        repository: TripSavingsRepository,
    ) -> None:
        self.db = db
        self.repository = repository

    def resolve_month(
        self,
        *,
        user_id: str,
        month: str,
    ) -> ResolvedTripSavings:
        allocation = self.repository.get_allocation(
            user_id=user_id,
            month=month,
        )

        if allocation is not None:
            return ResolvedTripSavings(
                month=month,
                amount_eur=self._money(allocation.amount_eur),
                goal_eur=self._money(allocation.goal_eur),
                source=allocation.source,
            )

        goal = self._money(
            self.repository.get_default_goal(user_id=user_id)
        )
        return ResolvedTripSavings(
            month=month,
            amount_eur=goal,
            goal_eur=goal,
            source="default",
        )

    def set_month(
        self,
        *,
        user_id: str,
        month: str,
        amount_eur: Decimal | None,
    ) -> TripSavingsAllocation:
        existing = self.repository.get_allocation(
            user_id=user_id,
            month=month,
        )
        goal = self._money(
            existing.goal_eur
            if existing is not None
            else self.repository.get_default_goal(user_id=user_id)
        )

        if amount_eur is None:
            effective_amount = goal
            source = "default"
        else:
            effective_amount = self._money(amount_eur)
            source = "override"

        try:
            allocation = self.repository.upsert_allocation(
                user_id=user_id,
                month=month,
                amount_eur=effective_amount,
                goal_eur=goal,
                source=source,
            )
            self.db.commit()
            self.db.refresh(allocation)
            return allocation
        except Exception:
            self.db.rollback()
            raise

    def snapshot_historical_defaults(
        self,
        *,
        user_id: str,
        default_goal_eur: Decimal,
        before_month: str,
    ) -> None:
        history_start = self.repository.get_history_start(user_id=user_id)

        if history_start is None:
            return

        start_month = f"{history_start.year:04d}-{history_start.month:02d}"
        if start_month >= before_month:
            return

        existing_months = self.repository.list_months(
            user_id=user_id,
            start_month=start_month,
            before_month=before_month,
        )
        goal = self._money(default_goal_eur)

        month = start_month
        while month < before_month:
            if month not in existing_months:
                self.repository.add_default_snapshot(
                    user_id=user_id,
                    month=month,
                    goal_eur=goal,
                )
            month = self._next_month(month)

    def apply_new_default_to_current_and_future(
        self,
        *,
        user_id: str,
        from_month: str,
        new_goal_eur: Decimal,
    ) -> None:
        self.repository.update_rows_for_new_default(
            user_id=user_id,
            from_month=from_month,
            goal_eur=self._money(new_goal_eur),
        )

    @staticmethod
    def _next_month(month: str) -> str:
        year, month_number = (int(part) for part in month.split("-"))

        if month_number == 12:
            return f"{year + 1:04d}-01"

        return f"{year:04d}-{month_number + 1:02d}"

    @staticmethod
    def _money(value: Decimal) -> Decimal:
        return Decimal(str(value)).quantize(CENT)
