from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.database import Base
from app.database_migrations import run_startup_migrations


USER_SCOPED_DEDUPE_INDEXES = {
    "transactions": "ix_transactions_user_dedupe_hash",
    "investment_events": "ix_investment_events_user_dedupe_hash",
    "owed_items": "ix_owed_items_user_dedupe_hash",
    "wealth_snapshots": "ix_wealth_snapshots_user_dedupe_hash",
}

OLD_GLOBAL_DEDUPE_INDEXES = {
    "transactions": "ix_transactions_dedupe_hash",
    "investment_events": "ix_investment_events_dedupe_hash",
    "owed_items": "ix_owed_items_dedupe_hash",
    "wealth_snapshots": "ix_wealth_snapshots_dedupe_hash",
}


def create_memory_engine():
    return create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def get_indexes_by_name(engine, table_name: str) -> dict[str, dict]:
    inspector = inspect(engine)
    return {
        index["name"]: index
        for index in inspector.get_indexes(table_name)
    }


def assert_user_scoped_dedupe_indexes(engine) -> None:
    for table_name, index_name in USER_SCOPED_DEDUPE_INDEXES.items():
        indexes = get_indexes_by_name(engine, table_name)

        assert index_name in indexes
        assert indexes[index_name]["unique"] == True
        assert indexes[index_name]["column_names"] == ["user_id", "dedupe_hash"]

        old_index_name = OLD_GLOBAL_DEDUPE_INDEXES[table_name]
        assert old_index_name not in indexes


def test_fresh_schema_uses_user_scoped_dedupe_indexes():
    engine = create_memory_engine()

    Base.metadata.create_all(bind=engine)
    run_startup_migrations(engine)

    assert_user_scoped_dedupe_indexes(engine)


def test_startup_migration_replaces_old_global_dedupe_indexes():
    engine = create_memory_engine()

    Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        for table_name, old_index_name in OLD_GLOBAL_DEDUPE_INDEXES.items():
            connection.execute(
                text(
                    f"CREATE UNIQUE INDEX {old_index_name} "
                    f"ON {table_name} (dedupe_hash)"
                )
            )

    run_startup_migrations(engine)

    assert_user_scoped_dedupe_indexes(engine)
