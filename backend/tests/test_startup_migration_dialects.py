from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.database_migrations import run_startup_migrations


def create_sqlite_memory_engine():
    return create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


def test_startup_migrations_run_for_sqlite():
    engine = create_sqlite_memory_engine()

    Base.metadata.create_all(bind=engine)
    run_startup_migrations(engine)

    inspector = inspect(engine)
    indexes = {
        index["name"]: index
        for index in inspector.get_indexes("transactions")
    }

    assert "ix_transactions_user_dedupe_hash" in indexes


def test_startup_migrations_skip_non_sqlite_engines():
    class FakePostgresEngine:
        url = "postgresql://user:password@example.com/db"

        def begin(self):
            raise AssertionError("legacy startup migrations should not run")

    run_startup_migrations(FakePostgresEngine())


def test_startup_migrations_are_idempotent_for_sqlite():
    engine = create_sqlite_memory_engine()

    Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE UNIQUE INDEX ix_transactions_dedupe_hash "
                "ON transactions (dedupe_hash)"
            )
        )

    run_startup_migrations(engine)
    run_startup_migrations(engine)

    inspector = inspect(engine)
    indexes = {
        index["name"]: index
        for index in inspector.get_indexes("transactions")
    }

    assert "ix_transactions_dedupe_hash" not in indexes
    assert "ix_transactions_user_dedupe_hash" in indexes
