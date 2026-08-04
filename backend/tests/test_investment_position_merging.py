from datetime import date
from decimal import Decimal

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.models.investment_event import InvestmentEvent


def add_market_event(
    db_session,
    *,
    event_type: str,
    source: str,
    account: str,
    ticker: str = "BTC",
    quantity: str,
    amount: str,
    currency: str = "EUR",
    event_date: date = date(2026, 7, 16),
) -> InvestmentEvent:
    event = InvestmentEvent(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=event_date,
        source=source,
        account=account,
        event_type=event_type,
        description=f"{event_type} {ticker}",
        raw_description=f"{event_type} {ticker}",
        instrument_name="Bitcoin",
        ticker=ticker,
        quantity=Decimal(quantity),
        price=Decimal(amount) / Decimal(quantity),
        amount=Decimal(amount),
        currency=currency,
        original_amount=Decimal(amount),
        original_currency=currency,
    )
    db_session.add(event)
    db_session.flush()
    return event


def test_positions_merge_across_sources_for_same_ticker(client, db_session):
    add_market_event(
        db_session,
        event_type="market_buy",
        source="trading212",
        account="Trading 212",
        quantity="0.00390727",
        amount="300.00",
    )
    add_market_event(
        db_session,
        event_type="market_buy",
        source="manual",
        account="Manual",
        quantity="0.00037818",
        amount="21.42",
    )
    db_session.commit()

    response = client.get("/api/investment-events/positions")

    assert response.status_code == 200
    positions = response.json()
    btc_positions = [position for position in positions if position["ticker"] == "BTC"]

    assert len(btc_positions) == 1
    assert btc_positions[0]["quantity"] == "0.00428545"
    assert len(btc_positions[0]["costs"]) == 1
    assert btc_positions[0]["costs"][0]["currency"] == "EUR"
    assert btc_positions[0]["costs"][0]["total_cost"] == "321.42"
    assert Decimal(btc_positions[0]["costs"][0]["average_price"]) == (
        Decimal("321.42") / Decimal("0.00428545")
    ).quantize(Decimal("0.00000001"))


def test_sell_can_close_out_holdings_bought_via_a_different_source(client, db_session):
    add_market_event(
        db_session,
        event_type="market_buy",
        source="trading212",
        account="Trading 212",
        quantity="0.00390727",
        amount="300.00",
    )
    db_session.commit()

    response = client.post(
        "/api/investment-events",
        json={
            "date": "2026-07-20",
            "source": "manual",
            "account": "Manual",
            "event_type": "market_sell",
            "description": "Manual sell BTC",
            "raw_description": "Manual sell BTC",
            "instrument_name": "Bitcoin",
            "ticker": "BTC",
            "quantity": "0.00390727",
            "price": "60000",
            "amount": "234.44",
            "currency": "EUR",
        },
    )

    assert response.status_code == 201


def test_sell_still_blocked_when_exceeding_combined_holdings_across_sources(
    client,
    db_session,
):
    add_market_event(
        db_session,
        event_type="market_buy",
        source="trading212",
        account="Trading 212",
        quantity="0.00390727",
        amount="300.00",
    )
    add_market_event(
        db_session,
        event_type="market_buy",
        source="manual",
        account="Manual",
        quantity="0.00037818",
        amount="21.42",
    )
    db_session.commit()

    response = client.post(
        "/api/investment-events",
        json={
            "date": "2026-07-20",
            "source": "manual",
            "account": "Manual",
            "event_type": "market_sell",
            "description": "Manual sell BTC",
            "raw_description": "Manual sell BTC",
            "instrument_name": "Bitcoin",
            "ticker": "BTC",
            "quantity": "0.01000000",
            "price": "60000",
            "amount": "600.00",
            "currency": "EUR",
        },
    )

    assert response.status_code == 400
    assert "exceed available holdings" in response.json()["detail"]
