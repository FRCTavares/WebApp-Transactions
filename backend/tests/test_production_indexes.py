import os
import subprocess
from pathlib import Path

from sqlalchemy import create_engine, inspect
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.database import Base
from app.database_migrations import run_startup_migrations


EXPECTED_PRODUCTION_INDEXES = {
    "transactions": {
        "ix_transactions_user_date": ["user_id", "date"],
        "ix_transactions_user_direction_date": ["user_id", "direction", "date"],
        "ix_transactions_user_cashflow_type_date": [
            "user_id",
            "cashflow_type",
            "date",
        ],
    },
    "owed_items": {
        "ix_owed_items_user_status_person": ["user_id", "status", "person"],
    },
    "investment_events": {
        "ix_investment_events_user_date": ["user_id", "date"],
        "ix_investment_events_user_source_date": ["user_id", "source", "date"],
    },
    "wealth_snapshots": {
        "ix_wealth_snapshots_user_account_date": [
            "user_id",
            "account_id",
            "snapshot_date",
        ],
    },
    "import_batches": {
        "ix_import_batches_user_imported_at": ["user_id", "imported_at"],
    },
}


def create_memory_engine():
    return create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def get_index_columns(engine, table_name: str) -> dict[str, list[str]]:
    inspector = inspect(engine)
    return {
        index["name"]: index["column_names"]
        for index in inspector.get_indexes(table_name)
    }


def assert_expected_indexes(engine) -> None:
    for table_name, expected_indexes in EXPECTED_PRODUCTION_INDEXES.items():
        actual_indexes = get_index_columns(engine, table_name)

        for index_name, columns in expected_indexes.items():
            assert actual_indexes[index_name] == columns


def test_fresh_sqlite_schema_has_production_indexes():
    engine = create_memory_engine()

    Base.metadata.create_all(bind=engine)
    run_startup_migrations(engine)

    assert_expected_indexes(engine)


def test_alembic_upgrade_head_has_production_indexes(tmp_path):
    database_path = tmp_path / "alembic_indexes.db"
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

    assert_expected_indexes(engine)
