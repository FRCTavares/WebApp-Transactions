from sqlalchemy import create_engine, inspect
from sqlalchemy.pool import StaticPool

from app.database import initialise_database


def create_sqlite_memory_engine():
    return create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def test_initialise_database_creates_sqlite_schema():
    engine = create_sqlite_memory_engine()

    initialise_database(engine)

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    assert "transactions" in table_names
    assert "owed_items" in table_names
    assert "import_batches" in table_names


def test_initialise_database_keeps_user_scoped_dedupe_index():
    engine = create_sqlite_memory_engine()

    initialise_database(engine)

    inspector = inspect(engine)
    indexes = {
        index["name"]: index["column_names"]
        for index in inspector.get_indexes("transactions")
    }

    assert indexes["ix_transactions_user_dedupe_hash"] == [
        "user_id",
        "dedupe_hash",
    ]


def test_initialise_database_skips_non_sqlite_engines():
    class FakePostgresEngine:
        url = "postgresql://user:password@example.com/db"

    initialise_database(FakePostgresEngine())
