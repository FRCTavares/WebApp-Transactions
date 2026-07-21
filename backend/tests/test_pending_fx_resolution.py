from datetime import date
from decimal import Decimal

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.models.investment_event import InvestmentEvent
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.services.market_data.base import (
    MarketDataHistoryPoint,
    MarketDataProviderError,
)
from app.services.pending_fx_resolution_service import PendingFxResolutionService


CURRENT_USER = CurrentUser(id=LOCAL_DEFAULT_USER_ID)


class StubProvider:
    """Returns a fixed USD/EUR series and records every call."""

    def __init__(self, points=None, fail_for: set[str] | None = None) -> None:
        self.points = points if points is not None else [
            MarketDataHistoryPoint(
                price_date=date(2024, 9, 6),
                close_price=Decimal("0.90000000"),
                currency="EUR",
            ),
            MarketDataHistoryPoint(
                price_date=date(2024, 9, 9),
                close_price=Decimal("0.91000000"),
                currency="EUR",
            ),
        ]
        self.fail_for = fail_for or set()
        self.calls: list[str] = []

    def get_latest_price(self, symbol: str):  # pragma: no cover - unused here
        raise NotImplementedError

    def get_history(self, symbol: str, date_from: date, date_to: date):
        self.calls.append(symbol)

        if symbol in self.fail_for:
            raise MarketDataProviderError(f"no data for {symbol}")

        return self.points


def _add_event(db_session, **overrides) -> InvestmentEvent:
    defaults = dict(
        user_id=LOCAL_DEFAULT_USER_ID,
        source="trading212",
        event_type="market_buy",
        date=date(2024, 9, 9),
        description="CSPX buy",
        raw_description="CSPX buy",
        ticker="CSPX",
        quantity=Decimal("1"),
        price=Decimal("500"),
        amount=Decimal("500"),
        currency="USD",
        fx_rate_to_eur=None,
        fx_rate_source="pending",
    )
    defaults.update(overrides)
    # user_id is passed explicitly, not folded into **defaults: the ownership
    # guard in test_ownership_boundaries.py inspects the AST of every
    # user-owned model construction and requires the keyword to be visible.
    event = InvestmentEvent(user_id=defaults.pop("user_id"), **defaults)
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event


def _build_service(db_session, provider):
    return PendingFxResolutionService(
        db=db_session,
        repository=InvestmentEventRepository(db_session),
        provider=provider,
    )


def test_preview_reports_resolvable_rates_without_writing(db_session):
    event = _add_event(db_session)
    service = _build_service(db_session, StubProvider())

    summary = service.preview(current_user=CURRENT_USER)

    assert summary.pending_count == 1
    assert summary.resolvable_count == 1
    assert summary.unresolvable_count == 0
    assert summary.currencies == ["USD"]

    db_session.refresh(event)
    assert event.fx_rate_to_eur is None
    assert event.fx_rate_source == "pending"


def test_resolve_applies_the_rate_dated_on_or_before_the_event(db_session):
    event = _add_event(db_session)
    service = _build_service(db_session, StubProvider())

    summary = service.resolve(current_user=CURRENT_USER)

    assert summary.resolvable_count == 1
    db_session.refresh(event)
    # 2024-09-09 is available, so it must be preferred over the 09-06 point.
    assert event.fx_rate_to_eur == Decimal("0.91000000")
    assert event.fx_rate_source == "yfinance_historical:2024-09-09"


def test_resolve_never_uses_a_rate_dated_after_the_event(db_session):
    event = _add_event(db_session, date=date(2024, 9, 7))
    service = _build_service(db_session, StubProvider())

    service.resolve(current_user=CURRENT_USER)

    db_session.refresh(event)
    # Only the 09-06 point is on or before 09-07.
    assert event.fx_rate_to_eur == Decimal("0.90000000")
    assert event.fx_rate_source == "yfinance_historical:2024-09-06"


def test_events_without_a_usable_rate_stay_pending(db_session):
    # Every provider point post-dates this event, so nothing may be applied.
    event = _add_event(db_session, date=date(2024, 1, 1))
    service = _build_service(db_session, StubProvider())

    summary = service.resolve(current_user=CURRENT_USER)

    assert summary.resolvable_count == 0
    assert summary.unresolvable_count == 1
    db_session.refresh(event)
    assert event.fx_rate_to_eur is None
    assert event.fx_rate_source == "pending"


def test_provider_failure_leaves_events_pending_rather_than_erroring(db_session):
    event = _add_event(db_session)
    service = _build_service(db_session, StubProvider(fail_for={"USDEUR=X"}))

    summary = service.resolve(current_user=CURRENT_USER)

    assert summary.unresolvable_count == 1
    db_session.refresh(event)
    assert event.fx_rate_source == "pending"


def test_eur_and_already_resolved_events_are_untouched(db_session):
    eur_event = _add_event(
        db_session,
        currency="EUR",
        fx_rate_to_eur=Decimal("1"),
        fx_rate_source="source_currency",
    )
    resolved_event = _add_event(
        db_session,
        fx_rate_to_eur=Decimal("0.88000000"),
        fx_rate_source="manual",
    )
    service = _build_service(db_session, StubProvider())

    summary = service.preview(current_user=CURRENT_USER)

    assert summary.pending_count == 0
    db_session.refresh(eur_event)
    db_session.refresh(resolved_event)
    assert eur_event.fx_rate_source == "source_currency"
    assert resolved_event.fx_rate_to_eur == Decimal("0.88000000")


def test_one_provider_call_per_currency_not_per_event(db_session):
    for day in (9, 10, 11, 12):
        _add_event(db_session, date=date(2024, 9, day))

    provider = StubProvider(
        points=[
            MarketDataHistoryPoint(
                price_date=date(2024, 9, 9),
                close_price=Decimal("0.91000000"),
                currency="EUR",
            )
        ]
    )
    service = _build_service(db_session, provider)

    summary = service.resolve(current_user=CURRENT_USER)

    assert summary.resolvable_count == 4
    assert provider.calls == ["USDEUR=X"]


def test_resolution_is_idempotent(db_session):
    _add_event(db_session)
    service = _build_service(db_session, StubProvider())

    service.resolve(current_user=CURRENT_USER)
    second = service.resolve(current_user=CURRENT_USER)

    assert second.pending_count == 0
    assert second.resolvable_count == 0
