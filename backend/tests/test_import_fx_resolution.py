from datetime import date
from decimal import Decimal

from app.importers.base import (
    ImportParseResult,
    NormalisedInvestmentEvent,
    NormalisedTransaction,
)
from app.services.import_fx_resolution_service import (
    ImportFxResolutionService,
)
from app.services.market_data.base import (
    MarketDataHistoryPoint,
    MarketDataProviderError,
)


class FakeFxProvider:
    def __init__(self, points=None, error: Exception | None = None):
        self.points = points or []
        self.error = error
        self.calls = []

    def get_history(self, symbol, date_from, date_to):
        self.calls.append((symbol, date_from, date_to))

        if self.error is not None:
            raise self.error

        return self.points


def build_transaction(
    *,
    value_date=date(2024, 9, 9),
    currency="USD",
):
    return NormalisedTransaction(
        date=value_date,
        raw_description="Foreign card payment",
        description="Foreign card payment",
        amount=Decimal("100.00"),
        direction="out",
        source="trading212",
        account="Trading 212",
        currency=currency,
        original_amount=Decimal("100.00"),
        original_currency=currency,
        fx_rate_source="pending",
    )


def build_event(
    *,
    event_type="market_buy",
    value_date=date(2024, 9, 9),
):
    return NormalisedInvestmentEvent(
        date=value_date,
        source="trading212",
        account="Trading 212",
        event_type=event_type,
        description=event_type,
        raw_description=event_type,
        amount=Decimal("100.00"),
        currency="USD",
        original_amount=Decimal("100.00"),
        original_currency="USD",
        fx_rate_source="pending",
        funding_source=(
            "activobank"
            if event_type == "deposit"
            else None
        ),
        funding_match_status=(
            "unmatched"
            if event_type == "deposit"
            else None
        ),
    )


def test_resolves_transaction_and_market_event_with_historical_rate():
    provider = FakeFxProvider(
        points=[
            MarketDataHistoryPoint(
                price_date=date(2024, 9, 6),
                close_price=Decimal("0.902345678"),
                currency="EUR",
            )
        ]
    )
    service = ImportFxResolutionService(provider)

    result = service.resolve(
        ImportParseResult(
            transactions=[build_transaction()],
            investment_events=[build_event()],
        )
    )

    transaction = result.transactions[0]
    event = result.investment_events[0]

    assert transaction.fx_rate_to_eur == Decimal("0.90234568")
    assert event.fx_rate_to_eur == Decimal("0.90234568")
    assert (
        transaction.fx_rate_source
        == "yfinance_historical:2024-09-06"
    )
    assert event.fx_rate_source == transaction.fx_rate_source
    assert provider.calls == [
        (
            "USDEUR=X",
            date(2024, 9, 2),
            date(2024, 9, 9),
        )
    ]


def test_selects_latest_rate_on_or_before_event_date():
    provider = FakeFxProvider(
        points=[
            MarketDataHistoryPoint(
                price_date=date(2024, 9, 5),
                close_price=Decimal("0.89"),
                currency="EUR",
            ),
            MarketDataHistoryPoint(
                price_date=date(2024, 9, 6),
                close_price=Decimal("0.90"),
                currency="EUR",
            ),
            MarketDataHistoryPoint(
                price_date=date(2024, 9, 10),
                close_price=Decimal("0.91"),
                currency="EUR",
            ),
        ]
    )

    result = ImportFxResolutionService(provider).resolve(
        ImportParseResult(
            transactions=[build_transaction()],
        )
    )

    assert result.transactions[0].fx_rate_to_eur == Decimal(
        "0.90000000"
    )
    assert (
        result.transactions[0].fx_rate_source
        == "yfinance_historical:2024-09-06"
    )


def test_unmatched_deposit_remains_pending_for_exact_bank_match():
    provider = FakeFxProvider(
        points=[
            MarketDataHistoryPoint(
                price_date=date(2024, 9, 9),
                close_price=Decimal("0.90"),
                currency="EUR",
            )
        ]
    )

    result = ImportFxResolutionService(provider).resolve(
        ImportParseResult(
            investment_events=[build_event(event_type="deposit")],
        )
    )

    event = result.investment_events[0]

    assert event.fx_rate_to_eur is None
    assert event.fx_rate_source == "pending"
    assert provider.calls == []


def test_provider_failure_leaves_row_pending():
    provider = FakeFxProvider(
        error=MarketDataProviderError("provider unavailable")
    )

    result = ImportFxResolutionService(provider).resolve(
        ImportParseResult(
            transactions=[build_transaction()],
        )
    )

    transaction = result.transactions[0]

    assert transaction.fx_rate_to_eur is None
    assert transaction.fx_rate_source == "pending"
