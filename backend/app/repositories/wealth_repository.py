from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
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

    def create_account(
        self,
        account_data: WealthAccountCreate,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> WealthAccount:
        account = WealthAccount(user_id=user_id, **account_data.model_dump())
        self.db.add(account)
        self.db.commit()
        self.db.refresh(account)
        return account

    def list_accounts(
        self,
        active_only: bool = False,
        limit: int = 100,
        offset: int = 0,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> list[WealthAccount]:
        statement = (
            select(WealthAccount)
            .where(WealthAccount.user_id == user_id)
            .order_by(WealthAccount.name.asc(), WealthAccount.id.asc())
        )

        if active_only:
            statement = statement.where(WealthAccount.is_active.is_(True))

        statement = statement.offset(offset).limit(limit)
        return list(self.db.scalars(statement).all())

    def get_account_by_id(
        self,
        account_id: int,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> WealthAccount | None:
        statement = (
            select(WealthAccount)
            .where(WealthAccount.id == account_id)
            .where(WealthAccount.user_id == user_id)
        )
        return self.db.scalar(statement)


    def get_account_by_name(
        self,
        name: str,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> WealthAccount | None:
        statement = (
            select(WealthAccount)
            .where(WealthAccount.user_id == user_id)
            .where(WealthAccount.name == name)
            .limit(1)
        )
        return self.db.scalar(statement)

    def exists_snapshot_for_account_date(
        self,
        account_id: int,
        snapshot_date: date,
        user_id: str = LOCAL_DEFAULT_USER_ID,
        exclude_snapshot_id: int | None = None,
    ) -> bool:
        statement = (
            select(WealthSnapshot.id)
            .where(WealthSnapshot.user_id == user_id)
            .where(WealthSnapshot.account_id == account_id)
            .where(WealthSnapshot.snapshot_date == snapshot_date)
        )

        if exclude_snapshot_id is not None:
            statement = statement.where(WealthSnapshot.id != exclude_snapshot_id)

        statement = statement.limit(1)
        return self.db.scalar(statement) is not None

    def exists_snapshot_by_dedupe_hash(
        self,
        dedupe_hash: str,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> bool:
        statement = (
            select(WealthSnapshot.id)
            .where(WealthSnapshot.user_id == user_id)
            .where(WealthSnapshot.dedupe_hash == dedupe_hash)
            .limit(1)
        )
        return self.db.scalar(statement) is not None

    def bulk_insert_snapshots(
        self,
        snapshots: list[WealthSnapshot],
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> None:
        for snapshot in snapshots:
            snapshot.user_id = user_id

        self.db.add_all(snapshots)
        self.db.commit()

    def delete_snapshots_by_import_batch(
        self,
        import_batch_id: int,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> int:
        snapshots = list(
            self.db.scalars(
                select(WealthSnapshot)
                .where(WealthSnapshot.user_id == user_id)
                .where(WealthSnapshot.import_batch_id == import_batch_id)
            ).all()
        )

        deleted_count = len(snapshots)

        for snapshot in snapshots:
            self.db.delete(snapshot)

        self.db.commit()
        return deleted_count


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

    def create_snapshot(
        self,
        snapshot_data: WealthSnapshotCreate,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> WealthSnapshot:
        snapshot = WealthSnapshot(user_id=user_id, **snapshot_data.model_dump())
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
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> list[WealthSnapshot]:
        statement = (
            select(WealthSnapshot)
            .where(WealthSnapshot.user_id == user_id)
            .order_by(
                WealthSnapshot.snapshot_date.desc(),
                WealthSnapshot.id.desc(),
            )
        )

        if account_id is not None:
            statement = statement.where(WealthSnapshot.account_id == account_id)

        if date_from is not None:
            statement = statement.where(WealthSnapshot.snapshot_date >= date_from)

        if date_to is not None:
            statement = statement.where(WealthSnapshot.snapshot_date <= date_to)

        statement = statement.offset(offset).limit(limit)
        return list(self.db.scalars(statement).all())

    def get_snapshot_by_id(
        self,
        snapshot_id: int,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> WealthSnapshot | None:
        statement = (
            select(WealthSnapshot)
            .where(WealthSnapshot.id == snapshot_id)
            .where(WealthSnapshot.user_id == user_id)
        )
        return self.db.scalar(statement)

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

    def has_snapshots_for_account(
        self,
        account_id: int,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> bool:
        statement = (
            select(WealthSnapshot.id)
            .where(WealthSnapshot.user_id == user_id)
            .where(WealthSnapshot.account_id == account_id)
            .limit(1)
        )
        return self.db.scalar(statement) is not None

    def get_latest_snapshot_date(
        self,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> date | None:
        statement = (
            select(func.max(WealthSnapshot.snapshot_date))
            .where(WealthSnapshot.user_id == user_id)
        )
        return self.db.scalar(statement)

    def count_active_accounts(
        self,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> int:
        statement = (
            select(func.count(WealthAccount.id))
            .where(WealthAccount.user_id == user_id)
            .where(WealthAccount.is_active.is_(True))
        )
        return int(self.db.scalar(statement) or 0)

    def sum_interest_earned(
        self,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> Decimal:
        statement = (
            select(func.coalesce(func.sum(WealthSnapshot.interest_earned), 0))
            .where(WealthSnapshot.user_id == user_id)
        )
        return Decimal(str(self.db.scalar(statement)))

    def list_all_snapshots_ascending(
        self,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> list[WealthSnapshot]:
        statement = (
            select(WealthSnapshot)
            .where(WealthSnapshot.user_id == user_id)
            .order_by(
                WealthSnapshot.snapshot_date.asc(),
                WealthSnapshot.id.asc(),
            )
        )
        return list(self.db.scalars(statement).all())
