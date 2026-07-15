from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from time import perf_counter

import pytest
from sqlalchemy import event as sqlalchemy_event

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.models.investment_event import InvestmentEvent
from app.models.market_price import MarketPrice
from app.models.market_price_history import MarketPriceHistory
from app.models.wealth_account import WealthAccount
from app.models.wealth_snapshot import WealthSnapshot


@dataclass(frozen=True)
class EndpointMeasurement:
    path: str
    duration_seconds: float
    select_count: int


def subtract_months(value: date, months: int) -> date:
    month_index = value.year * 12 + value.month - 1 - months
    year, zero_based_month = divmod(month_index, 12)
    return date(year, zero_based_month + 1, 1)


def month_end(value: date) -> date:
    next_month = subtract_months(value, -1)
    return date.fromordinal(next_month.toordinal() - 1)


def seed_financial_history(db_session) -> None:
    today = date.today()
    first_month = subtract_months(today.replace(day=1), 23)

    account = WealthAccount(
        user_id=LOCAL_DEFAULT_USER_ID,
        name="Performance Savings",
        account_type="savings_account",
        currency="EUR",
        is_active=True,
    )
    db_session.add(account)
    db_session.flush()

    snapshots: list[WealthSnapshot] = []
    prices: list[MarketPriceHistory] = []

    for index in range(24):
        month_start = subtract_months(first_month, -index)
        valuation_date = min(month_end(month_start), today)

        snapshots.append(
            WealthSnapshot(
                user_id=LOCAL_DEFAULT_USER_ID,
                account_id=account.id,
                snapshot_date=valuation_date,
                balance=Decimal("10000.00") + Decimal(index * 100),
                currency="EUR",
                balance_eur=Decimal("10000.00") + Decimal(index * 100),
                fx_rate_to_eur=Decimal("1"),
            )
        )
        prices.append(
            MarketPriceHistory(
                ticker="CSPX",
                isin="IE00B5BMR087",
                price_date=valuation_date,
                close_price=Decimal("100.00") + Decimal(index),
                currency="EUR",
                source="performance-test",
            )
        )

    db_session.add_all(snapshots)
    db_session.add_all(prices)
    db_session.add(
        InvestmentEvent(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=first_month,
            source="trading212",
            account="Trading 212",
            event_type="market_buy",
            description="Performance fixture CSPX buy",
            raw_description="Performance fixture CSPX buy",
            instrument_name="iShares Core S&P 500",
            ticker="CSPX",
            isin="IE00B5BMR087",
            quantity=Decimal("10"),
            price=Decimal("100"),
            amount=Decimal("1000"),
            currency="EUR",
            fx_rate_to_eur=Decimal("1"),
        )
    )
    db_session.add(
        MarketPrice(
            ticker="CSPX",
            isin="IE00B5BMR087",
            price=Decimal("123.00"),
            currency="EUR",
            source="performance-test",
        )
    )
    db_session.commit()


def measure_endpoint(
    *,
    client,
    db_session,
    path: str,
) -> EndpointMeasurement:
    warm_response = client.get(path)
    assert warm_response.status_code == 200

    select_count = 0
    engine = db_session.get_bind()

    def count_selects(
        connection,
        cursor,
        statement,
        parameters,
        context,
        executemany,
    ) -> None:
        nonlocal select_count
        del connection, cursor, parameters, context, executemany

        if statement.lstrip().lower().startswith("select"):
            select_count += 1

    sqlalchemy_event.listen(
        engine,
        "before_cursor_execute",
        count_selects,
    )

    try:
        started_at = perf_counter()
        response = client.get(path)
        duration_seconds = perf_counter() - started_at
    finally:
        sqlalchemy_event.remove(
            engine,
            "before_cursor_execute",
            count_selects,
        )

    assert response.status_code == 200

    return EndpointMeasurement(
        path=path,
        duration_seconds=duration_seconds,
        select_count=select_count,
    )


@pytest.mark.parametrize(
    ("path", "maximum_select_count"),
    [
        ("/api/wealth/summary", 12),
        ("/api/wealth/monthly", 12),
        ("/api/investment-events/positions", 8),
        ("/api/investment-events/monthly-series?months=24", 8),
    ],
)
def test_financial_endpoints_have_bounded_queries(
    client,
    db_session,
    path,
    maximum_select_count,
):
    seed_financial_history(db_session)

    measurement = measure_endpoint(
        client=client,
        db_session=db_session,
        path=path,
    )

    print(
        f"{measurement.path}: "
        f"{measurement.duration_seconds:.6f}s, "
        f"{measurement.select_count} SELECTs"
    )

    assert measurement.select_count <= maximum_select_count


def test_warm_24_month_investment_chart_is_under_one_second_locally(
    client,
    db_session,
):
    seed_financial_history(db_session)

    measurement = measure_endpoint(
        client=client,
        db_session=db_session,
        path="/api/investment-events/monthly-series?months=24",
    )

    print(
        "warm 24-month investment chart: "
        f"{measurement.duration_seconds:.6f}s, "
        f"{measurement.select_count} SELECTs"
    )

    assert measurement.duration_seconds < 1.0
