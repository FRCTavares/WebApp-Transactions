from decimal import Decimal

from app.models.investment_event import InvestmentEvent
from datetime import date


def create_market_buy(db_session, *, ticker="VWCE", isin="IE00BK5BQT80"):
    event = InvestmentEvent(
        date=date(2026, 6, 1),
        source="trading212",
        account="Trading 212",
        event_type="market_buy",
        description=f"Market buy {ticker}",
        raw_description=f"Market buy {ticker}",
        instrument_name="Vanguard FTSE All-World (Acc)",
        ticker=ticker,
        isin=isin,
        quantity=Decimal("3.71046361"),
        amount=Decimal("540.00"),
        currency="EUR",
        original_amount=Decimal("540.00"),
        original_currency="EUR",
    )

    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)

    return event


def test_create_and_get_latest_market_price(client):
    response = client.post(
        "/api/market-prices",
        json={
            "ticker": "VWCE",
            "isin": "IE00BK5BQT80",
            "price": "150.00",
            "currency": "EUR",
            "source": "manual",
        },
    )

    assert response.status_code == 201

    created = response.json()

    assert created["ticker"] == "VWCE"
    assert created["isin"] == "IE00BK5BQT80"
    assert created["price"] == "150.00000000"
    assert created["currency"] == "EUR"
    assert created["source"] == "manual"

    latest_response = client.get("/api/market-prices/latest?ticker=VWCE")

    assert latest_response.status_code == 200
    assert latest_response.json()["price"] == "150.00000000"


def test_market_price_updates_existing_latest_price(client):
    client.post(
        "/api/market-prices",
        json={
            "ticker": "VWCE",
            "isin": "IE00BK5BQT80",
            "price": "150.00",
            "currency": "EUR",
            "source": "manual",
        },
    )

    response = client.post(
        "/api/market-prices",
        json={
            "ticker": "VWCE",
            "isin": "IE00BK5BQT80",
            "price": "151.25",
            "currency": "EUR",
            "source": "manual",
        },
    )

    assert response.status_code == 201

    list_response = client.get("/api/market-prices")

    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    assert list_response.json()[0]["price"] == "151.25000000"


def test_positions_include_matching_market_price_and_gain(client, db_session):
    create_market_buy(db_session)

    client.post(
        "/api/market-prices",
        json={
            "ticker": "VWCE",
            "isin": "IE00BK5BQT80",
            "price": "150.00",
            "currency": "EUR",
            "source": "manual",
        },
    )

    response = client.get("/api/investment-events/positions")

    assert response.status_code == 200

    position = response.json()[0]

    assert position["ticker"] == "VWCE"
    assert position["market_price"] == "150.00000000"
    assert position["market_price_currency"] == "EUR"
    assert position["market_value"] == "556.57"
    assert position["unrealised_gain"] == "16.57"
    assert position["unrealised_gain_percent"] == "3.07"


def test_positions_do_not_fake_gain_when_cost_currency_does_not_match_price_currency(client, db_session):
    create_market_buy(db_session)

    client.post(
        "/api/market-prices",
        json={
            "ticker": "VWCE",
            "isin": "IE00BK5BQT80",
            "price": "150.00",
            "currency": "USD",
            "source": "manual",
        },
    )

    response = client.get("/api/investment-events/positions")

    assert response.status_code == 200

    position = response.json()[0]

    assert position["market_price"] == "150.00000000"
    assert position["market_price_currency"] == "USD"
    assert position["market_value"] == "556.57"
    assert position["unrealised_gain"] is None
    assert position["unrealised_gain_percent"] is None
