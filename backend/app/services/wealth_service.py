from collections import defaultdict
from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status

from app.models.wealth_account import WealthAccount
from app.models.wealth_snapshot import WealthSnapshot
from app.repositories.wealth_repository import WealthRepository
from app.schemas.wealth import (
    WealthAccountCreate,
    WealthAccountUpdate,
    WealthMonthlyRead,
    WealthSnapshotCreate,
    WealthSnapshotUpdate,
    WealthSummaryRead,
)


class WealthService:
    def __init__(self, repository: WealthRepository) -> None:
        self.repository = repository

    def create_account(self, account_data: WealthAccountCreate) -> WealthAccount:
        account_data = account_data.model_copy(
            update={"currency": account_data.currency.upper()}
        )
        return self.repository.create_account(account_data)

    def list_accounts(
        self,
        active_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> list[WealthAccount]:
        return self.repository.list_accounts(
            active_only=active_only,
            limit=limit,
            offset=offset,
        )

    def get_account(self, account_id: int) -> WealthAccount:
        account = self.repository.get_account_by_id(account_id)

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
    ) -> WealthAccount:
        account = self.get_account(account_id)
        update_data = account_data.model_dump(exclude_unset=True)

        if "currency" in update_data and update_data["currency"] is not None:
            account_data = account_data.model_copy(
                update={"currency": update_data["currency"].upper()}
            )

        return self.repository.update_account(account, account_data)

    def delete_account(self, account_id: int) -> None:
        account = self.get_account(account_id)

        if self.repository.has_snapshots_for_account(account_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete a wealth account with snapshots",
            )

        self.repository.delete_account(account)

    def create_snapshot(self, snapshot_data: WealthSnapshotCreate) -> WealthSnapshot:
        self.get_account(snapshot_data.account_id)
        snapshot_data = self._normalise_snapshot_create(snapshot_data)
        return self.repository.create_snapshot(snapshot_data)

    def list_snapshots(
        self,
        account_id: int | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[WealthSnapshot]:
        if account_id is not None:
            self.get_account(account_id)

        return self.repository.list_snapshots(
            account_id=account_id,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
        )

    def get_snapshot(self, snapshot_id: int) -> WealthSnapshot:
        snapshot = self.repository.get_snapshot_by_id(snapshot_id)

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
    ) -> WealthSnapshot:
        snapshot = self.get_snapshot(snapshot_id)

        account_id = snapshot_data.account_id
        if account_id is not None:
            self.get_account(account_id)

        normalised_data = self._normalise_snapshot_update(
            existing_snapshot=snapshot,
            snapshot_data=snapshot_data,
        )

        return self.repository.update_snapshot(snapshot, normalised_data)

    def delete_snapshot(self, snapshot_id: int) -> None:
        snapshot = self.get_snapshot(snapshot_id)
        self.repository.delete_snapshot(snapshot)

    def get_summary(self) -> WealthSummaryRead:
        snapshots = self.repository.list_all_snapshots_ascending()
        latest_by_account = self._get_latest_snapshot_by_account(snapshots)

        total_wealth = sum(
            (snapshot.balance_eur for snapshot in latest_by_account.values()),
            Decimal("0"),
        )

        return WealthSummaryRead(
            current_total_wealth_eur=total_wealth,
            account_count=self.repository.count_active_accounts(),
            latest_snapshot_date=self.repository.get_latest_snapshot_date(),
            total_interest_earned=self.repository.sum_interest_earned(),
        )

    def get_monthly_totals(self) -> list[WealthMonthlyRead]:
        snapshots = self.repository.list_all_snapshots_ascending()
        latest_by_month_account: dict[str, dict[int, WealthSnapshot]] = defaultdict(dict)

        for snapshot in snapshots:
            month = snapshot.snapshot_date.strftime("%Y-%m")
            latest_by_month_account[month][snapshot.account_id] = snapshot

        rows = []

        for month in sorted(latest_by_month_account):
            total = sum(
                (
                    snapshot.balance_eur
                    for snapshot in latest_by_month_account[month].values()
                ),
                Decimal("0"),
            )
            rows.append(
                WealthMonthlyRead(
                    month=month,
                    total_wealth_eur=total,
                )
            )

        return rows

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
