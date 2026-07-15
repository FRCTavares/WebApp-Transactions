from dataclasses import replace
from datetime import timedelta
from decimal import Decimal
from typing import TypeVar

from app.importers.base import (
    ImportParseResult,
    NormalisedInvestmentEvent,
    NormalisedTransaction,
)
from app.services.market_data.base import (
    MarketDataProvider,
    MarketDataProviderError,
)


NormalisedRow = TypeVar(
    "NormalisedRow",
    NormalisedTransaction,
    NormalisedInvestmentEvent,
)


class ImportFxResolutionService:
    def __init__(
        self,
        provider: MarketDataProvider,
        lookback_days: int = 7,
    ) -> None:
        self.provider = provider
        self.lookback_days = lookback_days
        self._rate_cache: dict[
            tuple[str, object],
            tuple[Decimal, str] | None,
        ] = {}

    def resolve(self, parse_result: ImportParseResult) -> ImportParseResult:
        return ImportParseResult(
            transactions=[
                self._resolve_row(transaction)
                for transaction in parse_result.transactions
            ],
            investment_events=[
                self._resolve_row(event)
                for event in parse_result.investment_events
            ],
        )

    def _resolve_row(self, row: NormalisedRow) -> NormalisedRow:
        currency = row.currency.upper()

        if currency == "EUR":
            return replace(
                row,
                fx_rate_to_eur=Decimal("1"),
                fx_rate_source="source_currency",
            )

        if (
            row.fx_rate_to_eur is not None
            and row.fx_rate_source != "pending"
        ):
            return row

        if (
            isinstance(row, NormalisedInvestmentEvent)
            and row.event_type == "deposit"
            and row.funding_match_status == "unmatched"
        ):
            return row

        resolved_rate = self._get_rate(
            currency=currency,
            value_date=row.date,
        )

        if resolved_rate is None:
            return row

        rate, source = resolved_rate
        return replace(
            row,
            fx_rate_to_eur=rate,
            fx_rate_source=source,
        )

    def _get_rate(
        self,
        *,
        currency: str,
        value_date,
    ) -> tuple[Decimal, str] | None:
        cache_key = (currency, value_date)

        if cache_key in self._rate_cache:
            return self._rate_cache[cache_key]

        symbol = f"{currency}EUR=X"
        date_from = value_date - timedelta(days=self.lookback_days)

        try:
            points = self.provider.get_history(
                symbol=symbol,
                date_from=date_from,
                date_to=value_date,
            )
        except MarketDataProviderError:
            self._rate_cache[cache_key] = None
            return None

        eligible_points = [
            point
            for point in points
            if (
                point.price_date <= value_date
                and point.close_price > 0
                and point.currency.upper() == "EUR"
            )
        ]

        if not eligible_points:
            self._rate_cache[cache_key] = None
            return None

        selected_point = max(
            eligible_points,
            key=lambda point: point.price_date,
        )
        rate = selected_point.close_price.quantize(
            Decimal("0.00000001")
        )
        source = (
            "yfinance_historical:"
            f"{selected_point.price_date.isoformat()}"
        )
        resolved = (rate, source)
        self._rate_cache[cache_key] = resolved
        return resolved
