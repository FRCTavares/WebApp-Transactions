import pytest

from app.config import validate_e2e_config


def test_e2e_guard_is_inert_outside_e2e(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("DATABASE_URL", raising=False)

    validate_e2e_config()


def test_e2e_guard_requires_a_database_url(monkeypatch):
    monkeypatch.setenv("APP_ENV", "e2e")
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(RuntimeError, match="DATABASE_URL is required"):
        validate_e2e_config()


def test_e2e_guard_refuses_the_real_database(monkeypatch):
    monkeypatch.setenv("APP_ENV", "e2e")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./data/finance.db")

    with pytest.raises(RuntimeError, match="Refusing to run an e2e backend"):
        validate_e2e_config()


def test_e2e_guard_accepts_a_throwaway_database(monkeypatch):
    monkeypatch.setenv("APP_ENV", "e2e")
    monkeypatch.setenv("DATABASE_URL", "sqlite:////tmp/e2e-tests.db")

    validate_e2e_config()
