import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine, text


PREVIOUS_REVISION = "e2f7a9c4d610"


def run_alembic(
    database_url: str,
    *arguments: str,
) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url

    return subprocess.run(
        [sys.executable, "-m", "alembic", *arguments],
        check=False,
        env=env,
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
    )


def create_pre_relationship_database(tmp_path):
    database_path = tmp_path / "relationship-migration.db"
    database_url = f"sqlite:///{database_path}"

    result = run_alembic(
        database_url,
        "upgrade",
        PREVIOUS_REVISION,
    )

    assert result.returncode == 0, result.stderr
    return database_url


def test_relational_foreign_key_migration_rejects_orphans(tmp_path):
    database_url = create_pre_relationship_database(tmp_path)
    engine = create_engine(database_url)

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

    result = run_alembic(database_url, "upgrade", "head")
    combined_output = result.stdout + result.stderr

    assert result.returncode != 0
    assert "migration preflight failed" in combined_output
    assert "orphaned reference" in combined_output

    with engine.connect() as connection:
        foreign_keys = connection.execute(
            text(
                """
                SELECT COUNT(*)
                FROM pragma_foreign_key_list(
                    'owed_payment_allocations'
                )
                """
            )
        ).scalar_one()

    assert foreign_keys == 0


def test_relational_foreign_key_migration_rejects_cross_user_links(
    tmp_path,
):
    database_url = create_pre_relationship_database(tmp_path)
    engine = create_engine(database_url)

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

    result = run_alembic(database_url, "upgrade", "head")
    combined_output = result.stdout + result.stderr

    assert result.returncode != 0
    assert "migration preflight failed" in combined_output
    assert "cross-user reference" in combined_output


def test_relational_foreign_key_migration_preserves_rows_and_ids(
    tmp_path,
):
    database_url = create_pre_relationship_database(tmp_path)
    engine = create_engine(database_url)

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

    result = run_alembic(database_url, "upgrade", "head")

    assert result.returncode == 0, result.stderr

    with engine.connect() as connection:
        row = connection.execute(
            text(
                """
                SELECT id, user_id, import_batch_id, amount
                FROM transactions
                WHERE id = 202
                """
            )
        ).one()

        violations = connection.execute(
            text("PRAGMA foreign_key_check")
        ).all()

    assert tuple(row) == (202, "user-1", 101, 50)
    assert violations == []
