from datetime import date
from decimal import Decimal

from dateutil.relativedelta import relativedelta

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.models.investment_event import InvestmentEvent

# `/api/investment-events/monthly-series` windows relative to the real
# `date.today()`: with `months=N`, the earliest (and therefore always
# present) point is `N - 1` months before the current month. The tests below
# anchor their fixture dates to that earliest point instead of a fixed
# calendar month, so they stay evergreen instead of breaking once real time
# passes the month they were written against.
_TARGET_MONTH_START = date.today().replace(day=1) - relativedelta(months=2)
TARGET_MONTH_KEY = _TARGET_MONTH_START.strftime("%Y-%m")


def _target_day(day: int) -> date:
    """A date in the always-included target month, clamped to a valid day."""
    return _TARGET_MONTH_START + relativedelta(day=day)


def _month_after_target(day: int) -> date:
    """A date in the month immediately after the target month."""
    return _TARGET_MONTH_START + relativedelta(months=1, day=day)


def test_monthly_change_uses_price_movement_not_buys(client, db_session):
    from app.models.market_price_history import MarketPriceHistory

    buy = InvestmentEvent(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 5, 15),
        source="trading212",
        account="Trading 212",
        event_type="market_buy",
        description="Market buy VWCE",
        raw_description="Market buy VWCE",
        instrument_name="Vanguard FTSE All-World UCITS ETF",
        ticker="VWCE",
        isin="IE00BK5BQT80",
        quantity=Decimal("1.00"),
        amount=Decimal("100.00"),
        currency="EUR",
        original_amount=Decimal("100.00"),
        original_currency="EUR",
        fx_rate_to_eur=Decimal("1"),
    )
    db_session.add(buy)

    db_session.add(
        MarketPriceHistory(
            ticker="VWCE",
            isin="IE00BK5BQT80",
            price_date=date(2026, 5, 31),
            close_price=Decimal("110.00"),
            currency="EUR",
            source="manual",
        )
    )

    db_session.commit()

    response = client.get("/api/investment-events/monthly-change?year=2026&month=5")

    assert response.status_code == 200

    data = response.json()

    assert data["month"] == "2026-05"
    assert data["start_value"] == "0.00"
    assert data["end_value"] == "110.00"
    assert data["net_invested"] == "100.00"
    assert data["unrealised_monthly_change"] == "10.00"
    assert data["is_estimated"] is False


def test_monthly_change_uses_previous_month_end_holdings(client, db_session):
    from app.models.market_price_history import MarketPriceHistory

    buy = InvestmentEvent(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 4, 10),
        source="trading212",
        account="Trading 212",
        event_type="market_buy",
        description="Market buy VWCE",
        raw_description="Market buy VWCE",
        instrument_name="Vanguard FTSE All-World UCITS ETF",
        ticker="VWCE",
        isin="IE00BK5BQT80",
        quantity=Decimal("2.00"),
        amount=Decimal("200.00"),
        currency="EUR",
        original_amount=Decimal("200.00"),
        original_currency="EUR",
        fx_rate_to_eur=Decimal("1"),
    )
    db_session.add(buy)

    db_session.add_all(
        [
            MarketPriceHistory(
                ticker="VWCE",
                isin="IE00BK5BQT80",
                price_date=date(2026, 5, 1),
                close_price=Decimal("100.00"),
                currency="EUR",
                source="manual",
            ),
            MarketPriceHistory(
                ticker="VWCE",
                isin="IE00BK5BQT80",
                price_date=date(2026, 5, 31),
                close_price=Decimal("105.00"),
                currency="EUR",
                source="manual",
            ),
        ]
    )

    db_session.commit()

    response = client.get("/api/investment-events/monthly-change?year=2026&month=5")

    assert response.status_code == 200

    data = response.json()

    assert data["start_value"] == "200.00"
    assert data["end_value"] == "210.00"
    assert data["net_invested"] == "0.00"
    assert data["unrealised_monthly_change"] == "10.00"


def test_monthly_change_returns_null_when_holdings_cannot_be_priced(client, db_session):
    buy = InvestmentEvent(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 5, 15),
        source="trading212",
        account="Trading 212",
        event_type="market_buy",
        description="Market buy VWCE",
        raw_description="Market buy VWCE",
        instrument_name="Vanguard FTSE All-World UCITS ETF",
        ticker="VWCE",
        isin="IE00BK5BQT80",
        quantity=Decimal("1.00"),
        amount=Decimal("100.00"),
        currency="EUR",
        original_amount=Decimal("100.00"),
        original_currency="EUR",
        fx_rate_to_eur=Decimal("1"),
    )
    db_session.add(buy)
    db_session.commit()

    response = client.get("/api/investment-events/monthly-change?year=2026&month=5")

    assert response.status_code == 200

    data = response.json()

    assert data["start_value"] == "0.00"
    assert data["end_value"] is None
    assert data["net_invested"] == "100.00"
    assert data["unrealised_monthly_change"] is None


def test_monthly_series_uses_historical_cost_basis_for_allocated_money(client, db_session):
    from app.models.investment_event import InvestmentEvent
    from app.models.market_price_history import MarketPriceHistory

    db_session.add_all(
        [
            InvestmentEvent(
                user_id=LOCAL_DEFAULT_USER_ID,
                date=_target_day(10),
                source="trading212",
                account="Invest",
                event_type="market_buy",
                description="Buy CSPX",
                raw_description="Buy CSPX",
                instrument_name="iShares Core S&P 500",
                ticker="CSPX",
                isin="IE00B5BMR087",
                quantity=Decimal("2"),
                price=Decimal("100"),
                amount=Decimal("200"),
                currency="USD",
                fx_rate_to_eur=Decimal("0.90"),
            ),
            MarketPriceHistory(
                ticker="CSPX",
                isin="IE00B5BMR087",
                price_date=_target_day(31),
                close_price=Decimal("120"),
                currency="USD",
                source="manual",
            ),
        ]
    )
    db_session.commit()

    response = client.get("/api/investment-events/monthly-series?months=3")

    assert response.status_code == 200

    data = response.json()
    may_point = next(point for point in data if point["month"] == TARGET_MONTH_KEY)

    assert may_point["allocated_eur"] == "180.00"
    assert may_point["market_value_eur"] == "216.00"
    assert may_point["gain_eur"] == "36.00"
    assert may_point["is_estimated"] is True


def test_monthly_series_uses_trade_price_when_market_history_is_missing(client, db_session):
    db_session.add(
        InvestmentEvent(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=_target_day(10),
            source="trading212",
            account="Invest",
            event_type="market_buy",
            description="Buy VWCE",
            raw_description="Buy VWCE",
            instrument_name="Vanguard FTSE All-World",
            ticker="VWCE",
            isin="IE00BK5BQT80",
            quantity=Decimal("2"),
            price=Decimal("105"),
            amount=Decimal("210"),
            currency="EUR",
            fx_rate_to_eur=Decimal("1"),
        )
    )
    db_session.commit()

    response = client.get("/api/investment-events/monthly-series?months=3")

    assert response.status_code == 200

    data = response.json()
    may_point = next(point for point in data if point["month"] == TARGET_MONTH_KEY)

    assert may_point["allocated_eur"] == "210.00"
    assert may_point["market_value_eur"] == "210.00"
    assert may_point["gain_eur"] == "0.00"
    assert may_point["is_estimated"] is True


def test_historical_valuation_prefers_exact_date_fx_rate(
    client,
    db_session,
):
    from app.models.market_price_history import MarketPriceHistory

    db_session.add_all(
        [
            InvestmentEvent(
                user_id=LOCAL_DEFAULT_USER_ID,
                date=_target_day(10),
                source="trading212",
                account="Invest",
                event_type="market_buy",
                description="Buy CSPX",
                raw_description="Buy CSPX",
                instrument_name="iShares Core S&P 500",
                ticker="CSPX",
                isin="IE00B5BMR087",
                quantity=Decimal("2"),
                price=Decimal("100"),
                amount=Decimal("200"),
                currency="USD",
                original_currency="USD",
                fx_rate_to_eur=Decimal("0.90"),
            ),
            InvestmentEvent(
                user_id=LOCAL_DEFAULT_USER_ID,
                date=_target_day(31),
                source="trading212",
                account="Invest",
                event_type="interest",
                description="USD FX evidence",
                raw_description="USD FX evidence",
                amount=Decimal("1"),
                currency="USD",
                original_currency="USD",
                fx_rate_to_eur=Decimal("0.80"),
            ),
            MarketPriceHistory(
                ticker="CSPX",
                isin="IE00B5BMR087",
                price_date=_target_day(31),
                close_price=Decimal("120"),
                currency="USD",
                source="manual",
            ),
        ]
    )
    db_session.commit()

    response = client.get(
        "/api/investment-events/monthly-series?months=3"
    )

    assert response.status_code == 200

    may_point = next(
        point
        for point in response.json()
        if point["month"] == TARGET_MONTH_KEY
    )

    assert may_point["allocated_eur"] == "160.00"
    assert may_point["market_value_eur"] == "192.00"
    assert may_point["gain_eur"] == "32.00"
    assert may_point["is_estimated"] is False


def test_future_fx_rate_does_not_change_historical_valuation(
    client,
    db_session,
):
    from app.models.market_price_history import MarketPriceHistory

    historical_buy = InvestmentEvent(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=_target_day(10),
        source="trading212",
        account="Invest",
        event_type="market_buy",
        description="Buy CSPX",
        raw_description="Buy CSPX",
        instrument_name="iShares Core S&P 500",
        ticker="CSPX",
        isin="IE00B5BMR087",
        quantity=Decimal("2"),
        price=Decimal("100"),
        amount=Decimal("200"),
        currency="USD",
        original_currency="USD",
        fx_rate_to_eur=Decimal("0.90"),
    )
    future_fx_event = InvestmentEvent(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=_month_after_target(15),
        source="trading212",
        account="Invest",
        event_type="interest",
        description="Future USD FX evidence",
        raw_description="Future USD FX evidence",
        amount=Decimal("1"),
        currency="USD",
        original_currency="USD",
        fx_rate_to_eur=Decimal("0.50"),
    )

    db_session.add_all(
        [
            historical_buy,
            future_fx_event,
            MarketPriceHistory(
                ticker="CSPX",
                isin="IE00B5BMR087",
                price_date=_target_day(31),
                close_price=Decimal("120"),
                currency="USD",
                source="manual",
            ),
        ]
    )
    db_session.commit()

    first_response = client.get(
        "/api/investment-events/monthly-series?months=3"
    )

    assert first_response.status_code == 200

    first_may_point = next(
        point
        for point in first_response.json()
        if point["month"] == TARGET_MONTH_KEY
    )

    future_fx_event.fx_rate_to_eur = Decimal("0.25")
    db_session.add(future_fx_event)
    db_session.commit()

    second_response = client.get(
        "/api/investment-events/monthly-series?months=3"
    )

    assert second_response.status_code == 200

    second_may_point = next(
        point
        for point in second_response.json()
        if point["month"] == TARGET_MONTH_KEY
    )

    assert first_may_point == second_may_point
    assert second_may_point["allocated_eur"] == "180.00"
    assert second_may_point["market_value_eur"] == "216.00"
    assert second_may_point["gain_eur"] == "36.00"
    assert second_may_point["is_estimated"] is True


def test_historical_valuation_returns_null_when_fx_is_missing(
    client,
    db_session,
):
    from app.models.market_price_history import MarketPriceHistory

    db_session.add_all(
        [
            InvestmentEvent(
                user_id=LOCAL_DEFAULT_USER_ID,
                date=_target_day(10),
                source="trading212",
                account="Invest",
                event_type="market_buy",
                description="Buy CSPX",
                raw_description="Buy CSPX",
                instrument_name="iShares Core S&P 500",
                ticker="CSPX",
                isin="IE00B5BMR087",
                quantity=Decimal("2"),
                price=Decimal("100"),
                amount=Decimal("200"),
                currency="USD",
                original_currency="USD",
            ),
            MarketPriceHistory(
                ticker="CSPX",
                isin="IE00B5BMR087",
                price_date=_target_day(31),
                close_price=Decimal("120"),
                currency="USD",
                source="manual",
            ),
        ]
    )
    db_session.commit()

    response = client.get(
        "/api/investment-events/monthly-series?months=3"
    )

    assert response.status_code == 200

    may_point = next(
        point
        for point in response.json()
        if point["month"] == TARGET_MONTH_KEY
    )

    assert may_point["allocated_eur"] is None
    assert may_point["market_value_eur"] is None
    assert may_point["gain_eur"] is None
    assert may_point["is_estimated"] is False


def test_monthly_change_nets_a_sell_recorded_under_a_different_source(
    client,
    db_session,
):
    """Regression test: point-in-time valuation used to key holdings by
    (source, account, ticker, isin). A buy from one source and a sell of
    the same instrument from a different source (e.g. an imported
    Trading212 buy plus a manually-entered sell) were treated as two
    separate holdings - the sell's negative quantity was then filtered
    out entirely (quantity <= 0 is skipped), so the sell never reduced
    the valued total. Holdings now key on (ticker, isin) only, so the
    sell correctly nets against the buy regardless of source.
    """
    from app.models.market_price_history import MarketPriceHistory

    buy = InvestmentEvent(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 5, 5),
        source="trading212",
        account="Trading 212",
        event_type="market_buy",
        description="Market buy VWCE",
        raw_description="Market buy VWCE",
        instrument_name="Vanguard FTSE All-World UCITS ETF",
        ticker="VWCE",
        isin="IE00BK5BQT80",
        quantity=Decimal("2.00"),
        amount=Decimal("200.00"),
        currency="EUR",
        original_amount=Decimal("200.00"),
        original_currency="EUR",
        fx_rate_to_eur=Decimal("1"),
    )
    sell = InvestmentEvent(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 5, 20),
        source="manual",
        account="Manual",
        event_type="market_sell",
        description="Manual sell VWCE",
        raw_description="Manual sell VWCE",
        instrument_name="Vanguard FTSE All-World UCITS ETF",
        ticker="VWCE",
        isin="IE00BK5BQT80",
        quantity=Decimal("1.00"),
        amount=Decimal("105.00"),
        currency="EUR",
        original_amount=Decimal("105.00"),
        original_currency="EUR",
        fx_rate_to_eur=Decimal("1"),
    )
    db_session.add(buy)
    db_session.add(sell)
    db_session.add(
        MarketPriceHistory(
            ticker="VWCE",
            isin="IE00BK5BQT80",
            price_date=date(2026, 5, 31),
            close_price=Decimal("110.00"),
            currency="EUR",
            source="manual",
        )
    )
    db_session.commit()

    response = client.get("/api/investment-events/monthly-change?year=2026&month=5")

    assert response.status_code == 200

    data = response.json()

    # 1 remaining unit (2 bought - 1 sold) at the €110.00 close price.
    assert data["end_value"] == "110.00"


def _add_holding(db_session, *, ticker: str, isin: str) -> None:
    db_session.add(
        InvestmentEvent(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 5, 1),
            source="trading212",
            account="Trading 212",
            event_type="market_buy",
            description=f"Market buy {ticker}",
            raw_description=f"Market buy {ticker}",
            instrument_name=ticker,
            ticker=ticker,
            isin=isin,
            quantity=Decimal("1.00"),
            amount=Decimal("100.00"),
            currency="EUR",
            original_amount=Decimal("100.00"),
            original_currency="EUR",
            fx_rate_to_eur=Decimal("1"),
        )
    )


def test_weekend_price_carry_forward_is_not_flagged_as_estimated(client, db_session):
    """A month-end that falls on a non-trading day (weekend/holiday) has no
    price of its own - carrying forward the last real close (here, 2 days
    earlier) is the standard valuation convention, not a degraded-confidence
    estimate, and should not be reported as one.
    """
    from app.models.market_price_history import MarketPriceHistory

    _add_holding(db_session, ticker="CSPX", isin="IE00B5BMR087")
    db_session.add(
        MarketPriceHistory(
            ticker="CSPX",
            isin="IE00B5BMR087",
            price_date=date(2026, 5, 1),
            close_price=Decimal("100.00"),
            currency="EUR",
            source="yfinance",
        )
    )
    db_session.add(
        MarketPriceHistory(
            ticker="CSPX",
            isin="IE00B5BMR087",
            price_date=date(2026, 5, 29),
            close_price=Decimal("120.00"),
            currency="EUR",
            source="yfinance",
        )
    )
    db_session.commit()

    response = client.get("/api/investment-events/monthly-change?year=2026&month=5")

    assert response.status_code == 200
    data = response.json()

    assert data["start_value"] == "100.00"
    assert data["end_value"] == "120.00"
    assert data["is_estimated"] is False


def test_genuinely_stale_price_is_still_flagged_as_estimated(client, db_session):
    """A price gap wider than a normal weekend/holiday (here, 10 days) means
    the price feed likely missed real trading days, not just a non-trading
    date - this should still be flagged as estimated.
    """
    from app.models.market_price_history import MarketPriceHistory

    _add_holding(db_session, ticker="CSPX", isin="IE00B5BMR087")
    db_session.add(
        MarketPriceHistory(
            ticker="CSPX",
            isin="IE00B5BMR087",
            price_date=date(2026, 5, 1),
            close_price=Decimal("100.00"),
            currency="EUR",
            source="yfinance",
        )
    )
    db_session.add(
        MarketPriceHistory(
            ticker="CSPX",
            isin="IE00B5BMR087",
            price_date=date(2026, 5, 20),
            close_price=Decimal("120.00"),
            currency="EUR",
            source="yfinance",
        )
    )
    db_session.commit()

    response = client.get("/api/investment-events/monthly-change?year=2026&month=5")

    assert response.status_code == 200
    data = response.json()

    assert data["start_value"] == "100.00"
    assert data["end_value"] == "120.00"
    assert data["is_estimated"] is True
