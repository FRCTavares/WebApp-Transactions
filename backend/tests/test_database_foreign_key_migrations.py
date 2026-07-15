import os
import subprocess
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text

from app.database import enable_sqlite_foreign_keys
from app.database_foreign_key_migrations import (
    run_sqlite_foreign_key_migrations,
)


PREVIOUS_REVISION = "e2f7a9c4d610"


EXPECTED_FOREIGN_KEYS = {
    "transactions": {
        "import_batch_id": ("import_batches", "RESTRICT"),
    },
    "investment_events": {
        "transaction_id": ("transactions", "SET NULL"),
        "matched_transaction_id": ("transactions", "SET NULL"),
        "import_batch_id": ("import_batches", "RESTRICT"),
    },
    "owed_items": {
        "linked_transaction_id": ("transactions", "RESTRICT"),
        "import_batch_id": ("import_batches", "RESTRICT"),
    },
    "owed_payments": {
        "linked_transaction_id": ("transactions", "RESTRICT"),
    },
    "owed_payment_allocations": {
        "owed_payment_id": ("owed_payments", "CASCADE"),
        "owed_item_id": ("owed_items", "RESTRICT"),
    },
    "wealth_snapshots": {
        "account_id": ("wealth_accounts", "RESTRICT"),
        "import_batch_id": ("import_batches", "RESTRICT"),
    },
}


def create_legacy_database(tmp_path):
    database_path = tmp_path / "legacy-finance.db"
    database_url = f"sqlite:///{database_path}"

    env = os.environ.copy()
    env["DATABASE_URL"] = database_url

    result = subprocess.run(
        [
            ".venv/bin/alembic",
            "upgrade",
            PREVIOUS_REVISION,
        ],
        check=False,
        cwd=Path.cwd(),
        env=env,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr

    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False},
    )
    enable_sqlite_foreign_keys(engine)
    return engine


def get_relationships(engine):
    inspector = inspect(engine)
    relationships = {}

    for table_name in EXPECTED_FOREIGN_KEYS:
        table_relationships = {}

        for foreign_key in inspector.get_foreign_keys(
            table_name
        ):
            column_name = foreign_key[
                "constrained_columns"
            ][0]
            parent_table = foreign_key["referred_table"]
            ondelete = (
                (foreign_key.get("options") or {}).get(
                    "ondelete"
                )
                or "NO ACTION"
            ).upper()

            table_relationships[column_name] = (
                parent_table,
                ondelete,
            )

        relationships[table_name] = table_relationships

    return relationships


def test_legacy_migration_adds_expected_foreign_keys(
    tmp_path,
):
    engine = create_legacy_database(tmp_path)

    run_sqlite_foreign_key_migrations(engine)

    assert get_relationships(engine) == EXPECTED_FOREIGN_KEYS

    with engine.connect() as connection:
        assert connection.scalar(
            text("PRAGMA foreign_keys")
        ) == 1
        assert connection.execute(
            text("PRAGMA foreign_key_check")
        ).all() == []


def test_legacy_migration_is_idempotent(tmp_path):
    engine = create_legacy_database(tmp_path)

    run_sqlite_foreign_key_migrations(engine)
    first_relationships = get_relationships(engine)

    run_sqlite_foreign_key_migrations(engine)
    second_relationships = get_relationships(engine)

    assert first_relationships == EXPECTED_FOREIGN_KEYS
    assert second_relationships == EXPECTED_FOREIGN_KEYS


def test_legacy_migration_preserves_rows_ids_and_indexes(
    tmp_path,
):
    engine = create_legacy_database(tmp_path)

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO import_batches (
                    id,
                    user_id,
                    source,
                    filename,
                    imported_at,
                    rows_total,
                    rows_inserted,
                    rows_skipped,
                    status
                )
                VALUES (
                    101,
                    'user-1',
                    'activobank',
                    'transactions.csv',
                    CURRENT_TIMESTAMP,
                    1,
                    1,
                    0,
                    'completed'
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO transactions (
                    id,
                    user_id,
                    date,
                    description,
                    raw_description,
                    amount,
                    direction,
                    cashflow_type,
                    source,
                    currency,
                    import_batch_id,
                    created_at,
                    updated_at
                )
                VALUES (
                    202,
                    'user-1',
                    '2026-07-14',
                    'Test transaction',
                    'Test transaction',
                    50,
                    'out',
                    'expense',
                    'activobank',
                    'EUR',
                    101,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                """
            )
        )

    inspector = inspect(engine)
    indexes_before = {
        index["name"]: (
            index["column_names"],
            index["unique"],
        )
        for index in inspector.get_indexes("transactions")
    }

    run_sqlite_foreign_key_migrations(engine)

    inspector = inspect(engine)
    indexes_after = {
        index["name"]: (
            index["column_names"],
            index["unique"],
        )
        for index in inspector.get_indexes("transactions")
    }

    with engine.connect() as connection:
        transaction = connection.execute(
            text(
                """
                SELECT id, user_id, import_batch_id, amount
                FROM transactions
                WHERE id = 202
                """
            )
        ).one()

    assert tuple(transaction) == (202, "user-1", 101, 50)
    assert indexes_after == indexes_before


def test_legacy_migration_rejects_orphans(tmp_path):
    engine = create_legacy_database(tmp_path)

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO owed_payment_allocations (
                    user_id,
                    owed_payment_id,
                    owed_item_id,
                    amount,
                    created_at
                )
                VALUES (
                    'user-1',
                    999001,
                    999002,
                    10,
                    CURRENT_TIMESTAMP
                )
                """
            )
        )

    with pytest.raises(
        RuntimeError,
        match="orphaned reference",
    ):
        run_sqlite_foreign_key_migrations(engine)

    assert get_relationships(engine)[
        "owed_payment_allocations"
    ] == {}


def test_legacy_migration_rejects_cross_user_links(
    tmp_path,
):
    engine = create_legacy_database(tmp_path)

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO wealth_accounts (
                    id,
                    user_id,
                    name,
                    account_type,
                    currency,
                    is_active,
                    created_at,
                    updated_at
                )
                VALUES (
                    7001,
                    'owner-user',
                    'Savings',
                    'savings',
                    'EUR',
                    1,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO wealth_snapshots (
                    id,
                    user_id,
                    snapshot_date,
                    account_id,
                    balance,
                    currency,
                    balance_eur,
                    fx_rate_to_eur,
                    source,
                    created_at,
                    updated_at
                )
                VALUES (
                    8001,
                    'other-user',
                    '2026-07-14',
                    7001,
                    100,
                    'EUR',
                    100,
                    1,
                    'manual',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                """
            )
        )

    with pytest.raises(
        RuntimeError,
        match="cross-user reference",
    ):
        run_sqlite_foreign_key_migrations(engine)


def test_legacy_migration_preserves_owed_event_relationship(
    tmp_path,
):
    engine = create_legacy_database(tmp_path)

    owed_event_foreign_keys_before = inspect(
        engine
    ).get_foreign_keys("owed_item_events")

    run_sqlite_foreign_key_migrations(engine)

    owed_event_foreign_keys_after = inspect(
        engine
    ).get_foreign_keys("owed_item_events")

    assert owed_event_foreign_keys_after == (
        owed_event_foreign_keys_before
    )
