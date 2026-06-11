from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def run_startup_migrations(engine: Engine) -> None:
    """Small SQLite-safe migrations until the project adopts Alembic."""

    inspector = inspect(engine)
    transaction_columns = {
        column["name"]
        for column in inspector.get_columns("transactions")
    }

    transaction_column_migrations = {
        "original_amount": "ALTER TABLE transactions ADD COLUMN original_amount NUMERIC(12, 2)",
        "original_currency": "ALTER TABLE transactions ADD COLUMN original_currency VARCHAR(3)",
        "fx_rate_to_eur": "ALTER TABLE transactions ADD COLUMN fx_rate_to_eur NUMERIC(18, 8)",
        "fx_rate_source": "ALTER TABLE transactions ADD COLUMN fx_rate_source VARCHAR(30)",
    }

    for column_name, sql in transaction_column_migrations.items():
        if column_name not in transaction_columns:
            with engine.begin() as connection:
                connection.execute(text(sql))

    if "cashflow_type" not in transaction_columns:
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
