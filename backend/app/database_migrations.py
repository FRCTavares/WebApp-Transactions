from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError


def run_startup_migrations(engine: Engine) -> None:
    """Small SQLite-safe migrations until the project adopts Alembic."""

    _run_transaction_migrations(engine=engine)
    _run_import_batch_user_migrations(engine=engine)
    _run_investment_event_migrations(engine=engine)
    _run_owed_item_migrations(engine=engine)
    _run_owed_user_migrations(engine=engine)
    _run_rule_user_migrations(engine=engine)
    _run_wealth_migrations(engine=engine)
    _run_wealth_user_migrations(engine=engine)





def _run_import_batch_user_migrations(engine: Engine) -> None:
    if not _table_exists(engine=engine, table_name="import_batches"):
        return

    _add_column_if_missing(
        engine=engine,
        table_name="import_batches",
        column_name="user_id",
        sql=(
            "ALTER TABLE import_batches "
            "ADD COLUMN user_id VARCHAR(100) NOT NULL DEFAULT 'local-default-user'"
        ),
    )


def _run_owed_user_migrations(engine: Engine) -> None:
    owed_tables = [
        "owed_items",
        "owed_payments",
        "owed_payment_allocations",
    ]

    for table_name in owed_tables:
        if not _table_exists(engine=engine, table_name=table_name):
            continue

        _add_column_if_missing(
            engine=engine,
            table_name=table_name,
            column_name="user_id",
            sql=(
                f"ALTER TABLE {table_name} "
                "ADD COLUMN user_id VARCHAR(100) NOT NULL DEFAULT 'local-default-user'"
            ),
        )

def _run_rule_user_migrations(engine: Engine) -> None:
    rule_tables = [
        "category_rules",
        "cashflow_rules",
        "description_rules",
    ]

    for table_name in rule_tables:
        if not _table_exists(engine=engine, table_name=table_name):
            continue

        _add_column_if_missing(
            engine=engine,
            table_name=table_name,
            column_name="user_id",
            sql=(
                f"ALTER TABLE {table_name} "
                "ADD COLUMN user_id VARCHAR(100) NOT NULL DEFAULT 'local-default-user'"
            ),
        )

def _run_transaction_migrations(engine: Engine) -> None:
    transaction_column_migrations = {
        "original_amount": "ALTER TABLE transactions ADD COLUMN original_amount NUMERIC(12, 2)",
        "original_currency": "ALTER TABLE transactions ADD COLUMN original_currency VARCHAR(3)",
        "fx_rate_to_eur": "ALTER TABLE transactions ADD COLUMN fx_rate_to_eur NUMERIC(18, 8)",
        "fx_rate_source": "ALTER TABLE transactions ADD COLUMN fx_rate_source VARCHAR(30)",
        "user_id": "ALTER TABLE transactions ADD COLUMN user_id VARCHAR(100) NOT NULL DEFAULT 'local-default-user'",
    }

    for column_name, sql in transaction_column_migrations.items():
        _add_column_if_missing(
            engine=engine,
            table_name="transactions",
            column_name=column_name,
            sql=sql,
        )

    if _column_exists(
        engine=engine,
        table_name="transactions",
        column_name="cashflow_type",
    ):
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE transactions "
                "ADD COLUMN cashflow_type VARCHAR(30) NOT NULL DEFAULT 'expense'"
            )
        )
        connection.execute(
            text(
                "UPDATE transactions "
                "SET cashflow_type = 'income' "
                "WHERE direction = 'in'"
            )
        )


def _run_investment_event_migrations(engine: Engine) -> None:
    if not _table_exists(engine=engine, table_name="investment_events"):
        return

    investment_event_column_migrations = {
        "user_id": "ALTER TABLE investment_events ADD COLUMN user_id VARCHAR(100) NOT NULL DEFAULT 'local-default-user'",
        "funding_source": "ALTER TABLE investment_events ADD COLUMN funding_source VARCHAR(50)",
        "funding_match_status": "ALTER TABLE investment_events ADD COLUMN funding_match_status VARCHAR(30)",
        "matched_transaction_id": "ALTER TABLE investment_events ADD COLUMN matched_transaction_id INTEGER",
    }

    for column_name, sql in investment_event_column_migrations.items():
        _add_column_if_missing(
            engine=engine,
            table_name="investment_events",
            column_name=column_name,
            sql=sql,
        )


def _run_owed_item_migrations(engine: Engine) -> None:
    if not _table_exists(engine=engine, table_name="owed_items"):
        return

    owed_item_column_migrations = {
        "source": "ALTER TABLE owed_items ADD COLUMN source VARCHAR(50) NOT NULL DEFAULT 'manual'",
        "import_batch_id": "ALTER TABLE owed_items ADD COLUMN import_batch_id INTEGER",
        "external_id": "ALTER TABLE owed_items ADD COLUMN external_id VARCHAR(255)",
        "dedupe_hash": "ALTER TABLE owed_items ADD COLUMN dedupe_hash VARCHAR(64)",
    }

    for column_name, sql in owed_item_column_migrations.items():
        _add_column_if_missing(
            engine=engine,
            table_name="owed_items",
            column_name=column_name,
            sql=sql,
        )



def _run_wealth_user_migrations(engine: Engine) -> None:
    wealth_tables = [
        "wealth_accounts",
        "wealth_snapshots",
    ]

    for table_name in wealth_tables:
        if not _table_exists(engine=engine, table_name=table_name):
            continue

        _add_column_if_missing(
            engine=engine,
            table_name=table_name,
            column_name="user_id",
            sql=(
                f"ALTER TABLE {table_name} "
                "ADD COLUMN user_id VARCHAR(100) NOT NULL DEFAULT 'local-default-user'"
            ),
        )


def _run_wealth_migrations(engine: Engine) -> None:
    if not _table_exists(engine=engine, table_name="wealth_accounts"):
        with engine.begin() as connection:
            connection.execute(
                text(
                    "CREATE TABLE wealth_accounts ("
                    "id INTEGER NOT NULL, "
                    "name VARCHAR(100) NOT NULL, "
                    "account_type VARCHAR(50) NOT NULL, "
                    "currency VARCHAR(3) NOT NULL DEFAULT 'EUR', "
                    "institution VARCHAR(100), "
                    "is_active BOOLEAN NOT NULL DEFAULT 1, "
                    "notes TEXT, "
                    "created_at DATETIME NOT NULL, "
                    "updated_at DATETIME NOT NULL, "
                    "PRIMARY KEY (id)"
                    ")"
                )
            )

    if not _table_exists(engine=engine, table_name="wealth_snapshots"):
        with engine.begin() as connection:
            connection.execute(
                text(
                    "CREATE TABLE wealth_snapshots ("
                    "id INTEGER NOT NULL, "
                    "snapshot_date DATE NOT NULL, "
                    "account_id INTEGER NOT NULL, "
                    "balance NUMERIC(12, 2) NOT NULL, "
                    "currency VARCHAR(3) NOT NULL DEFAULT 'EUR', "
                    "balance_eur NUMERIC(12, 2) NOT NULL, "
                    "fx_rate_to_eur NUMERIC(18, 8) NOT NULL DEFAULT 1, "
                    "interest_earned NUMERIC(12, 2), "
                    "notes TEXT, "
                    "source VARCHAR(50) NOT NULL DEFAULT 'manual', "
                    "import_batch_id INTEGER, "
                    "external_id VARCHAR(255), "
                    "dedupe_hash VARCHAR(64), "
                    "created_at DATETIME NOT NULL, "
                    "updated_at DATETIME NOT NULL, "
                    "PRIMARY KEY (id)"
                    ")"
                )
            )

    wealth_snapshot_column_migrations = {
        "source": "ALTER TABLE wealth_snapshots ADD COLUMN source VARCHAR(50) NOT NULL DEFAULT 'manual'",
        "import_batch_id": "ALTER TABLE wealth_snapshots ADD COLUMN import_batch_id INTEGER",
        "external_id": "ALTER TABLE wealth_snapshots ADD COLUMN external_id VARCHAR(255)",
        "dedupe_hash": "ALTER TABLE wealth_snapshots ADD COLUMN dedupe_hash VARCHAR(64)",
    }

    for column_name, sql in wealth_snapshot_column_migrations.items():
        _add_column_if_missing(
            engine=engine,
            table_name="wealth_snapshots",
            column_name=column_name,
            sql=sql,
        )


def _table_exists(engine: Engine, table_name: str) -> bool:
    inspector = inspect(engine)
    return table_name in inspector.get_table_names()


def _column_exists(engine: Engine, table_name: str, column_name: str) -> bool:
    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns(table_name)}
    return column_name in columns


def _add_column_if_missing(
    engine: Engine,
    table_name: str,
    column_name: str,
    sql: str,
) -> None:
    if _column_exists(
        engine=engine,
        table_name=table_name,
        column_name=column_name,
    ):
        return

    try:
        with engine.begin() as connection:
            connection.execute(text(sql))
    except OperationalError as error:
        if "duplicate column name" in str(error).lower():
            return

        raise
