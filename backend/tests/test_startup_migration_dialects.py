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

def test_startup_migrations_add_owed_payment_unallocated_classification_columns():
    engine = create_sqlite_memory_engine()

    Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        connection.execute(text("DROP TABLE owed_payments"))
        connection.execute(
            text(
                "CREATE TABLE owed_payments ("
                "id INTEGER NOT NULL, "
                "user_id VARCHAR(100) NOT NULL DEFAULT 'local-default-user', "
                "person VARCHAR(100) NOT NULL, "
                "payment_date DATE NOT NULL, "
                "amount NUMERIC(12, 2) NOT NULL, "
                "currency VARCHAR(3) NOT NULL DEFAULT 'EUR', "
                "method VARCHAR(30) NOT NULL DEFAULT 'cash', "
                "notes TEXT, "
                "linked_transaction_id INTEGER, "
                "created_at DATETIME NOT NULL, "
                "updated_at DATETIME NOT NULL, "
                "PRIMARY KEY (id)"
                ")"
            )
        )

    run_startup_migrations(engine)

    inspector = inspect(engine)
    column_names = {
        column["name"]
        for column in inspector.get_columns("owed_payments")
    }

    assert "unallocated_category" in column_names
    assert "unallocated_notes" in column_names


def test_startup_migrations_add_import_preview_resolved_payload_column():
    engine = create_sqlite_memory_engine()

    Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        connection.execute(text("DROP TABLE import_previews"))
        connection.execute(
            text(
                "CREATE TABLE import_previews ("
                "id VARCHAR(36) NOT NULL, "
                "user_id VARCHAR(100) NOT NULL, "
                "mode VARCHAR(40) NOT NULL, "
                "source VARCHAR(50) NOT NULL, "
                "filename VARCHAR(255) NOT NULL, "
                "file_sha256 VARCHAR(64) NOT NULL, "
                "rows_total INTEGER NOT NULL DEFAULT 0, "
                "rows_valid INTEGER NOT NULL DEFAULT 0, "
                "rows_duplicates INTEGER NOT NULL DEFAULT 0, "
                "rows_invalid INTEGER NOT NULL DEFAULT 0, "
                "transactions_pending INTEGER NOT NULL DEFAULT 0, "
                "investment_events_pending INTEGER NOT NULL DEFAULT 0, "
                "owed_items_pending INTEGER NOT NULL DEFAULT 0, "
                "wealth_snapshots_pending INTEGER NOT NULL DEFAULT 0, "
                "created_at DATETIME NOT NULL, "
                "expires_at DATETIME NOT NULL, "
                "consumed_at DATETIME, "
                "PRIMARY KEY (id)"
                ")"
            )
        )

    run_startup_migrations(engine)
    run_startup_migrations(engine)

    inspector = inspect(engine)
    column_names = {
        column["name"]
        for column in inspector.get_columns("import_previews")
    }

    assert "resolved_payload_sha256" in column_names



def test_startup_migrations_add_owed_item_event_ledger_and_backfill():
    engine = create_sqlite_memory_engine()

    Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        connection.execute(text("DROP TABLE owed_item_events"))
        connection.execute(
            text(
                "INSERT INTO transactions ("
                "user_id, date, description, raw_description, amount, "
                "direction, cashflow_type, source, currency, created_at, updated_at"
                ") VALUES ("
                "'user-1', '2026-05-12', 'Shared dinner', 'Shared dinner', 40, "
                "'out', 'expense', 'manual', 'EUR', "
                "CURRENT_TIMESTAMP, CURRENT_TIMESTAMP"
                ")"
            )
        )
        transaction_id = connection.scalar(
            text("SELECT id FROM transactions WHERE user_id = 'user-1'")
        )
        connection.execute(
            text(
                "INSERT INTO owed_items ("
                "user_id, person, amount_total, amount_paid, amount_remaining, "
                "reason, status, linked_transaction_id, source, created_at, updated_at"
                ") VALUES ("
                "'user-1', 'Mother', 40, 10, 30, "
                "'Shared dinner', 'partially_paid', :transaction_id, 'manual', "
                "'2026-06-01 10:00:00', '2026-06-01 10:00:00'"
                ")"
            ),
            {"transaction_id": transaction_id},
        )

    run_startup_migrations(engine)
    run_startup_migrations(engine)

    inspector = inspect(engine)
    assert "owed_item_events" in inspector.get_table_names()

    owed_item_columns = {
        column["name"]
        for column in inspector.get_columns("owed_items")
    }
    assert "deleted_at" in owed_item_columns

    with engine.connect() as connection:
        events = connection.execute(
            text(
                "SELECT event_type, effective_date, amount_total, "
                "amount_paid, amount_remaining, status "
                "FROM owed_item_events "
                "WHERE user_id = 'user-1'"
            )
        ).all()

    assert len(events) == 1
    assert events[0].event_type == "created"
    assert str(events[0].effective_date) == "2026-05-12"
    assert str(events[0].amount_total) in {"40", "40.00"}
    assert str(events[0].amount_paid) in {"10", "10.00"}
    assert str(events[0].amount_remaining) in {"30", "30.00"}
    assert events[0].status == "partially_paid"
