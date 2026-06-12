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


def test_list_positions_summarises_market_buys(client, db_session):
    create_market_event(
        db_session,
        event_type="market_buy",
        ticker="CSPX",
        isin="IE00B5BMR087",
        instrument_name="iShares Core S&P 500 UCITS ETF",
        quantity="0.10",
        amount="50.00",
    )
    create_market_event(
        db_session,
        event_type="market_buy",
        ticker="CSPX",
        isin="IE00B5BMR087",
        instrument_name="iShares Core S&P 500 UCITS ETF",
        quantity="0.20",
        amount="110.00",
    )

    response = client.get("/api/investment-events/positions")

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["ticker"] == "CSPX"
    assert data[0]["isin"] == "IE00B5BMR087"
    assert data[0]["quantity"] == "0.30000000"
    assert data[0]["total_cost"] == "160.00"
    assert data[0]["currency"] == "USD"
    assert data[0]["average_price"] == "533.33333333"


def test_list_positions_ignores_deposits(client, db_session):
    db_session.add(
        InvestmentEvent(
            date=date(2024, 9, 9),
            source="trading212",
            account="Trading 212",
            event_type="deposit",
            description="Deposit",
            raw_description="Deposit",
            amount=Decimal("37.00"),
            currency="USD",
            original_amount=Decimal("37.00"),
            original_currency="USD",
        )
    )
    db_session.commit()

    response = client.get("/api/investment-events/positions")

    assert response.status_code == 200
    assert response.json() == []
