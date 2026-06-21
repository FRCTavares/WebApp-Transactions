from datetime import date
from decimal import Decimal

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.models.investment_event import InvestmentEvent
from app.models.market_price import MarketPrice
from app.models.owed_item import OwedItem
from app.models.wealth_account import WealthAccount
from app.models.wealth_snapshot import WealthSnapshot


def create_wealth_account_with_snapshot(
    db_session,
    *,
    name: str,
    account_type: str,
    balance_eur: str,
    user_id: str = LOCAL_DEFAULT_USER_ID,
):
    account = WealthAccount(
        user_id=user_id,
        name=name,
        account_type=account_type,
        currency="EUR",
        is_active=True,
    )
    db_session.add(account)
    db_session.flush()

    db_session.add(
        WealthSnapshot(
            user_id=user_id,
            snapshot_date=date(2026, 6, 1),
            account_id=account.id,
            balance=Decimal(balance_eur),
            currency="EUR",
            balance_eur=Decimal(balance_eur),
            fx_rate_to_eur=Decimal("1.00000000"),
        )
    )
    db_session.commit()

    return account


def create_market_buy(
    db_session,
    *,
    ticker: str,
    isin: str,
    instrument_name: str,
    quantity: str,
    amount: str,
    currency: str = "EUR",
    user_id: str = LOCAL_DEFAULT_USER_ID,
):
    event = InvestmentEvent(
        user_id=user_id,
        date=date(2026, 6, 1),
        source="trading212",
        account="Trading 212",
        event_type="market_buy",
        description=f"Market buy {ticker}",
        raw_description=f"Market buy {ticker}",
        instrument_name=instrument_name,
        ticker=ticker,
        isin=isin,
        quantity=Decimal(quantity),
        price=Decimal(amount) / Decimal(quantity),
        amount=Decimal(amount),
        currency=currency,
        original_amount=Decimal(amount),
        original_currency=currency,
        fx_rate_to_eur=Decimal("1") if currency == "EUR" else None,
    )
    db_session.add(event)
    db_session.commit()

    return event


def create_market_price(
    db_session,
    *,
    ticker: str,
    isin: str,
    price: str,
    currency: str = "EUR",
):
    market_price = MarketPrice(
        ticker=ticker,
        isin=isin,
        price=Decimal(price),
        currency=currency,
        source="manual",
    )
    db_session.add(market_price)
    db_session.commit()

    return market_price


def test_reconciliation_returns_manual_snapshots_and_live_owed(client, db_session):
    create_wealth_account_with_snapshot(
        db_session,
        name="ActivoBank Main",
        account_type="current_account",
        balance_eur="1000.00",
    )

    db_session.add(
        OwedItem(
            user_id=LOCAL_DEFAULT_USER_ID,
            person="Mother",
            amount_total=Decimal("200.00"),
            amount_paid=Decimal("50.00"),
            amount_remaining=Decimal("150.00"),
            reason="Shared expense",
            status="partially_paid",
        )
    )
    db_session.commit()

    response = client.get("/api/wealth/reconciliation")

    assert response.status_code == 200

    data = response.json()

    assert data["manual_total_eur"] == "1000.00"
    assert data["derived_total_eur"] == "150.00"
    assert data["difference_eur"] == "850.00"
    assert data["status"] == "review_needed"

    items_by_name = {item["name"]: item for item in data["items"]}

    assert items_by_name["ActivoBank Main"]["source"] == "bank_account"
    assert items_by_name["ActivoBank Main"]["manual_value_eur"] == "1000.00"
    assert items_by_name["ActivoBank Main"]["derived_value_eur"] is None
    assert items_by_name["ActivoBank Main"]["status"] == "manual_only"

    assert items_by_name["Money Owed To Me"]["source"] == "owed"
    assert items_by_name["Money Owed To Me"]["manual_value_eur"] is None
    assert items_by_name["Money Owed To Me"]["derived_value_eur"] == "150.00"
    assert items_by_name["Money Owed To Me"]["status"] == "derived_only"


def test_reconciliation_excludes_stale_money_owed_wealth_snapshot(client, db_session):
    create_wealth_account_with_snapshot(
        db_session,
        name="Money Owed To Me",
        account_type="other",
        balance_eur="999.00",
    )

    db_session.add(
        OwedItem(
            user_id=LOCAL_DEFAULT_USER_ID,
            person="Mother",
            amount_total=Decimal("80.00"),
            amount_paid=Decimal("20.00"),
            amount_remaining=Decimal("60.00"),
            reason="Shared expense",
            status="partially_paid",
        )
    )
    db_session.commit()

    response = client.get("/api/wealth/reconciliation")

    assert response.status_code == 200

    data = response.json()

    assert data["manual_total_eur"] == "0.00"
    assert data["derived_total_eur"] == "60.00"

    names = [item["name"] for item in data["items"]]

    assert names.count("Money Owed To Me") == 1

    owed_item = data["items"][0]
    assert owed_item["name"] == "Money Owed To Me"
    assert owed_item["derived_value_eur"] == "60.00"
    assert owed_item["status"] == "derived_only"


def test_reconciliation_includes_priced_investment_position_as_derived_brokerage(
    client,
    db_session,
):
    create_market_buy(
        db_session,
        ticker="VWCE",
        isin="IE00BK5BQT80",
        instrument_name="Vanguard FTSE All-World UCITS ETF",
        quantity="2.00",
        amount="200.00",
    )
    create_market_price(
        db_session,
        ticker="VWCE",
        isin="IE00BK5BQT80",
        price="120.00",
    )

    response = client.get("/api/wealth/reconciliation")

    assert response.status_code == 200

    data = response.json()

    assert data["manual_total_eur"] == "0.00"
    assert data["derived_total_eur"] == "240.00"
    assert data["difference_eur"] == "-240.00"

    items_by_name = {item["name"]: item for item in data["items"]}

    position = items_by_name["VWCE - Trading 212"]
    assert position["source"] == "brokerage"
    assert position["manual_value_eur"] is None
    assert position["derived_value_eur"] == "240.00"
    assert position["status"] == "derived_only"


def test_reconciliation_marks_unpriced_investment_position_as_not_supported(
    client,
    db_session,
):
    create_market_buy(
        db_session,
        ticker="CSPX",
        isin="IE00B5BMR087",
        instrument_name="iShares Core S&P 500 UCITS ETF",
        quantity="1.00",
        amount="600.00",
    )

    response = client.get("/api/wealth/reconciliation")

    assert response.status_code == 200

    data = response.json()

    assert data["manual_total_eur"] == "0.00"
    assert data["derived_total_eur"] == "0.00"
    assert data["status"] == "matched"

    items_by_name = {item["name"]: item for item in data["items"]}

    position = items_by_name["CSPX - Trading 212"]
    assert position["source"] == "brokerage"
    assert position["manual_value_eur"] is None
    assert position["derived_value_eur"] is None
    assert position["status"] == "not_supported"
