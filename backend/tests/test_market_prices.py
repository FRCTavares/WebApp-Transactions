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
    assert position["market_value"] is None
    assert position["market_value_currency"] is None
    assert position["market_fx_rate_to_eur"] is None
    assert position["unrealised_gain"] is None
    assert position["unrealised_gain_percent"] is None


def test_update_market_price_by_id(client):
    create_response = client.post(
        "/api/market-prices",
        json={
            "ticker": "VWCE",
            "isin": "IE00BK5BQT80",
            "price": "150.00",
            "currency": "EUR",
            "source": "manual",
        },
    )

    assert create_response.status_code == 201

    price_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/market-prices/{price_id}",
        json={
            "ticker": "VWCE",
            "isin": "IE00BK5BQT80",
            "price": "152.50",
            "currency": "EUR",
            "source": "manual",
        },
    )

    assert update_response.status_code == 200
    assert update_response.json()["price"] == "152.50000000"

    list_response = client.get("/api/market-prices")

    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    assert list_response.json()[0]["price"] == "152.50000000"


def test_delete_market_price_by_id(client):
    create_response = client.post(
        "/api/market-prices",
        json={
            "ticker": "VWCE",
            "isin": "IE00BK5BQT80",
            "price": "150.00",
            "currency": "EUR",
            "source": "manual",
        },
    )

    assert create_response.status_code == 201

    price_id = create_response.json()["id"]

    delete_response = client.delete(f"/api/market-prices/{price_id}")

    assert delete_response.status_code == 204

    list_response = client.get("/api/market-prices")

    assert list_response.status_code == 200
    assert list_response.json() == []


def test_update_missing_market_price_returns_404(client):
    response = client.patch(
        "/api/market-prices/999999",
        json={
            "price": "152.50",
        },
    )

    assert response.status_code == 404


def test_delete_missing_market_price_returns_404(client):
    response = client.delete("/api/market-prices/999999")

    assert response.status_code == 404

from datetime import UTC, datetime

from app.routers.market_prices import get_market_data_provider
from app.services.market_data.base import MarketDataHistoryPoint, MarketDataLatestPrice


class FakeMarketDataProvider:
    def get_latest_price(self, symbol):
        return MarketDataLatestPrice(
            price=Decimal("155.25"),
            currency="EUR",
            fetched_at=datetime(2026, 6, 13, 12, 0, tzinfo=UTC),
        )

    def get_history(self, symbol, date_from, date_to):
        return [
            MarketDataHistoryPoint(
                price_date=date(2026, 6, 10),
                close_price=Decimal("151.10"),
                currency="EUR",
            ),
            MarketDataHistoryPoint(
                price_date=date(2026, 6, 11),
                close_price=Decimal("152.20"),
                currency="EUR",
            ),
        ]


def test_fetch_latest_market_price_from_provider(client):
    client.app.dependency_overrides[get_market_data_provider] = lambda: FakeMarketDataProvider()

    try:
        response = client.post(
            "/api/market-prices/fetch/latest",
            json={
                "symbol": "VWCE.DE",
                "ticker": "VWCE",
                "isin": "IE00BK5BQT80",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["ticker"] == "VWCE"
        assert data["isin"] == "IE00BK5BQT80"
        assert data["price"] == "155.25000000"
        assert data["currency"] == "EUR"
        assert data["source"] == "yfinance"

        latest_response = client.get("/api/market-prices/latest?ticker=VWCE")

        assert latest_response.status_code == 200
        assert latest_response.json()["price"] == "155.25000000"
    finally:
        client.app.dependency_overrides.clear()


def test_fetch_and_list_market_price_history_from_provider(client):
    client.app.dependency_overrides[get_market_data_provider] = lambda: FakeMarketDataProvider()

    try:
        response = client.post(
            "/api/market-prices/fetch/history",
            json={
                "symbol": "VWCE.DE",
                "ticker": "VWCE",
                "isin": "IE00BK5BQT80",
                "date_from": "2026-06-10",
                "date_to": "2026-06-11",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert len(data) == 2
        assert data[0]["ticker"] == "VWCE"
        assert data[0]["close_price"] == "151.10000000"
        assert data[1]["close_price"] == "152.20000000"

        list_response = client.get("/api/market-prices/history?ticker=VWCE")

        assert list_response.status_code == 200

        history = list_response.json()

        assert len(history) == 2
        assert history[0]["price_date"] == "2026-06-11"
        assert history[1]["price_date"] == "2026-06-10"
    finally:
        client.app.dependency_overrides.clear()


def test_positions_convert_usd_market_value_to_eur_using_imported_fx_rate(client, db_session):
    event = create_market_buy(db_session, ticker="CSPX", isin="IE00B5BMR087")
    event.currency = "USD"
    event.original_currency = "USD"
    event.fx_rate_to_eur = Decimal("0.8649")
    db_session.add(event)
    db_session.commit()

    client.post(
        "/api/market-prices",
        json={
            "ticker": "CSPX",
            "isin": "IE00B5BMR087",
            "price": "800.54",
            "currency": "USD",
            "source": "manual",
        },
    )

    response = client.get("/api/investment-events/positions")

    assert response.status_code == 200

    position = response.json()[0]

    assert position["ticker"] == "CSPX"
    assert position["market_price"] == "800.54000000"
    assert position["market_price_currency"] == "USD"
    assert position["market_value_currency"] == "EUR"
    assert position["market_fx_rate_to_eur"] == "0.86490000"
    assert position["market_value"] == "2569.08"


def test_positions_derive_market_fx_rate_from_eur_market_buy(client, db_session):
    event = create_market_buy(db_session, ticker="CSPX", isin="IE00B5BMR087")
    event.quantity = Decimal("0.00180605")
    event.price = Decimal("794.58")
    event.amount = Decimal("1.24")
    event.currency = "EUR"
    event.original_amount = Decimal("1.24")
    event.original_currency = "EUR"
    event.fx_rate_to_eur = Decimal("1")
    event.fx_rate_source = "source_currency"
    db_session.add(event)
    db_session.commit()

    client.post(
        "/api/market-prices",
        json={
            "ticker": "CSPX",
            "isin": "IE00B5BMR087",
            "price": "800.53997803",
            "currency": "USD",
            "source": "manual",
        },
    )

    response = client.get("/api/investment-events/positions")

    assert response.status_code == 200

    position = response.json()[0]

    assert position["ticker"] == "CSPX"
    assert position["market_price_currency"] == "USD"
    assert position["market_fx_rate_to_eur"] == "0.86408066"
    assert position["market_value_currency"] == "EUR"
    assert position["market_value"] == "1.25"
