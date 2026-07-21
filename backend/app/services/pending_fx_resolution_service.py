"""Resolve FX rates that were left pending on already-stored investment events.

`ImportFxResolutionService` resolves rates *during* an import. Events imported
before that existed - or imported while the provider was unreachable - keep
`fx_rate_source = "pending"` and a null `fx_rate_to_eur` forever, because
nothing ever revisits them.

That is not merely cosmetic. Historical portfolio valuation converts every
holding to EUR using a rate carried on an event, so a single unresolved non-EUR
event makes every month from that date onward unvaluable. In practice this
silently truncated the portfolio trend by a year.

Design notes:
- Preview first, commit second, mirroring this project's import workflow.
  Nothing is written until the caller explicitly commits.
- Rates are never invented. If the provider has no rate on or before an event's
  date, that event stays pending and is reported as unresolved.
- One provider call per currency covering the whole span, rather than one per
  event date. Resolving 82 events individually would have meant 76 requests.
- `fx_rate_source` records the exact date of the rate used
  ("yfinance_historical:2024-09-06"), so every resolved value stays auditable.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser
from app.models.investment_event import InvestmentEvent
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.services.market_data.base import (
    MarketDataProvider,
    MarketDataProviderError,
)

# `fx_rate_source` is String(30); "yfinance_historical:" plus an ISO date is
# exactly 30 characters, so the prefix cannot grow without a migration.
SOURCE_PREFIX = "yfinance_historical:"


@dataclass(frozen=True)
class PendingFxResolution:
    event_id: int
    event_date: date
    currency: str
    ticker: str | None
    resolved_rate: Decimal | None
    rate_date: date | None

    @property
    def is_resolved(self) -> bool:
        return self.resolved_rate is not None


@dataclass(frozen=True)
class PendingFxSummary:
    pending_count: int
    resolvable_count: int
    unresolvable_count: int
    currencies: list[str]
    earliest_date: date | None
    latest_date: date | None
    resolutions: list[PendingFxResolution]


class PendingFxResolutionService:
    def __init__(
        self,
        db: Session,
        repository: InvestmentEventRepository,
        provider: MarketDataProvider | None,
        *,
        lookback_days: int = 10,
    ) -> None:
        # The service owns the transaction for this multi-record write, per the
        # project's layering rules; the repository only reads.
        self.db = db
        self.repository = repository
        self.provider = provider
        self.lookback_days = lookback_days

    def preview(self, *, current_user: CurrentUser) -> PendingFxSummary:
        events = self.repository.list_unresolved_fx(user_id=current_user.id)

        if not events:
            return PendingFxSummary(
                pending_count=0,
                resolvable_count=0,
                unresolvable_count=0,
                currencies=[],
                earliest_date=None,
                latest_date=None,
                resolutions=[],
            )

        rates_by_currency = self._load_rates(events)
        resolutions = [
            self._build_resolution(event, rates_by_currency)
            for event in events
        ]

        return PendingFxSummary(
            pending_count=len(events),
            resolvable_count=sum(1 for item in resolutions if item.is_resolved),
            unresolvable_count=sum(1 for item in resolutions if not item.is_resolved),
            currencies=sorted({event.currency.upper() for event in events}),
            earliest_date=min(event.date for event in events),
            latest_date=max(event.date for event in events),
            resolutions=resolutions,
        )

    def resolve(self, *, current_user: CurrentUser) -> PendingFxSummary:
        """Apply every resolvable rate in one transaction.

        Events the provider cannot cover are left exactly as they were - they
        stay pending and are still reported, rather than being filled with a
        guess or quietly dropped.
        """
        events = self.repository.list_unresolved_fx(user_id=current_user.id)

        if not events:
            return self.preview(current_user=current_user)

        rates_by_currency = self._load_rates(events)
        events_by_id = {event.id: event for event in events}
        resolutions = [
            self._build_resolution(event, rates_by_currency)
            for event in events
        ]

        applied = 0

        for resolution in resolutions:
            if not resolution.is_resolved or resolution.rate_date is None:
                continue

            event = events_by_id[resolution.event_id]
            event.fx_rate_to_eur = resolution.resolved_rate
            event.fx_rate_source = f"{SOURCE_PREFIX}{resolution.rate_date.isoformat()}"
            applied += 1

        if applied:
            # One commit for the whole batch: either every resolvable rate
            # lands or none of them do.
            self.db.commit()

        return PendingFxSummary(
            pending_count=len(events),
            resolvable_count=applied,
            unresolvable_count=len(events) - applied,
            currencies=sorted({event.currency.upper() for event in events}),
            earliest_date=min(event.date for event in events),
            latest_date=max(event.date for event in events),
            resolutions=resolutions,
        )

    def _load_rates(
        self,
        events: list[InvestmentEvent],
    ) -> dict[str, list[tuple[date, Decimal]]]:
        if self.provider is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Market data provider is not configured",
            )

        rates: dict[str, list[tuple[date, Decimal]]] = {}

        for currency in sorted({event.currency.upper() for event in events}):
            dates = [event.date for event in events if event.currency.upper() == currency]
            date_from = min(dates) - timedelta(days=self.lookback_days)
            date_to = max(dates)

            try:
                points = self.provider.get_history(
                    symbol=f"{currency}EUR=X",
                    date_from=date_from,
                    date_to=date_to,
                )
            except MarketDataProviderError:
                # A currency the provider cannot serve leaves its events
                # pending rather than failing the whole batch.
                rates[currency] = []
                continue

            rates[currency] = sorted(
                (point.price_date, point.close_price)
                for point in points
                if point.close_price > 0 and point.currency.upper() == "EUR"
            )

        return rates

    def _build_resolution(
        self,
        event: InvestmentEvent,
        rates_by_currency: dict[str, list[tuple[date, Decimal]]],
    ) -> PendingFxResolution:
        currency = event.currency.upper()
        candidates = [
            (rate_date, rate)
            for rate_date, rate in rates_by_currency.get(currency, [])
            if rate_date <= event.date
        ]

        if not candidates:
            return PendingFxResolution(
                event_id=event.id,
                event_date=event.date,
                currency=currency,
                ticker=event.ticker,
                resolved_rate=None,
                rate_date=None,
            )

        rate_date, rate = candidates[-1]

        return PendingFxResolution(
            event_id=event.id,
            event_date=event.date,
            currency=currency,
            ticker=event.ticker,
            resolved_rate=rate.quantize(Decimal("0.00000001")),
            rate_date=rate_date,
        )
