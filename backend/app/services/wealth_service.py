from calendar import monthrange
from collections import defaultdict
from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status

from app.auth.current_user import CurrentUser
from app.models.wealth_account import WealthAccount
from app.models.wealth_snapshot import WealthSnapshot
from app.repositories.owed_repository import OwedRepository
from app.repositories.wealth_repository import WealthRepository
from app.services.investment_event_service import InvestmentEventService
from app.schemas.wealth import (
    WealthAccountCreate,
    WealthAccountUpdate,
    WealthMonthlyRead,
    WealthSnapshotCreate,
    WealthSnapshotUpdate,
    WealthSummaryRead,
)


class WealthService:
    def __init__(
        self,
        repository: WealthRepository,
        owed_repository: OwedRepository | None = None,
        investment_event_service: InvestmentEventService | None = None,
    ) -> None:
        self.repository = repository
        self.owed_repository = owed_repository
        self.investment_event_service = investment_event_service

    def create_account(
        self,
        account_data: WealthAccountCreate,
        *,
        current_user: CurrentUser,
    ) -> WealthAccount:
        account_data = account_data.model_copy(
            update={"currency": account_data.currency.upper()}
        )
        return self.repository.create_account(
            account_data,
            user_id=current_user.id,
        )

    def list_accounts(
        self,
        active_only: bool = False,
        limit: int = 100,
        offset: int = 0,
        *,
        current_user: CurrentUser,
    ) -> list[WealthAccount]:
        return self.repository.list_accounts(
            active_only=active_only,
            limit=limit,
            offset=offset,
            user_id=current_user.id,
        )

    def get_account(
        self,
        account_id: int,
        *,
        current_user: CurrentUser,
    ) -> WealthAccount:
        account = self.repository.get_account_by_id(
            account_id,
            user_id=current_user.id,
        )

        if account is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wealth account not found",
            )

        return account

    def update_account(
        self,
        account_id: int,
        account_data: WealthAccountUpdate,
        *,
        current_user: CurrentUser,
    ) -> WealthAccount:
        account = self.get_account(account_id, current_user=current_user)
        update_data = account_data.model_dump(exclude_unset=True)

        if "currency" in update_data and update_data["currency"] is not None:
            account_data = account_data.model_copy(
                update={"currency": update_data["currency"].upper()}
            )

        return self.repository.update_account(account, account_data)

    def delete_account(
        self,
        account_id: int,
        *,
        current_user: CurrentUser,
    ) -> None:
        account = self.get_account(account_id, current_user=current_user)

        if self.repository.has_snapshots_for_account(
            account_id,
            user_id=current_user.id,
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete a wealth account with snapshots",
            )

        self.repository.delete_account(account)

    def create_snapshot(
        self,
        snapshot_data: WealthSnapshotCreate,
        *,
        current_user: CurrentUser,
    ) -> WealthSnapshot:
        user_id = current_user.id

        self.get_account(snapshot_data.account_id, current_user=current_user)
        self._raise_if_duplicate_snapshot(
            account_id=snapshot_data.account_id,
            snapshot_date=snapshot_data.snapshot_date,
            user_id=user_id,
        )

        snapshot_data = self._normalise_snapshot_create(snapshot_data)
        return self.repository.create_snapshot(
            snapshot_data,
            user_id=user_id,
        )

    def list_snapshots(
        self,
        account_id: int | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 100,
        offset: int = 0,
        *,
        current_user: CurrentUser,
    ) -> list[WealthSnapshot]:
        if account_id is not None:
            self.get_account(account_id, current_user=current_user)

        return self.repository.list_snapshots(
            account_id=account_id,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
            user_id=current_user.id,
        )

    def get_snapshot(
        self,
        snapshot_id: int,
        *,
        current_user: CurrentUser,
    ) -> WealthSnapshot:
        snapshot = self.repository.get_snapshot_by_id(
            snapshot_id,
            user_id=current_user.id,
        )

        if snapshot is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wealth snapshot not found",
            )

        return snapshot

    def update_snapshot(
        self,
        snapshot_id: int,
        snapshot_data: WealthSnapshotUpdate,
        *,
        current_user: CurrentUser,
    ) -> WealthSnapshot:
        user_id = current_user.id
        snapshot = self.get_snapshot(snapshot_id, current_user=current_user)

        account_id = snapshot_data.account_id
        if account_id is not None:
            self.get_account(account_id, current_user=current_user)

        normalised_data = self._normalise_snapshot_update(
            existing_snapshot=snapshot,
            snapshot_data=snapshot_data,
        )
        effective_account_id = normalised_data.account_id or snapshot.account_id
        effective_snapshot_date = normalised_data.snapshot_date or snapshot.snapshot_date

        self._raise_if_duplicate_snapshot(
            account_id=effective_account_id,
            snapshot_date=effective_snapshot_date,
            user_id=user_id,
            exclude_snapshot_id=snapshot.id,
        )

        return self.repository.update_snapshot(snapshot, normalised_data)

    def delete_snapshot(
        self,
        snapshot_id: int,
        *,
        current_user: CurrentUser,
    ) -> None:
        snapshot = self.get_snapshot(snapshot_id, current_user=current_user)
        self.repository.delete_snapshot(snapshot)

    def get_summary(
        self,
        *,
        current_user: CurrentUser,
    ) -> WealthSummaryRead:
        user_id = current_user.id
        snapshots = self.repository.list_all_snapshots_ascending(
            user_id=user_id,
        )
        latest_by_account = self._get_latest_snapshot_by_account(snapshots)
        derived_account_ids = self._get_derived_account_ids(user_id)

        snapshot_total = sum(
            (
                snapshot.balance_eur
                for snapshot in latest_by_account.values()
                if snapshot.account_id not in derived_account_ids
            ),
            Decimal("0"),
        )
        money_owed_to_me = self._get_money_owed_to_me(user_id)
        investment_value = self._get_current_investment_value(current_user=current_user)

        return WealthSummaryRead(
            current_total_wealth_eur=snapshot_total + money_owed_to_me + investment_value,
            account_count=self._count_active_manual_accounts(user_id),
            latest_snapshot_date=self.repository.get_latest_snapshot_date(
                user_id=user_id,
            ),
            total_interest_earned=self.repository.sum_interest_earned(
                user_id=user_id,
            ),
            money_owed_to_me_eur=money_owed_to_me,
            investment_value_eur=investment_value,
        )

    def get_monthly_totals(
        self,
        *,
        current_user: CurrentUser,
    ) -> list[WealthMonthlyRead]:
        user_id = current_user.id
        snapshots = self.repository.list_all_snapshots_ascending(
            user_id=user_id,
        )
        derived_account_ids = self._get_derived_account_ids(user_id)
        investment_values_by_month = self._get_monthly_investment_values(
            current_user=current_user
        )
        owed_events = self._get_owed_events(user_id)
        owed_months = {
            event.effective_date.strftime("%Y-%m")
            for event in owed_events
        }
        snapshots_by_month: dict[str, list[WealthSnapshot]] = defaultdict(list)

        for snapshot in snapshots:
            month = snapshot.snapshot_date.strftime("%Y-%m")
            snapshots_by_month[month].append(snapshot)

        investment_months = self._get_investment_activity_months(
            current_user=current_user,
        )
        all_months = (
            set(snapshots_by_month)
            | investment_months
            | owed_months
        )

        if all_months:
            all_months.add(date.today().strftime("%Y-%m"))

        latest_by_account: dict[int, WealthSnapshot] = {}
        latest_owed_event_by_item = {}
        owed_event_index = 0
        rows: list[WealthMonthlyRead] = []

        for month in sorted(all_months):
            valuation_date = self._get_month_valuation_date(month)

            while (
                owed_event_index < len(owed_events)
                and owed_events[owed_event_index].effective_date
                <= valuation_date
            ):
                event = owed_events[owed_event_index]
                latest_owed_event_by_item[event.owed_item_id] = event
                owed_event_index += 1
            for snapshot in snapshots_by_month[month]:
                latest_by_account[snapshot.account_id] = snapshot

            total = sum(
                (
                    snapshot.balance_eur
                    for snapshot in latest_by_account.values()
                    if snapshot.account_id not in derived_account_ids
                ),
                Decimal("0"),
            )

            investment_value = investment_values_by_month.get(
                month,
                Decimal("0"),
            )
            money_owed_to_me = sum(
                (
                    event.amount_remaining
                    for event in latest_owed_event_by_item.values()
                    if (
                        event.event_type != "deleted"
                        and event.status in ("open", "partially_paid")
                    )
                ),
                Decimal("0"),
            )

            rows.append(
                WealthMonthlyRead(
                    month=month,
                    total_wealth_eur=(
                        total
                        + investment_value
                        + money_owed_to_me
                    ),
                    investment_value_eur=investment_value,
                )
            )

        return rows

    def _raise_if_duplicate_snapshot(
        self,
        account_id: int,
        snapshot_date: date,
        user_id: str,
        exclude_snapshot_id: int | None = None,
    ) -> None:
        if self.repository.exists_snapshot_for_account_date(
            account_id=account_id,
            snapshot_date=snapshot_date,
            user_id=user_id,
            exclude_snapshot_id=exclude_snapshot_id,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Wealth snapshot already exists for this account and date",
            )

    def _get_money_owed_to_me(self, user_id: str) -> Decimal:
        if self.owed_repository is None:
            return Decimal("0")

        return self.owed_repository.get_active_remaining_total(user_id)

    def _get_owed_events(self, user_id: str):
        if self.owed_repository is None:
            return []

        return self.owed_repository.list_all_events_ascending(user_id)

    def _get_month_valuation_date(self, month: str) -> date:
        year, month_number = map(int, month.split("-"))
        today = date.today()

        if year == today.year and month_number == today.month:
            return today

        return date(
            year,
            month_number,
            monthrange(year, month_number)[1],
        )

    def _get_current_investment_value(
        self,
        *,
        current_user: CurrentUser,
    ) -> Decimal:
        if self.investment_event_service is None:
            return Decimal("0")

        total = Decimal("0")

        for position in self.investment_event_service.list_positions(
            current_user=current_user,
        ):
            market_value = position.get("market_value")

            if market_value is None:
                continue

            total += Decimal(str(market_value))

        return total.quantize(Decimal("0.01"))

    def _get_investment_activity_months(
        self,
        *,
        current_user: CurrentUser,
    ) -> set[str]:
        if self.investment_event_service is None:
            return set()

        return self.investment_event_service.get_activity_months(
            current_user=current_user,
        )

    def _get_monthly_investment_values(
        self,
        *,
        current_user: CurrentUser,
    ) -> dict[str, Decimal]:
        if self.investment_event_service is None:
            return {}

        values: dict[str, Decimal] = {}

        for row in self.investment_event_service.get_monthly_series(
            months=60,
            current_user=current_user,
        ):
            market_value = row.get("market_value_eur")
            values[str(row["month"])] = (
                Decimal("0")
                if market_value is None
                else Decimal(str(market_value)).quantize(Decimal("0.01"))
            )

        return values

    def _get_derived_account_ids(self, user_id: str) -> set[int]:
        accounts = self.repository.list_accounts(
            active_only=False,
            limit=10000,
            offset=0,
            user_id=user_id,
        )

        return {
            account.id
            for account in accounts
            if self._is_money_owed_account(account) or self._is_derived_investment_account(account)
        }

    def _count_active_manual_accounts(self, user_id: str) -> int:
        accounts = self.repository.list_accounts(
            active_only=False,
            limit=10000,
            offset=0,
            user_id=user_id,
        )

        return sum(
            1
            for account in accounts
            if (
                account.is_active
                and not self._is_money_owed_account(account)
                and not self._is_derived_investment_account(account)
            )
        )

    def _is_money_owed_account(self, account: WealthAccount) -> bool:
        values = [
            account.name,
            account.institution,
            account.notes,
        ]
        text = " ".join(value or "" for value in values).lower()

        return (
            "money owed" in text
            or "owed to me" in text
            or "dívidas" in text
            or "dividas" in text
        )

    def _is_derived_investment_account(self, account: WealthAccount) -> bool:
        values = [
            account.name,
            account.institution,
            account.notes,
        ]
        text = " ".join(value or "" for value in values).lower()

        return (
            "derived investment" in text
            or "cspx" in text
            or "vwce" in text
            or "btc" in text
            or "bitcoin" in text
        )

    def _normalise_snapshot_create(
        self,
        snapshot_data: WealthSnapshotCreate,
    ) -> WealthSnapshotCreate:
        currency = snapshot_data.currency.upper()

        return snapshot_data.model_copy(
            update={
                "currency": currency,
                "balance_eur": self._get_balance_eur(
                    balance=snapshot_data.balance,
                    currency=currency,
                    balance_eur=snapshot_data.balance_eur,
                    fx_rate_to_eur=snapshot_data.fx_rate_to_eur,
                ),
                "fx_rate_to_eur": self._get_fx_rate_to_eur(
                    currency=currency,
                    fx_rate_to_eur=snapshot_data.fx_rate_to_eur,
                ),
            }
        )

    def _normalise_snapshot_update(
        self,
        existing_snapshot: WealthSnapshot,
        snapshot_data: WealthSnapshotUpdate,
    ) -> WealthSnapshotUpdate:
        update_data = snapshot_data.model_dump(exclude_unset=True)

        balance = update_data.get("balance", existing_snapshot.balance)
        currency = update_data.get("currency", existing_snapshot.currency).upper()
        balance_eur = update_data.get("balance_eur", None)
        fx_rate_to_eur = update_data.get("fx_rate_to_eur", None)

        if fx_rate_to_eur is None and "currency" in update_data:
            fx_rate_to_eur = self._get_fx_rate_to_eur(
                currency=currency,
                fx_rate_to_eur=None,
            )

        if any(
            field in update_data
            for field in ("balance", "currency", "balance_eur", "fx_rate_to_eur")
        ):
            balance_eur = self._get_balance_eur(
                balance=balance,
                currency=currency,
                balance_eur=balance_eur,
                fx_rate_to_eur=fx_rate_to_eur or existing_snapshot.fx_rate_to_eur,
            )

        update_data["currency"] = currency

        if balance_eur is not None:
            update_data["balance_eur"] = balance_eur

        if fx_rate_to_eur is not None:
            update_data["fx_rate_to_eur"] = fx_rate_to_eur

        return WealthSnapshotUpdate(**update_data)

    def _get_balance_eur(
        self,
        balance: Decimal,
        currency: str,
        balance_eur: Decimal | None,
        fx_rate_to_eur: Decimal | None,
    ) -> Decimal:
        fx_rate = self._get_fx_rate_to_eur(
            currency=currency,
            fx_rate_to_eur=fx_rate_to_eur,
        )
        calculated_balance_eur = balance * fx_rate

        if (
            balance_eur is not None
            and abs(balance_eur - calculated_balance_eur) > Decimal("0.01")
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="balance_eur must match balance multiplied by fx_rate_to_eur",
            )

        if balance_eur is not None:
            return balance_eur

        return calculated_balance_eur

    def _get_fx_rate_to_eur(
        self,
        currency: str,
        fx_rate_to_eur: Decimal | None,
    ) -> Decimal:
        if fx_rate_to_eur is not None:
            return fx_rate_to_eur

        if currency == "EUR":
            return Decimal("1")

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="fx_rate_to_eur is required for non-EUR snapshots",
        )

    def _get_latest_snapshot_by_account(
        self,
        snapshots: list[WealthSnapshot],
    ) -> dict[int, WealthSnapshot]:
        latest_by_account: dict[int, WealthSnapshot] = {}

        for snapshot in snapshots:
            latest_by_account[snapshot.account_id] = snapshot

        return latest_by_account
