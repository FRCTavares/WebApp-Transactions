from datetime import date
from decimal import Decimal

from app.models.investment_event import InvestmentEvent


def create_market_event(
    db_session,
    *,
    event_type,
    ticker,
    isin,
    instrument_name,
    quantity,
    amount,
    currency="USD",
):
    event = InvestmentEvent(
        date=date(2024, 9, 9),
        source="trading212",
        account="Trading 212",
        event_type=event_type,
        description=f"{event_type} {ticker}",
        raw_description=f"{event_type} {ticker}",
        instrument_name=instrument_name,
        ticker=ticker,
        isin=isin,
        quantity=Decimal(quantity),
        amount=Decimal(amount),
        currency=currency,
        original_amount=Decimal(amount),
        original_currency=currency,
    )

    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)

    return event


def create_non_position_event(
    db_session,
    *,
    event_type,
    amount,
    currency="USD",
):
    event = InvestmentEvent(
        date=date(2024, 9, 9),
        source="trading212",
        account="Trading 212",
        event_type=event_type,
        description=event_type,
        raw_description=event_type,
        amount=Decimal(amount),
        currency=currency,
        original_amount=Decimal(amount),
        original_currency=currency,
    )

    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)

    return event


def test_list_positions_groups_same_ticker_across_cost_currencies(client, db_session):
    create_market_event(
        db_session,
        event_type="market_buy",
        ticker="CSPX",
        isin="IE00B5BMR087",
        instrument_name="iShares Core S&P 500 UCITS ETF",
        quantity="3.57665486",
        amount="2239.00",
        currency="USD",
    )
    create_market_event(
        db_session,
        event_type="market_buy",
        ticker="CSPX",
        isin="IE00B5BMR087",
        instrument_name="iShares Core S&P 500 UCITS ETF",
        quantity="0.96407035",
        amount="606.43",
        currency="EUR",
    )

    response = client.get("/api/investment-events/positions")

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["ticker"] == "CSPX"
    assert data[0]["isin"] == "IE00B5BMR087"
    assert data[0]["quantity"] == "4.54072521"
    assert data[0]["market_price"] is None
    assert data[0]["market_price_currency"] is None
    assert data[0]["market_value"] is None
    assert data[0]["unrealised_gain"] is None
    assert data[0]["unrealised_gain_percent"] is None

    costs_by_currency = {
        cost["currency"]: cost
        for cost in data[0]["costs"]
    }

    assert set(costs_by_currency) == {"USD", "EUR"}
    assert costs_by_currency["USD"]["total_cost"] == "2239.00"
    assert costs_by_currency["USD"]["average_price"] == "626.00393039"
    assert costs_by_currency["EUR"]["total_cost"] == "606.43"
    assert costs_by_currency["EUR"]["average_price"] == "629.03085859"


def test_list_positions_keeps_single_currency_position_as_one_cost_bucket(client, db_session):
    create_market_event(
        db_session,
        event_type="market_buy",
        ticker="VWCE",
        isin="IE00BK5BQT80",
        instrument_name="Vanguard FTSE All-World UCITS ETF",
        quantity="3.71046361",
        amount="540.00",
        currency="EUR",
    )

    response = client.get("/api/investment-events/positions")

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["ticker"] == "VWCE"
    assert data[0]["quantity"] == "3.71046361"
    assert data[0]["costs"] == [
        {
            "currency": "EUR",
            "total_cost": "540.00",
            "average_price": "145.53437434",
        }
    ]


def test_list_positions_ignores_deposits_and_interest(client, db_session):
    create_non_position_event(
        db_session,
        event_type="deposit",
        amount="37.00",
        currency="USD",
    )
    create_non_position_event(
        db_session,
        event_type="interest",
        amount="0.12",
        currency="EUR",
    )

    response = client.get("/api/investment-events/positions")

    assert response.status_code == 200
    assert response.json() == []


def test_list_positions_applies_market_sells_to_matching_cost_bucket(client, db_session):
    create_market_event(
        db_session,
        event_type="market_buy",
        ticker="CSPX",
        isin="IE00B5BMR087",
        instrument_name="iShares Core S&P 500 UCITS ETF",
        quantity="1.00",
        amount="600.00",
        currency="USD",
    )
    create_market_event(
        db_session,
        event_type="market_sell",
        ticker="CSPX",
        isin="IE00B5BMR087",
        instrument_name="iShares Core S&P 500 UCITS ETF",
        quantity="0.25",
        amount="150.00",
        currency="USD",
    )

    response = client.get("/api/investment-events/positions")

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["quantity"] == "0.75000000"
    assert data[0]["costs"] == [
        {
            "currency": "USD",
            "total_cost": "450.00",
            "average_price": "600.00000000",
        }
    ]


def test_monthly_change_uses_price_movement_not_buys(client, db_session):
    from app.models.market_price_history import MarketPriceHistory

    buy = InvestmentEvent(
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


def test_monthly_change_uses_previous_month_end_holdings(client, db_session):
    from app.models.market_price_history import MarketPriceHistory

    buy = InvestmentEvent(
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
