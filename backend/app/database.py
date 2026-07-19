import os
from collections.abc import Generator
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import (
    get_database_connect_timeout_seconds,
    get_database_statement_timeout_ms,
)


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DEFAULT_SQLITE_DATABASE_URL = f"sqlite:///{DATA_DIR / 'finance.db'}"


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL", "").strip()

    if database_url:
        return normalise_database_url(database_url)

    return DEFAULT_SQLITE_DATABASE_URL


def normalise_database_url(database_url: str) -> str:
    """Return a SQLAlchemy-compatible database URL.

    Hosted Postgres providers may expose postgres:// or postgresql:// URLs.
    The app installs psycopg, so make the driver explicit for SQLAlchemy.
    Local SQLite URLs are kept untouched.
    """

    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+psycopg://", 1)

    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)

    return database_url


def get_database_dialect(database_url: str) -> str:
    return database_url.split(":", 1)[0].lower()


def is_sqlite_database_url(database_url: str) -> bool:
    return get_database_dialect(database_url) == "sqlite"


def get_engine_kwargs(database_url: str) -> dict[str, Any]:
    if is_sqlite_database_url(database_url):
        return {
            "connect_args": {
                "check_same_thread": False,
                "timeout": get_database_connect_timeout_seconds(),
            }
        }

    if get_database_dialect(database_url).startswith("postgresql"):
        statement_timeout = get_database_statement_timeout_ms()
        return {
            "connect_args": {
                "connect_timeout": get_database_connect_timeout_seconds(),
                "options": f"-c statement_timeout={statement_timeout}",
            },
            "pool_timeout": get_database_connect_timeout_seconds(),
            "pool_pre_ping": True,
        }

    return {}


def enable_sqlite_foreign_keys(database_engine: Engine) -> None:
    """Enable SQLite foreign-key enforcement for every new connection."""

    if database_engine.dialect.name != "sqlite":
        return

    @event.listens_for(database_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record) -> None:
        del connection_record

        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()


DATABASE_URL = get_database_url()


class Base(DeclarativeBase):
    pass


engine = create_engine(
    DATABASE_URL,
    **get_engine_kwargs(DATABASE_URL),
)
enable_sqlite_foreign_keys(engine)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_postgres_startup_migrations(database_engine: Engine) -> None:
    """Run small hosted Postgres compatibility migrations.

    Render's free tier does not provide shell access, so narrowly scoped,
    idempotent startup migrations are used for production constraint fixes.
    """

    if database_engine.dialect.name != "postgresql":
        return

    with database_engine.begin() as connection:
        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = 'public'
                        AND table_name = 'transactions'
                    ) THEN
                        ALTER TABLE transactions
                        DROP CONSTRAINT IF EXISTS ck_transactions_cashflow_type_known;

                        UPDATE transactions
                        SET cashflow_type = CASE
                            WHEN direction = 'in' THEN 'income'
                            WHEN direction = 'out' THEN 'expense'
                            ELSE 'expense'
                        END
                        WHERE cashflow_type IS NULL
                        OR cashflow_type NOT IN ('income', 'expense', 'transfer');

                        ALTER TABLE transactions
                        ADD CONSTRAINT ck_transactions_cashflow_type_known
                        CHECK (cashflow_type IN ('income', 'expense', 'transfer'));
                    END IF;
                END $$;
                """
            )
        )


def initialise_database(database_engine: Engine = engine) -> None:
    """Initialise database objects needed by the application.

    SQLite uses SQLAlchemy table creation plus legacy startup migrations.
    Hosted Postgres uses narrowly scoped startup compatibility migrations.
    """

    from app.database_migrations import run_startup_migrations
    import app.models  # noqa: F401

    if not is_sqlite_database_url(str(database_engine.url)):
        run_postgres_startup_migrations(database_engine)
        return

    Base.metadata.create_all(bind=database_engine)
    run_startup_migrations(database_engine)
