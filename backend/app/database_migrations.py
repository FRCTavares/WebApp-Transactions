from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError

from app.database import is_sqlite_database_url


def run_startup_migrations(engine: Engine) -> None:
    """Run legacy startup migrations.

    These migrations are intentionally SQLite-only. They exist to keep the
    current local database evolving safely. Postgres/Supabase should use a
    proper migration tool before deployment instead of these raw SQLite-era
    startup migrations.
    """

    if not is_sqlite_database_url(str(engine.url)):
        return

    _run_investment_funding_month_migrations(engine=engine)
    _run_transaction_migrations(engine=engine)
    _run_import_batch_user_migrations(engine=engine)
    _run_investment_event_migrations(engine=engine)
    _run_owed_item_migrations(engine=engine)
    _run_owed_payment_migrations(engine=engine)
    _run_owed_user_migrations(engine=engine)
    _run_rule_user_migrations(engine=engine)
    _run_cashflow_type_migrations(engine=engine)
    _run_wealth_migrations(engine=engine)
    _run_wealth_user_migrations(engine=engine)
    _run_user_scoped_dedupe_index_migrations(engine=engine)






def _run_cashflow_type_migrations(engine: Engine) -> None:
    if _table_exists(engine=engine, table_name="transactions") and _column_exists(
        engine=engine,
        table_name="transactions",
        column_name="cashflow_type",
    ):
        if _transactions_table_requires_cashflow_rebuild(engine):
            _rebuild_transactions_for_simplified_cashflow(engine)
        else:
            _normalise_transaction_cashflow_values(engine)

    if _table_exists(engine=engine, table_name="cashflow_rules"):
        _normalise_cashflow_rule_values(engine)


def _transactions_table_requires_cashflow_rebuild(engine: Engine) -> bool:
    if engine.dialect.name != "sqlite":
        return False

    with engine.connect() as connection:
        table_sql = connection.execute(
            text(
                "SELECT sql FROM sqlite_master "
                "WHERE type = 'table' AND name = 'transactions'"
            )
        ).scalar()

    if table_sql is None:
        return False

    normalised_sql = str(table_sql).lower()

    return (
        "internal_transfer" in normalised_sql
        or "reimbursed_expense" in normalised_sql
        or "'transfer'" not in normalised_sql
    )


def _normalise_transaction_cashflow_values(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE transactions "
                "SET cashflow_type = CASE cashflow_type "
                "WHEN 'internal_transfer' THEN 'transfer' "
                "WHEN 'investment' THEN 'transfer' "
                "WHEN 'reimbursement' THEN 'income' "
                "WHEN 'reimbursed_expense' THEN 'expense' "
                "WHEN 'transfer' THEN 'transfer' "
                "WHEN 'income' THEN 'income' "
                "ELSE 'expense' "
                "END"
            )
        )


def _normalise_cashflow_rule_values(engine: Engine) -> None:
    if not _column_exists(
        engine=engine,
        table_name="cashflow_rules",
        column_name="cashflow_type",
    ):
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE cashflow_rules "
                "SET cashflow_type = CASE cashflow_type "
                "WHEN 'internal_transfer' THEN 'transfer' "
                "WHEN 'investment' THEN 'transfer' "
                "WHEN 'reimbursement' THEN 'income' "
                "WHEN 'reimbursed_expense' THEN 'expense' "
                "WHEN 'transfer' THEN 'transfer' "
                "WHEN 'income' THEN 'income' "
                "ELSE 'expense' "
                "END"
            )
        )


def _rebuild_transactions_for_simplified_cashflow(engine: Engine) -> None:
    target_columns = [
        "id",
        "user_id",
        "date",
        "description",
        "raw_description",
        "amount",
        "original_amount",
        "original_currency",
        "fx_rate_to_eur",
        "fx_rate_source",
        "direction",
        "cashflow_type",
        "source",
        "account",
        "category",
        "subcategory",
        "currency",
        "merchant",
        "notes",
        "import_batch_id",
        "external_id",
        "dedupe_hash",
        "created_at",
        "updated_at",
    ]

    inspector = inspect(engine)
    existing_columns = {
        column["name"]
        for column in inspector.get_columns("transactions")
    }

    select_parts = []
    for column in target_columns:
        if column == "cashflow_type":
            select_parts.append(
                "CASE cashflow_type "
                "WHEN 'internal_transfer' THEN 'transfer' "
                "WHEN 'investment' THEN 'transfer' "
                "WHEN 'reimbursement' THEN 'income' "
                "WHEN 'reimbursed_expense' THEN 'expense' "
                "WHEN 'transfer' THEN 'transfer' "
                "WHEN 'income' THEN 'income' "
                "ELSE 'expense' "
                "END AS cashflow_type"
            )
        elif column in existing_columns:
            select_parts.append(column)
        elif column == "user_id":
            select_parts.append("'local-default-user' AS user_id")
        elif column == "source":
            select_parts.append("'manual' AS source")
        elif column == "currency":
            select_parts.append("'EUR' AS currency")
        elif column in {"created_at", "updated_at"}:
            select_parts.append("CURRENT_TIMESTAMP AS " + column)
        else:
            select_parts.append("NULL AS " + column)

    insert_sql = (
        "INSERT INTO transactions_cashflow_migration ("
        + ", ".join(target_columns)
        + ") SELECT "
        + ", ".join(select_parts)
        + " FROM transactions"
    )

    create_sql = """
        CREATE TABLE transactions_cashflow_migration (
            id INTEGER NOT NULL,
            user_id VARCHAR(100),
            date DATE NOT NULL,
            description VARCHAR(255) NOT NULL,
            raw_description TEXT NOT NULL,
            amount NUMERIC(12, 2) NOT NULL,
            original_amount NUMERIC(12, 2),
            original_currency VARCHAR(3),
            fx_rate_to_eur NUMERIC(18, 8),
            fx_rate_source VARCHAR(30),
            direction VARCHAR(10) NOT NULL,
            cashflow_type VARCHAR(30) NOT NULL,
            source VARCHAR(50),
            account VARCHAR(100),
            category VARCHAR(100),
            subcategory VARCHAR(100),
            currency VARCHAR(3),
            merchant VARCHAR(100),
            notes TEXT,
            import_batch_id INTEGER,
            external_id VARCHAR(255),
            dedupe_hash VARCHAR(64),
            created_at DATETIME,
            updated_at DATETIME,
            PRIMARY KEY (id),
            CONSTRAINT ck_transactions_amount_positive CHECK (amount > 0),
            CONSTRAINT ck_transactions_direction_known CHECK (direction IN ('in', 'out')),
            CONSTRAINT ck_transactions_cashflow_type_known CHECK (cashflow_type IN ('income', 'expense', 'transfer')),
            CONSTRAINT ck_transactions_currency_length CHECK (length(currency) = 3),
            CONSTRAINT ck_transactions_original_currency_length CHECK (original_currency IS NULL OR length(original_currency) = 3)
        )
    """

    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        connection.commit()

        with connection.begin():
            connection.execute(text("DROP TABLE IF EXISTS transactions_cashflow_migration"))
            connection.execute(text(create_sql))
            connection.execute(text(insert_sql))
            connection.execute(text("DROP TABLE transactions"))
            connection.execute(
                text("ALTER TABLE transactions_cashflow_migration RENAME TO transactions")
            )
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX ix_transactions_user_dedupe_hash "
                    "ON transactions (user_id, dedupe_hash)"
                )
            )
            connection.execute(
                text("CREATE INDEX ix_transactions_user_date ON transactions (user_id, date)")
            )
            connection.execute(
                text(
                    "CREATE INDEX ix_transactions_user_direction_date "
                    "ON transactions (user_id, direction, date)"
                )
            )
            connection.execute(
                text(
                    "CREATE INDEX ix_transactions_user_cashflow_type_date "
                    "ON transactions (user_id, cashflow_type, date)"
                )
            )
            connection.execute(
                text("CREATE INDEX ix_transactions_category ON transactions (category)")
            )
            connection.execute(
                text("CREATE INDEX ix_transactions_source ON transactions (source)")
            )
            connection.execute(
                text("CREATE INDEX ix_transactions_direction ON transactions (direction)")
            )
            connection.execute(
                text("CREATE INDEX ix_transactions_date ON transactions (date)")
            )

        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
        connection.commit()

    _normalise_cashflow_rule_values(engine)


def _run_user_scoped_dedupe_index_migrations(engine: Engine) -> None:
    dedupe_index_migrations = [
        (
            "transactions",
            "ix_transactions_dedupe_hash",
            "ix_transactions_user_dedupe_hash",
        ),
        (
            "investment_events",
            "ix_investment_events_dedupe_hash",
            "ix_investment_events_user_dedupe_hash",
        ),
        (
            "owed_items",
            "ix_owed_items_dedupe_hash",
            "ix_owed_items_user_dedupe_hash",
        ),
        (
            "wealth_snapshots",
            "ix_wealth_snapshots_dedupe_hash",
            "ix_wealth_snapshots_user_dedupe_hash",
        ),
    ]

    for table_name, old_index_name, new_index_name in dedupe_index_migrations:
        if not _table_exists(engine=engine, table_name=table_name):
            continue

        if _index_exists(
            engine=engine,
            table_name=table_name,
            index_name=old_index_name,
        ):
            _drop_index_if_exists(engine=engine, index_name=old_index_name)

        if not _index_exists(
            engine=engine,
            table_name=table_name,
            index_name=new_index_name,
        ):
            _create_user_scoped_dedupe_index(
                engine=engine,
                table_name=table_name,
                index_name=new_index_name,
            )


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



def _run_investment_funding_month_migrations(engine: Engine) -> None:
    if _table_exists(engine=engine, table_name="investment_funding_months"):
        return

    if engine.dialect.name == "postgresql":
        create_table_sql = """
            CREATE TABLE investment_funding_months (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(100) NOT NULL DEFAULT 'local-default-user',
                month VARCHAR(7) NOT NULL,
                source VARCHAR(50) NOT NULL,
                manual_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
                cashback_rounding_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
                currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT ck_investment_funding_months_month_length CHECK (length(month) = 7),
                CONSTRAINT ck_investment_funding_months_manual_non_negative CHECK (manual_amount >= 0),
                CONSTRAINT ck_investment_funding_months_cashback_rounding_non_negative CHECK (cashback_rounding_amount >= 0),
                CONSTRAINT ck_investment_funding_months_currency_length CHECK (length(currency) = 3),
                CONSTRAINT uq_investment_funding_months_user_month_source UNIQUE (user_id, month, source)
            )
        """
    else:
        create_table_sql = """
            CREATE TABLE investment_funding_months (
                id INTEGER PRIMARY KEY,
                user_id VARCHAR(100) NOT NULL DEFAULT 'local-default-user',
                month VARCHAR(7) NOT NULL,
                source VARCHAR(50) NOT NULL,
                manual_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
                cashback_rounding_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
                currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
                notes TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT ck_investment_funding_months_month_length CHECK (length(month) = 7),
                CONSTRAINT ck_investment_funding_months_manual_non_negative CHECK (manual_amount >= 0),
                CONSTRAINT ck_investment_funding_months_cashback_rounding_non_negative CHECK (cashback_rounding_amount >= 0),
                CONSTRAINT ck_investment_funding_months_currency_length CHECK (length(currency) = 3),
                CONSTRAINT uq_investment_funding_months_user_month_source UNIQUE (user_id, month, source)
            )
        """

    with engine.begin() as connection:
        connection.execute(text(create_table_sql))
        connection.execute(
            text(
                "CREATE INDEX ix_investment_funding_months_user_month "
                "ON investment_funding_months (user_id, month)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX ix_investment_funding_months_user_source "
                "ON investment_funding_months (user_id, source)"
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



def _run_owed_payment_migrations(engine: Engine) -> None:
    if not _table_exists(engine=engine, table_name="owed_payments"):
        return

    owed_payment_column_migrations = {
        "unallocated_category": "ALTER TABLE owed_payments ADD COLUMN unallocated_category VARCHAR(100)",
        "unallocated_notes": "ALTER TABLE owed_payments ADD COLUMN unallocated_notes TEXT",
    }

    for column_name, sql in owed_payment_column_migrations.items():
        _add_column_if_missing(
            engine=engine,
            table_name="owed_payments",
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


def _index_exists(engine: Engine, table_name: str, index_name: str) -> bool:
    inspector = inspect(engine)

    return any(
        index["name"] == index_name
        for index in inspector.get_indexes(table_name)
    )


def _drop_index_if_exists(engine: Engine, index_name: str) -> None:
    try:
        with engine.begin() as connection:
            connection.execute(text(f"DROP INDEX IF EXISTS {index_name}"))
    except OperationalError as error:
        if "no such index" in str(error).lower():
            return

        raise


def _create_user_scoped_dedupe_index(
    engine: Engine,
    table_name: str,
    index_name: str,
) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                f"CREATE UNIQUE INDEX {index_name} "
                f"ON {table_name} (user_id, dedupe_hash)"
            )
        )


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
