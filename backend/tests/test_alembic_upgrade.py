import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect


def test_alembic_upgrade_head_builds_fresh_sqlite_schema(tmp_path):
    database_path = tmp_path / "alembic_upgrade.db"
    database_url = f"sqlite:///{database_path}"

    env = os.environ.copy()
    env["DATABASE_URL"] = database_url

    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
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
    assert "owed_item_events" in table_names
    assert "import_batches" in table_names
    assert "import_previews" in table_names
    assert "investment_events" in table_names

    import_preview_columns = {
        column["name"]
        for column in inspector.get_columns("import_previews")
    }
    assert "resolved_payload_sha256" in import_preview_columns
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

    owed_item_columns = {
        column["name"]
        for column in inspector.get_columns("owed_items")
    }
    assert "deleted_at" in owed_item_columns

    owed_event_columns = {
        column["name"]
        for column in inspector.get_columns("owed_item_events")
    }
    assert {
        "user_id",
        "owed_item_id",
        "owed_payment_id",
        "event_type",
        "effective_date",
        "amount_total",
        "amount_paid",
        "amount_remaining",
        "status",
    }.issubset(owed_event_columns)

    owed_event_foreign_keys = inspector.get_foreign_keys(
        "owed_item_events"
    )
    owed_event_foreign_key_columns = {
        constrained_column
        for foreign_key in owed_event_foreign_keys
        for constrained_column in foreign_key["constrained_columns"]
    }

    assert "owed_item_id" in owed_event_foreign_key_columns
    assert "owed_payment_id" not in owed_event_foreign_key_columns

    expected_foreign_keys = {
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

    for table_name, expected_columns in expected_foreign_keys.items():
        actual_foreign_keys = {}

        for foreign_key in inspector.get_foreign_keys(table_name):
            constrained_column = foreign_key["constrained_columns"][0]
            referred_table = foreign_key["referred_table"]
            ondelete = (foreign_key.get("options") or {}).get("ondelete")

            actual_foreign_keys[constrained_column] = (
                referred_table,
                ondelete,
            )

        assert actual_foreign_keys == expected_columns
