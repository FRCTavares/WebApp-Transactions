from app.database import (
    DEFAULT_SQLITE_DATABASE_URL,
    get_database_dialect,
    get_database_url,
    get_engine_kwargs,
    is_sqlite_database_url,
    normalise_database_url,
)


def test_database_url_defaults_to_local_sqlite(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)

    assert get_database_url() == DEFAULT_SQLITE_DATABASE_URL
    assert get_database_url().startswith("sqlite:///")


def test_empty_database_url_uses_local_sqlite_default(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "   ")

    assert get_database_url() == DEFAULT_SQLITE_DATABASE_URL


def test_database_url_can_use_postgres(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://postgres:password@example.supabase.co:5432/postgres",
    )

    assert (
        get_database_url()
        == "postgresql+psycopg://postgres:password@example.supabase.co:5432/postgres"
    )


def test_postgres_url_alias_is_normalised_for_sqlalchemy():
    assert (
        normalise_database_url("postgres://user:password@example.com:5432/db")
        == "postgresql+psycopg://user:password@example.com:5432/db"
    )


def test_postgresql_url_uses_explicit_psycopg_driver():
    assert (
        normalise_database_url("postgresql://user:password@example.com:5432/db")
        == "postgresql+psycopg://user:password@example.com:5432/db"
    )


def test_database_dialect_detection():
    assert get_database_dialect("sqlite:///local.db") == "sqlite"
    assert (
        get_database_dialect("postgresql+psycopg://user:password@example.com/db")
        == "postgresql+psycopg"
    )


def test_sqlite_database_url_detection():
    assert is_sqlite_database_url("sqlite:///local.db") is True
    assert is_sqlite_database_url("sqlite://") is True
    assert (
        is_sqlite_database_url("postgresql+psycopg://user:password@example.com/db")
        is False
    )


def test_sqlite_engine_kwargs_include_check_same_thread():
    assert get_engine_kwargs("sqlite:///local.db") == {
        "connect_args": {"check_same_thread": False}
    }


def test_postgres_engine_kwargs_do_not_include_sqlite_connect_args():
    assert get_engine_kwargs("postgresql+psycopg://user:password@example.com/db") == {}
