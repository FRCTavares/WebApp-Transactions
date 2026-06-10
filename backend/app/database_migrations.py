from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def run_startup_migrations(engine: Engine) -> None:
    """Small SQLite-safe migrations until the project adopts Alembic."""

    inspector = inspect(engine)
    transaction_columns = {
        column["name"]
        for column in inspector.get_columns("transactions")
    }

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
