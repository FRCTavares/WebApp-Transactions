from collections import defaultdict
from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.models.wealth_account import WealthAccount
from app.models.wealth_snapshot import WealthSnapshot
from app.repositories.owed_repository import OwedRepository
from app.repositories.wealth_repository import WealthRepository
from app.services.investment_event_service import InvestmentEventService
from app.schemas.wealth import (
    WealthAccountCreate,
    WealthAccountUpdate,
    WealthMonthlyRead,
    WealthReconciliationItemRead,
    WealthReconciliationRead,
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
        current_user: CurrentUser | None = None,
    ) -> WealthAccount:
        account_data = account_data.model_copy(
            update={"currency": account_data.currency.upper()}
        )
        return self.repository.create_account(account_data, self._get_user_id(current_user))

    def list_accounts(
        self,
        active_only: bool = False,
        limit: int = 100,
        offset: int = 0,
        current_user: CurrentUser | None = None,
    ) -> list[WealthAccount]:
        return self.repository.list_accounts(
            active_only=active_only,
            limit=limit,
            offset=offset,
            user_id=self._get_user_id(current_user),
        )

    def get_account(
        self,
        account_id: int,
        current_user: CurrentUser | None = None,
    ) -> WealthAccount:
        account = self.repository.get_account_by_id(account_id, self._get_user_id(current_user))

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
        current_user: CurrentUser | None = None,
    ) -> WealthAccount:
        account = self.get_account(account_id, current_user)
        update_data = account_data.model_dump(exclude_unset=True)

        if "currency" in update_data and update_data["currency"] is not None:
            account_data = account_data.model_copy(
                update={"currency": update_data["currency"].upper()}
            )

        return self.repository.update_account(account, account_data)

    def delete_account(
        self,
        account_id: int,
        current_user: CurrentUser | None = None,
    ) -> None:
        account = self.get_account(account_id, current_user)

        if self.repository.has_snapshots_for_account(account_id, self._get_user_id(current_user)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete a wealth account with snapshots",
            )

        self.repository.delete_account(account)

    def create_snapshot(
        self,
        snapshot_data: WealthSnapshotCreate,
        current_user: CurrentUser | None = None,
    ) -> WealthSnapshot:
        self.get_account(snapshot_data.account_id, current_user)
        snapshot_data = self._normalise_snapshot_create(snapshot_data)
        return self.repository.create_snapshot(snapshot_data, self._get_user_id(current_user))

    def list_snapshots(
        self,
        account_id: int | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 100,
        offset: int = 0,
        current_user: CurrentUser | None = None,
    ) -> list[WealthSnapshot]:
        if account_id is not None:
            self.get_account(account_id, current_user)

        return self.repository.list_snapshots(
            account_id=account_id,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
            user_id=self._get_user_id(current_user),
        )

    def get_snapshot(
        self,
        snapshot_id: int,
        current_user: CurrentUser | None = None,
    ) -> WealthSnapshot:
        snapshot = self.repository.get_snapshot_by_id(snapshot_id, self._get_user_id(current_user))

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
        current_user: CurrentUser | None = None,
    ) -> WealthSnapshot:
        snapshot = self.get_snapshot(snapshot_id, current_user)

        account_id = snapshot_data.account_id
        if account_id is not None:
            self.get_account(account_id, current_user)

        normalised_data = self._normalise_snapshot_update(
            existing_snapshot=snapshot,
            snapshot_data=snapshot_data,
        )

        return self.repository.update_snapshot(snapshot, normalised_data)

    def delete_snapshot(
        self,
        snapshot_id: int,
        current_user: CurrentUser | None = None,
    ) -> None:
        snapshot = self.get_snapshot(snapshot_id, current_user)
        self.repository.delete_snapshot(snapshot)

    def get_summary(
        self,
        current_user: CurrentUser | None = None,
    ) -> WealthSummaryRead:
        user_id = self._get_user_id(current_user)
        snapshots = self.repository.list_all_snapshots_ascending(user_id)
        latest_by_account = self._get_latest_snapshot_by_account(snapshots)
        owed_like_account_ids = self._get_owed_like_account_ids(user_id)

        snapshot_total = sum(
            (
                snapshot.balance_eur
                for snapshot in latest_by_account.values()
                if snapshot.account_id not in owed_like_account_ids
            ),
            Decimal("0"),
        )
        money_owed_to_me = self._get_money_owed_to_me(user_id)

        return WealthSummaryRead(
            current_total_wealth_eur=snapshot_total + money_owed_to_me,
            account_count=self._count_active_non_owed_accounts(user_id),
            latest_snapshot_date=self.repository.get_latest_snapshot_date(user_id),
            total_interest_earned=self.repository.sum_interest_earned(user_id),
            money_owed_to_me_eur=money_owed_to_me,
        )

    def get_reconciliation(
        self,
        current_user: CurrentUser | None = None,
    ) -> WealthReconciliationRead:
        user_id = self._get_user_id(current_user)
        snapshots = self.repository.list_all_snapshots_ascending(user_id)
        latest_by_account = self._get_latest_snapshot_by_account(snapshots)
        owed_like_account_ids = self._get_owed_like_account_ids(user_id)

        manual_total = sum(
            (
                snapshot.balance_eur
                for snapshot in latest_by_account.values()
                if snapshot.account_id not in owed_like_account_ids
            ),
            Decimal("0"),
        ).quantize(Decimal("0.01"))

        items = self._build_manual_reconciliation_items(
            latest_by_account=latest_by_account,
            owed_like_account_ids=owed_like_account_ids,
            user_id=user_id,
        )

        derived_total = Decimal("0")
        money_owed_to_me = self._get_money_owed_to_me(user_id).quantize(Decimal("0.01"))
        derived_total += money_owed_to_me

        items.append(
            WealthReconciliationItemRead(
                name="Money Owed To Me",
                source="owed",
                manual_value_eur=None,
                derived_value_eur=money_owed_to_me,
                difference_eur=None,
                status="derived_only",
                notes="Derived from active owed items, not from stale Wealth snapshots.",
            )
        )

        for item in self._build_investment_reconciliation_items(current_user):
            items.append(item)
            if item.derived_value_eur is not None:
                derived_total += item.derived_value_eur

        derived_total = derived_total.quantize(Decimal("0.01"))
        difference = (manual_total - derived_total).quantize(Decimal("0.01"))

        return WealthReconciliationRead(
            manual_total_eur=manual_total,
            derived_total_eur=derived_total,
            difference_eur=difference,
            status=self._get_reconciliation_status(difference),
            items=items,
        )

    def get_monthly_totals(
        self,
        current_user: CurrentUser | None = None,
    ) -> list[WealthMonthlyRead]:
        user_id = self._get_user_id(current_user)
        snapshots = self.repository.list_all_snapshots_ascending(user_id)
        owed_like_account_ids = self._get_owed_like_account_ids(user_id)
        snapshots_by_month: dict[str, list[WealthSnapshot]] = defaultdict(list)

        for snapshot in snapshots:
            month = snapshot.snapshot_date.strftime("%Y-%m")
            snapshots_by_month[month].append(snapshot)

        latest_by_account: dict[int, WealthSnapshot] = {}
        rows: list[WealthMonthlyRead] = []

        for month in sorted(snapshots_by_month):
            for snapshot in snapshots_by_month[month]:
                latest_by_account[snapshot.account_id] = snapshot

            total = sum(
                (
                    snapshot.balance_eur
                    for snapshot in latest_by_account.values()
                    if snapshot.account_id not in owed_like_account_ids
                ),
                Decimal("0"),
            )

            rows.append(
                WealthMonthlyRead(
                    month=month,
                    total_wealth_eur=total,
                )
            )

        if rows:
            latest_row = rows[-1]
            rows[-1] = WealthMonthlyRead(
                month=latest_row.month,
                total_wealth_eur=latest_row.total_wealth_eur
                + self._get_money_owed_to_me(user_id),
            )

        return rows

    def _build_manual_reconciliation_items(
        self,
        latest_by_account: dict[int, WealthSnapshot],
        owed_like_account_ids: set[int],
        user_id: str,
    ) -> list[WealthReconciliationItemRead]:
        accounts_by_id = {
            account.id: account
            for account in self.repository.list_accounts(
                active_only=False,
                limit=10000,
                offset=0,
                user_id=user_id,
            )
        }

        items: list[WealthReconciliationItemRead] = []

        for account_id, snapshot in latest_by_account.items():
            if account_id in owed_like_account_ids:
                continue

            account = accounts_by_id.get(account_id)
            if account is None:
                continue

            manual_value = snapshot.balance_eur.quantize(Decimal("0.01"))
            source = self._get_reconciliation_source(account.account_type)

            items.append(
                WealthReconciliationItemRead(
                    name=account.name,
                    source=source,
                    manual_value_eur=manual_value,
                    derived_value_eur=None,
                    difference_eur=None,
                    status="manual_only",
                    notes=self._get_manual_only_note(source),
                )
            )

        return items

    def _build_investment_reconciliation_items(
        self,
        current_user: CurrentUser | None,
    ) -> list[WealthReconciliationItemRead]:
        if self.investment_event_service is None:
            return []

        items: list[WealthReconciliationItemRead] = []

        for position in self.investment_event_service.list_positions(
            source=None,
            current_user=current_user,
        ):
            market_value = position.get("market_value")
            market_value_currency = position.get("market_value_currency")

            name_parts = [
                str(position.get("ticker") or position.get("instrument_name") or "Investment position"),
                str(position.get("account") or position.get("source") or "").strip(),
            ]
            name = " - ".join(part for part in name_parts if part)

            if market_value is None or market_value_currency != "EUR":
                items.append(
                    WealthReconciliationItemRead(
                        name=name,
                        source="brokerage",
                        manual_value_eur=None,
                        derived_value_eur=None,
                        difference_eur=None,
                        status="not_supported",
                        notes="Position exists, but no EUR market value is available yet.",
                    )
                )
                continue

            items.append(
                WealthReconciliationItemRead(
                    name=name,
                    source="brokerage",
                    manual_value_eur=None,
                    derived_value_eur=Decimal(str(market_value)).quantize(Decimal("0.01")),
                    difference_eur=None,
                    status="derived_only",
                    notes="Derived from open investment positions and latest available market price.",
                )
            )

        return items

    def _get_reconciliation_source(
        self,
        account_type: str,
    ) -> str:
        if account_type in {"current_account", "savings_account"}:
            return "bank_account"

        if account_type == "brokerage":
            return "brokerage"

        if account_type == "cash":
            return "cash"

        return "other"

    def _get_manual_only_note(
        self,
        source: str,
    ) -> str:
        if source == "bank_account":
            return "Manual snapshot. Bank balances are not derived until opening balances and complete transaction coverage exist."

        if source == "cash":
            return "Manual snapshot. Physical cash is not derived from transactions."

        if source == "brokerage":
            return "Manual snapshot. Compare against derived investment position rows where available."

        return "Manual snapshot. No derived check is available yet."

    def _get_reconciliation_status(
        self,
        difference: Decimal,
    ) -> str:
        absolute_difference = abs(difference)

        if absolute_difference == 0:
            return "matched"

        if absolute_difference <= Decimal("1.00"):
            return "minor_difference"

        return "review_needed"

    def _get_money_owed_to_me(self, user_id: str) -> Decimal:
        if self.owed_repository is None:
            return Decimal("0")

        return self.owed_repository.get_active_remaining_total(user_id)

    def _get_owed_like_account_ids(self, user_id: str) -> set[int]:
        accounts = self.repository.list_accounts(
            active_only=False,
            limit=10000,
            offset=0,
            user_id=user_id,
        )

        return {
            account.id
            for account in accounts
            if self._is_money_owed_account(account)
        }

    def _count_active_non_owed_accounts(self, user_id: str) -> int:
        accounts = self.repository.list_accounts(
            active_only=False,
            limit=10000,
            offset=0,
            user_id=user_id,
        )

        return sum(
            1
            for account in accounts
            if account.is_active and not self._is_money_owed_account(account)
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

    def _get_user_id(self, current_user: CurrentUser | None) -> str:
        if current_user is None:
            return LOCAL_DEFAULT_USER_ID

        return current_user.id

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

        if balance_eur is None and (
            "balance" in update_data
            or "currency" in update_data
            or "fx_rate_to_eur" in update_data
        ):
            balance_eur = self._get_balance_eur(
                balance=balance,
                currency=currency,
                balance_eur=None,
                fx_rate_to_eur=fx_rate_to_eur or existing_snapshot.fx_rate_to_eur,
            )

        if fx_rate_to_eur is None and "currency" in update_data:
            fx_rate_to_eur = self._get_fx_rate_to_eur(
                currency=currency,
                fx_rate_to_eur=None,
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
        if balance_eur is not None:
            return balance_eur

        if currency == "EUR":
            return balance

        if fx_rate_to_eur is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="fx_rate_to_eur is required for non-EUR snapshots",
            )

        return balance * fx_rate_to_eur

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
