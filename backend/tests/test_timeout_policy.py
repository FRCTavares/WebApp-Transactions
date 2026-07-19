import asyncio
import logging
import time

import pytest
from sqlalchemy.exc import OperationalError, TimeoutError as SqlAlchemyTimeoutError

from app.config import get_positive_int_env
from app.main import handle_database_timeout, is_database_timeout
from app.services.market_data.base import MarketDataProviderError
from app.services.market_data.yfinance_provider import YFinanceMarketDataProvider


def test_positive_timeout_configuration_is_validated(monkeypatch):
    monkeypatch.setenv("TEST_TIMEOUT", "0")
    with pytest.raises(RuntimeError, match="positive integer"):
        get_positive_int_env("TEST_TIMEOUT", 10)


def test_database_timeout_detection_is_narrow():
    assert is_database_timeout(SqlAlchemyTimeoutError("pool exhausted"))
    assert is_database_timeout(
        OperationalError("select", {}, Exception("statement timeout"))
    )
    assert not is_database_timeout(
        OperationalError("select", {}, Exception("connection refused"))
    )


def test_database_timeout_response_is_controlled_and_redacted():
    error = SqlAlchemyTimeoutError("password=secret SELECT private_data")
    response = asyncio.run(handle_database_timeout(None, error))

    assert response.status_code == 503
    assert response.headers["retry-after"] == "1"
    assert (
        response.body == b'{"detail":"Database operation timed out. Try again later."}'
    )
    assert b"secret" not in response.body
    assert b"private_data" not in response.body


def test_market_data_timeout_returns_promptly_without_logging_symbol(
    caplog, monkeypatch
):
    provider = YFinanceMarketDataProvider(timeout_seconds=0.01)
    monkeypatch.setattr(provider, "_get_latest_price", lambda symbol: time.sleep(0.2))
    caplog.set_level(logging.WARNING, logger="app.market_data")

    started_at = time.perf_counter()
    with pytest.raises(MarketDataProviderError, match="timed out"):
        provider.get_latest_price("SECRET-SYMBOL")

    assert time.perf_counter() - started_at < 0.15
    assert "SECRET-SYMBOL" not in caplog.text
