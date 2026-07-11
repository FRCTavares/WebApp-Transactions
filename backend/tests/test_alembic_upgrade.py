import os
import subprocess
from pathlib import Path

from sqlalchemy import create_engine, inspect


def test_alembic_upgrade_head_builds_fresh_sqlite_schema(tmp_path):
    database_path = tmp_path / "alembic_upgrade.db"
    database_url = f"sqlite:///{database_path}"

    env = os.environ.copy()
    env["DATABASE_URL"] = database_url

    subprocess.run(
        [".venv/bin/alembic", "upgrade", "head"],
        check=True,
        env=env,
        cwd=Path.cwd(),
    )

    engine = create_engine(database_url)
    inspector = inspect(engine)

    table_names = set(inspector.get_table_names())

    assert "alembic_version" in table_names
    assert "transactions" in table_names
    assert "owed_items" in table_names
    assert "import_batches" in table_names
    assert "investment_events" in table_names
    assert "wealth_accounts" in table_names
    assert "wealth_snapshots" in table_names

    transaction_indexes = {
        index["name"]: index["column_names"]
        for index in inspector.get_indexes("transactions")
    }

    assert (
        transaction_indexes["ix_transactions_user_dedupe_hash"]
        == ["user_id", "dedupe_hash"]
    )

    investment_funding_indexes = {
        index["name"]: index["column_names"]
        for index in inspector.get_indexes(
            "investment_funding_months"
        )
    }

    assert investment_funding_indexes[
        "ix_investment_funding_months_user_id"
    ] == ["user_id"]
    assert investment_funding_indexes[
        "ix_investment_funding_months_month"
    ] == ["month"]
    assert investment_funding_indexes[
        "ix_investment_funding_months_source"
    ] == ["source"]
    assert investment_funding_indexes[
        "ix_investment_funding_months_user_month"
    ] == ["user_id", "month"]
    assert investment_funding_indexes[
        "ix_investment_funding_months_user_source"
    ] == ["user_id", "source"]

    owed_payment_columns = {
        column["name"]
        for column in inspector.get_columns("owed_payments")
    }

    assert "unallocated_category" in owed_payment_columns
    assert "unallocated_notes" in owed_payment_columns
