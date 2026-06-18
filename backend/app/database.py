import os
from collections.abc import Generator
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


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

    Some hosted Postgres providers expose postgres:// URLs. SQLAlchemy expects
    postgresql://, so normalise that form here while keeping local SQLite
    untouched.
    """

    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql://", 1)

    return database_url


def get_database_dialect(database_url: str) -> str:
    return database_url.split(":", 1)[0].lower()


def is_sqlite_database_url(database_url: str) -> bool:
    return get_database_dialect(database_url) == "sqlite"


def get_engine_kwargs(database_url: str) -> dict[str, Any]:
    if is_sqlite_database_url(database_url):
        return {"connect_args": {"check_same_thread": False}}

    return {}


DATABASE_URL = get_database_url()


class Base(DeclarativeBase):
    pass


engine = create_engine(
    DATABASE_URL,
    **get_engine_kwargs(DATABASE_URL),
)

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


def initialise_database(database_engine: Engine = engine) -> None:
    from app.database_migrations import run_startup_migrations
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=database_engine)
    run_startup_migrations(database_engine)
