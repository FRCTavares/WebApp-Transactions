from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.database import Base
from app.models.transaction import Transaction
from app.models.transaction_category import TransactionCategory
from app.recovery_registry import USER_RECOVERY_TABLE_NAMES
from scripts.migrate_user_ownership import (
    get_user_row_counts,
    migrate_user_ownership,
)


SOURCE_USER_ID = "legacy@example.com"
TARGET_USER_ID = "11111111-2222-3333-4444-555555555555"


def create_test_engine(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'ownership-migration.db'}"
    )
    Base.metadata.create_all(engine)

    return engine


def add_source_rows(engine):
    with Session(engine) as session:
        session.add(
            Transaction(
                user_id=SOURCE_USER_ID,
                date=date(2026, 7, 11),
                description="Ownership migration transaction",
                raw_description="Ownership migration transaction",
                amount=Decimal("10.00"),
                direction="out",
                cashflow_type="expense",
                source="manual",
                currency="EUR",
                dedupe_hash="ownership-migration-transaction",
            )
        )
        session.add(
            TransactionCategory(
                user_id=SOURCE_USER_ID,
                name="Ownership migration category",
                direction="out",
                cashflow_type="expense",
                is_active=True,
                sort_order=1,
            )
        )
        session.commit()


def test_migrate_user_ownership_preserves_rows(tmp_path):
    engine = create_test_engine(tmp_path)
    add_source_rows(engine)

    source_counts_before = get_user_row_counts(
        engine,
        SOURCE_USER_ID,
    )

    result = migrate_user_ownership(
        engine=engine,
        source_user_id=SOURCE_USER_ID,
        target_user_id=TARGET_USER_ID,
    )

    assert set(result.migrated_counts) == set(
        USER_RECOVERY_TABLE_NAMES
    )
    assert result.migrated_counts == source_counts_before
    assert get_user_row_counts(
        engine,
        SOURCE_USER_ID,
    ) == {
        table_name: 0
        for table_name in USER_RECOVERY_TABLE_NAMES
    }

    with Session(engine) as session:
        transaction = session.query(Transaction).one()
        category = session.query(TransactionCategory).one()

    assert transaction.user_id == TARGET_USER_ID
    assert category.user_id == TARGET_USER_ID


def test_migrate_user_ownership_rejects_target_with_existing_rows(
    tmp_path,
):
    engine = create_test_engine(tmp_path)
    add_source_rows(engine)

    with Session(engine) as session:
        session.add(
            TransactionCategory(
                user_id=TARGET_USER_ID,
                name="Existing target category",
                direction="out",
                cashflow_type="expense",
                is_active=True,
                sort_order=1,
            )
        )
        session.commit()

    source_counts_before = get_user_row_counts(
        engine,
        SOURCE_USER_ID,
    )

    with pytest.raises(
        RuntimeError,
        match="Target user already owns rows",
    ):
        migrate_user_ownership(
            engine=engine,
            source_user_id=SOURCE_USER_ID,
            target_user_id=TARGET_USER_ID,
        )

    assert get_user_row_counts(
        engine,
        SOURCE_USER_ID,
    ) == source_counts_before


def test_migrate_user_ownership_rejects_same_owner(tmp_path):
    engine = create_test_engine(tmp_path)

    with pytest.raises(
        ValueError,
        match="must be different",
    ):
        migrate_user_ownership(
            engine=engine,
            source_user_id=SOURCE_USER_ID,
            target_user_id=SOURCE_USER_ID,
        )


def test_migrate_user_ownership_rejects_source_without_rows(tmp_path):
    engine = create_test_engine(tmp_path)

    with pytest.raises(
        RuntimeError,
        match="Source user owns no rows",
    ):
        migrate_user_ownership(
            engine=engine,
            source_user_id=SOURCE_USER_ID,
            target_user_id=TARGET_USER_ID,
        )

    assert get_user_row_counts(
        engine,
        TARGET_USER_ID,
    ) == {
        table_name: 0
        for table_name in USER_RECOVERY_TABLE_NAMES
    }
