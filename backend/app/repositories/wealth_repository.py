from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.wealth_account import WealthAccount
from app.models.wealth_snapshot import WealthSnapshot
from app.schemas.wealth import (
    WealthAccountCreate,
    WealthAccountUpdate,
    WealthSnapshotCreate,
    WealthSnapshotUpdate,
)


class WealthRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_account(self, account_data: WealthAccountCreate) -> WealthAccount:
        account = WealthAccount(**account_data.model_dump())
        self.db.add(account)
        self.db.commit()
        self.db.refresh(account)
        return account

    def list_accounts(
        self,
        active_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> list[WealthAccount]:
        statement = select(WealthAccount).order_by(WealthAccount.name.asc(), WealthAccount.id.asc())

        if active_only:
            statement = statement.where(WealthAccount.is_active.is_(True))

        statement = statement.offset(offset).limit(limit)
        return list(self.db.scalars(statement).all())

    def get_account_by_id(self, account_id: int) -> WealthAccount | None:
        return self.db.get(WealthAccount, account_id)

    def update_account(
        self,
        account: WealthAccount,
        account_data: WealthAccountUpdate,
    ) -> WealthAccount:
        update_data = account_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(account, field, value)

        self.db.add(account)
        self.db.commit()
        self.db.refresh(account)
        return account

    def delete_account(self, account: WealthAccount) -> None:
        self.db.delete(account)
        self.db.commit()

    def create_snapshot(self, snapshot_data: WealthSnapshotCreate) -> WealthSnapshot:
        snapshot = WealthSnapshot(**snapshot_data.model_dump())
        self.db.add(snapshot)
        self.db.commit()
        self.db.refresh(snapshot)
        return snapshot

    def list_snapshots(
        self,
        account_id: int | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[WealthSnapshot]:
        statement = select(WealthSnapshot).order_by(
            WealthSnapshot.snapshot_date.desc(),
            WealthSnapshot.id.desc(),
        )

        if account_id is not None:
            statement = statement.where(WealthSnapshot.account_id == account_id)

        if date_from is not None:
            statement = statement.where(WealthSnapshot.snapshot_date >= date_from)

        if date_to is not None:
            statement = statement.where(WealthSnapshot.snapshot_date <= date_to)

        statement = statement.offset(offset).limit(limit)
        return list(self.db.scalars(statement).all())

    def get_snapshot_by_id(self, snapshot_id: int) -> WealthSnapshot | None:
        return self.db.get(WealthSnapshot, snapshot_id)

    def update_snapshot(
        self,
        snapshot: WealthSnapshot,
        snapshot_data: WealthSnapshotUpdate,
    ) -> WealthSnapshot:
        update_data = snapshot_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(snapshot, field, value)

        self.db.add(snapshot)
        self.db.commit()
        self.db.refresh(snapshot)
        return snapshot

    def delete_snapshot(self, snapshot: WealthSnapshot) -> None:
        self.db.delete(snapshot)
        self.db.commit()

    def has_snapshots_for_account(self, account_id: int) -> bool:
        statement = select(WealthSnapshot.id).where(WealthSnapshot.account_id == account_id).limit(1)
        return self.db.scalar(statement) is not None

    def get_latest_snapshot_date(self) -> date | None:
        statement = select(func.max(WealthSnapshot.snapshot_date))
        return self.db.scalar(statement)

    def count_active_accounts(self) -> int:
        statement = select(func.count(WealthAccount.id)).where(WealthAccount.is_active.is_(True))
        return int(self.db.scalar(statement) or 0)

    def sum_interest_earned(self) -> Decimal:
        statement = select(func.coalesce(func.sum(WealthSnapshot.interest_earned), 0))
        return Decimal(str(self.db.scalar(statement)))

    def list_all_snapshots_ascending(self) -> list[WealthSnapshot]:
        statement = select(WealthSnapshot).order_by(
            WealthSnapshot.snapshot_date.asc(),
            WealthSnapshot.id.asc(),
        )
        return list(self.db.scalars(statement).all())
