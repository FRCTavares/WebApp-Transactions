from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.models.investment_event import InvestmentEvent
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.schemas.investment_event import InvestmentEventUpdate
from app.services.investment_cost_basis import build_average_cost_positions
from app.services.investment_event_service import InvestmentEventService

LOCAL_CURRENT_USER = CurrentUser(id=LOCAL_DEFAULT_USER_ID)


def create_market_event(
    db_session,
    *,
    event_type,
    ticker,
    isin,
    instrument_name,
    quantity,
    amount,
    price="100.00",
    currency="USD",
    fees=None,
    taxes=None,
    user_id=LOCAL_DEFAULT_USER_ID,
):
    event = InvestmentEvent(
        user_id=user_id,
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
        price=Decimal(price) if price is not None else None,
        amount=Decimal(amount),
        currency=currency,
        fees=Decimal(fees) if fees is not None else None,
        taxes=Decimal(taxes) if taxes is not None else None,
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
    user_id=LOCAL_DEFAULT_USER_ID,
):
    event = InvestmentEvent(
        user_id=user_id,
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


def test_list_positions_removes_average_cost_not_sale_proceeds(
    client,
    db_session,
):
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
        amount="200.00",
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


def test_average_cost_tracks_multiple_buys_and_realised_gain(
    db_session,
):
    first_buy = create_market_event(
        db_session,
        event_type="market_buy",
        ticker="VWCE",
        isin="IE00BK5BQT80",
        instrument_name="Vanguard FTSE All-World",
        quantity="1.00",
        amount="100.00",
        currency="EUR",
    )
    second_buy = create_market_event(
        db_session,
        event_type="market_buy",
        ticker="VWCE",
        isin="IE00BK5BQT80",
        instrument_name="Vanguard FTSE All-World",
        quantity="1.00",
        amount="200.00",
        currency="EUR",
    )
    sell = create_market_event(
        db_session,
        event_type="market_sell",
        ticker="VWCE",
        isin="IE00BK5BQT80",
        instrument_name="Vanguard FTSE All-World",
        quantity="0.50",
        amount="125.00",
        currency="EUR",
    )

    positions = build_average_cost_positions(
        [first_buy, second_buy, sell]
    )
    position = next(iter(positions.values()))
    bucket = position["cost_buckets"]["EUR"]

    assert position["quantity"] == Decimal("1.50")
    assert bucket["quantity"] == Decimal("1.50")
    assert bucket["total_cost"] == Decimal("225.000")
    assert bucket["realised_gain"] == Decimal("50.000")


def test_average_cost_includes_buy_and_sell_fees_and_taxes(
    db_session,
):
    buy = create_market_event(
        db_session,
        event_type="market_buy",
        ticker="EXMP",
        isin="EXAMPLE000001",
        instrument_name="Example Fund",
        quantity="2.00",
        amount="200.00",
        currency="EUR",
        fees="10.00",
        taxes="5.00",
    )
    sell = create_market_event(
        db_session,
        event_type="market_sell",
        ticker="EXMP",
        isin="EXAMPLE000001",
        instrument_name="Example Fund",
        quantity="1.00",
        amount="130.00",
        currency="EUR",
        fees="2.00",
        taxes="3.00",
    )

    positions = build_average_cost_positions([buy, sell])
    position = next(iter(positions.values()))
    bucket = position["cost_buckets"]["EUR"]

    assert position["quantity"] == Decimal("1.00")
    assert bucket["quantity"] == Decimal("1.00")
    assert bucket["total_cost"] == Decimal("107.500")
    assert bucket["realised_gain"] == Decimal("17.500")


def test_average_cost_full_liquidation_leaves_zero_cost(
    db_session,
):
    buy = create_market_event(
        db_session,
        event_type="market_buy",
        ticker="EXMP",
        isin="EXAMPLE000002",
        instrument_name="Example Fund",
        quantity="2.00",
        amount="200.00",
        currency="EUR",
        fees="10.00",
        taxes="5.00",
    )
    sell = create_market_event(
        db_session,
        event_type="market_sell",
        ticker="EXMP",
        isin="EXAMPLE000002",
        instrument_name="Example Fund",
        quantity="2.00",
        amount="260.00",
        currency="EUR",
        fees="5.00",
        taxes="10.00",
    )

    positions = build_average_cost_positions([buy, sell])
    position = next(iter(positions.values()))
    bucket = position["cost_buckets"]["EUR"]

    assert position["quantity"] == Decimal("0.00")
    assert bucket["quantity"] == Decimal("0")
    assert bucket["total_cost"] == Decimal("0")
    assert bucket["realised_gain"] == Decimal("30.00")


def test_average_cost_keeps_currency_buckets_separate(
    db_session,
):
    eur_buy = create_market_event(
        db_session,
        event_type="market_buy",
        ticker="CSPX",
        isin="IE00B5BMR087",
        instrument_name="iShares Core S&P 500",
        quantity="1.00",
        amount="100.00",
        currency="EUR",
    )
    usd_buy = create_market_event(
        db_session,
        event_type="market_buy",
        ticker="CSPX",
        isin="IE00B5BMR087",
        instrument_name="iShares Core S&P 500",
        quantity="2.00",
        amount="300.00",
        currency="USD",
    )
    usd_sell = create_market_event(
        db_session,
        event_type="market_sell",
        ticker="CSPX",
        isin="IE00B5BMR087",
        instrument_name="iShares Core S&P 500",
        quantity="1.00",
        amount="180.00",
        currency="USD",
    )

    positions = build_average_cost_positions(
        [eur_buy, usd_buy, usd_sell]
    )
    position = next(iter(positions.values()))
    eur_bucket = position["cost_buckets"]["EUR"]
    usd_bucket = position["cost_buckets"]["USD"]

    assert position["quantity"] == Decimal("2.00")
    assert eur_bucket["quantity"] == Decimal("1.00")
    assert eur_bucket["total_cost"] == Decimal("100.00")
    assert eur_bucket["realised_gain"] == Decimal("0")
    assert usd_bucket["quantity"] == Decimal("1.00")
    assert usd_bucket["total_cost"] == Decimal("150.000")
    assert usd_bucket["realised_gain"] == Decimal("30.000")


def test_average_cost_rejects_sell_without_matching_currency_bucket(
    db_session,
):
    eur_buy = create_market_event(
        db_session,
        event_type="market_buy",
        ticker="CSPX",
        isin="IE00B5BMR087",
        instrument_name="iShares Core S&P 500",
        quantity="1.00",
        amount="100.00",
        currency="EUR",
    )
    usd_sell = create_market_event(
        db_session,
        event_type="market_sell",
        ticker="CSPX",
        isin="IE00B5BMR087",
        instrument_name="iShares Core S&P 500",
        quantity="0.50",
        amount="75.00",
        currency="USD",
    )

    with pytest.raises(
        ValueError,
        match="no matching positive cost bucket",
    ):
        build_average_cost_positions([eur_buy, usd_sell])


def test_create_market_sell_rejects_holdings_in_different_currency(
    client,
    db_session,
):
    create_market_event(
        db_session,
        event_type="market_buy",
        ticker="CSPX",
        isin="IE00B5BMR087",
        instrument_name="iShares Core S&P 500 UCITS ETF",
        quantity="1.00",
        price="100.00",
        amount="100.00",
        currency="EUR",
    )

    response = client.post(
        "/api/investment-events",
        json={
            "date": "2024-09-09",
            "source": "trading212",
            "account": "Trading 212",
            "event_type": "market_sell",
            "description": "Market sell CSPX",
            "raw_description": "Market sell CSPX",
            "instrument_name": "iShares Core S&P 500 UCITS ETF",
            "ticker": "CSPX",
            "isin": "IE00B5BMR087",
            "quantity": "0.50",
            "price": "150.00",
            "amount": "75.00",
            "currency": "USD",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Investment sell quantity cannot exceed available holdings "
        "in the matching currency"
    )


def test_update_market_sell_rejects_change_to_unfunded_currency(
    db_session,
):
    create_market_event(
        db_session,
        event_type="market_buy",
        ticker="CSPX",
        isin="IE00B5BMR087",
        instrument_name="iShares Core S&P 500 UCITS ETF",
        quantity="1.00",
        price="100.00",
        amount="100.00",
        currency="EUR",
    )
    sell = create_market_event(
        db_session,
        event_type="market_sell",
        ticker="CSPX",
        isin="IE00B5BMR087",
        instrument_name="iShares Core S&P 500 UCITS ETF",
        quantity="0.50",
        price="100.00",
        amount="50.00",
        currency="EUR",
    )

    service = InvestmentEventService(
        InvestmentEventRepository(db_session)
    )

    with pytest.raises(HTTPException) as error:
        service.update_event(
            sell.id,
            InvestmentEventUpdate(currency="USD"),
            current_user=LOCAL_CURRENT_USER,
        )

    assert error.value.status_code == 400
    assert error.value.detail == (
        "Investment sell quantity cannot exceed available holdings "
        "in the matching currency"
    )

    db_session.refresh(sell)
    assert sell.currency == "EUR"


def test_create_market_event_rejects_missing_required_market_fields(client):
    response = client.post(
        "/api/investment-events",
        json={
            "date": "2024-09-09",
            "source": "trading212",
            "account": "Trading 212",
            "event_type": "market_buy",
            "description": "Market buy missing fields",
            "raw_description": "Market buy missing fields",
            "amount": "100.00",
            "currency": "EUR",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Investment buy/sell events require a positive quantity"
    )


def test_create_market_sell_rejects_more_than_available_holdings(client, db_session):
    create_market_event(
        db_session,
        event_type="market_buy",
        ticker="CSPX",
        isin="IE00B5BMR087",
        instrument_name="iShares Core S&P 500 UCITS ETF",
        quantity="1.00",
        price="600.00",
        amount="600.00",
    )

    response = client.post(
        "/api/investment-events",
        json={
            "date": "2024-09-09",
            "source": "trading212",
            "account": "Trading 212",
            "event_type": "market_sell",
            "description": "Market sell CSPX",
            "raw_description": "Market sell CSPX",
            "instrument_name": "iShares Core S&P 500 UCITS ETF",
            "ticker": "CSPX",
            "isin": "IE00B5BMR087",
            "quantity": "2.00",
            "price": "600.00",
            "amount": "1200.00",
            "currency": "USD",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Investment sell quantity cannot exceed available holdings "
        "in the matching currency"
    )


def test_update_market_buy_rejects_change_that_would_oversell_future_holding(
    client,
    db_session,
):
    buy = create_market_event(
        db_session,
        event_type="market_buy",
        ticker="CSPX",
        isin="IE00B5BMR087",
        instrument_name="iShares Core S&P 500 UCITS ETF",
        quantity="1.00",
        price="600.00",
        amount="600.00",
    )
    create_market_event(
        db_session,
        event_type="market_sell",
        ticker="CSPX",
        isin="IE00B5BMR087",
        instrument_name="iShares Core S&P 500 UCITS ETF",
        quantity="0.75",
        price="600.00",
        amount="450.00",
    )

    service = InvestmentEventService(InvestmentEventRepository(db_session))

    with pytest.raises(HTTPException) as error:
        service.update_event(
            buy.id,
            InvestmentEventUpdate(quantity=Decimal("0.50")),
            current_user=LOCAL_CURRENT_USER,
        )

    assert error.value.status_code == 400
    assert error.value.detail == (
        "Investment sell quantity cannot exceed available holdings "
        "in the matching currency"
    )

    db_session.refresh(buy)
    assert buy.quantity == Decimal("1.00")
