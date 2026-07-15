from datetime import date, timedelta
from decimal import Decimal

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.models.investment_event import InvestmentEvent
from app.models.market_price import MarketPrice
from app.models.market_price_history import MarketPriceHistory
from sqlalchemy import event as sqlalchemy_event

from app.models.owed_item import OwedItem
from app.models.owed_item_event import OwedItemEvent


def test_wealth_monthly_includes_investment_only_month(client, db_session):
    account_response = client.post(
        "/api/wealth/accounts",
        json={
            "name": "Savings",
            "account_type": "savings_account",
            "currency": "EUR",
        },
    )
    assert account_response.status_code == 201

    snapshot_response = client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-06-30",
            "account_id": account_response.json()["id"],
            "balance": "1000.00",
            "currency": "EUR",
        },
    )
    assert snapshot_response.status_code == 201

    db_session.add_all(
        [
            InvestmentEvent(
                user_id=LOCAL_DEFAULT_USER_ID,
                date=date(2026, 5, 15),
                source="trading212",
                account="Trading 212",
                event_type="market_buy",
                description="Buy CSPX",
                raw_description="Buy CSPX",
                instrument_name="iShares Core S&P 500",
                ticker="CSPX",
                isin="IE00B5BMR087",
                quantity=Decimal("2"),
                price=Decimal("100"),
                amount=Decimal("200"),
                currency="EUR",
                fx_rate_to_eur=Decimal("1"),
            ),
            MarketPriceHistory(
                ticker="CSPX",
                isin="IE00B5BMR087",
                price_date=date(2026, 5, 31),
                close_price=Decimal("120"),
                currency="EUR",
                source="manual",
            ),
        ]
    )
    db_session.commit()

    response = client.get("/api/wealth/monthly")

    assert response.status_code == 200

    may_row = next(
        row
        for row in response.json()
        if row["month"] == "2026-05"
    )

    assert may_row["total_wealth_eur"] == "240.00"
    assert may_row["investment_value_eur"] == "240.00"


def test_wealth_monthly_includes_current_month_after_latest_snapshot(client):
    today = date.today()
    current_month_start = today.replace(day=1)
    previous_month_end = current_month_start - timedelta(days=1)

    account_response = client.post(
        "/api/wealth/accounts",
        json={
            "name": "Savings",
            "account_type": "savings_account",
            "currency": "EUR",
        },
    )
    assert account_response.status_code == 201

    snapshot_response = client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": previous_month_end.isoformat(),
            "account_id": account_response.json()["id"],
            "balance": "1000.00",
            "currency": "EUR",
        },
    )
    assert snapshot_response.status_code == 201

    response = client.get("/api/wealth/monthly")

    assert response.status_code == 200

    current_month = current_month_start.strftime("%Y-%m")
    current_row = next(
        row
        for row in response.json()
        if row["month"] == current_month
    )

    assert current_row["total_wealth_eur"] == "1000.00"
    assert current_row["investment_value_eur"] == "0.00"


def test_wealth_latest_month_matches_summary_current_total(client, db_session):
    today = date.today()

    account_response = client.post(
        "/api/wealth/accounts",
        json={
            "name": "Savings",
            "account_type": "savings_account",
            "currency": "EUR",
        },
    )
    assert account_response.status_code == 201

    snapshot_response = client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": today.isoformat(),
            "account_id": account_response.json()["id"],
            "balance": "1000.00",
            "currency": "EUR",
        },
    )
    assert snapshot_response.status_code == 201

    db_session.add_all(
        [
            InvestmentEvent(
                user_id=LOCAL_DEFAULT_USER_ID,
                date=today,
                source="trading212",
                account="Trading 212",
                event_type="market_buy",
                description="Buy CSPX",
                raw_description="Buy CSPX",
                instrument_name="iShares Core S&P 500",
                ticker="CSPX",
                isin="IE00B5BMR087",
                quantity=Decimal("2"),
                price=Decimal("100"),
                amount=Decimal("200"),
                currency="EUR",
                fx_rate_to_eur=Decimal("1"),
            ),
            MarketPrice(
                ticker="CSPX",
                isin="IE00B5BMR087",
                price=Decimal("120"),
                currency="EUR",
                source="manual",
            ),
            MarketPriceHistory(
                ticker="CSPX",
                isin="IE00B5BMR087",
                price_date=today,
                close_price=Decimal("120"),
                currency="EUR",
                source="manual",
            ),
            OwedItem(
                user_id=LOCAL_DEFAULT_USER_ID,
                person="Mother",
                amount_total=Decimal("200.00"),
                amount_paid=Decimal("50.00"),
                amount_remaining=Decimal("150.00"),
                reason="Shared expenses",
                status="partially_paid",
            ),
        ]
    )
    db_session.commit()

    owed_item = (
        db_session.query(OwedItem)
        .filter(OwedItem.user_id == LOCAL_DEFAULT_USER_ID)
        .filter(OwedItem.person == "Mother")
        .one()
    )
    db_session.add(
        OwedItemEvent(
            user_id=LOCAL_DEFAULT_USER_ID,
            owed_item_id=owed_item.id,
            event_type="created",
            effective_date=today,
            amount_total=Decimal("200.00"),
            amount_paid=Decimal("50.00"),
            amount_remaining=Decimal("150.00"),
            status="partially_paid",
            notes="Test historical baseline.",
        )
    )
    db_session.commit()

    summary_response = client.get("/api/wealth/summary")
    monthly_response = client.get("/api/wealth/monthly")

    assert summary_response.status_code == 200
    assert monthly_response.status_code == 200

    summary = summary_response.json()
    latest_row = monthly_response.json()[-1]

    assert latest_row["month"] == today.strftime("%Y-%m")
    assert summary["current_total_wealth_eur"] == "1390.00"
    assert summary["investment_value_eur"] == "240.00"
    assert summary["money_owed_to_me_eur"] == "150.00"
    assert latest_row["investment_value_eur"] == "240.00"
    assert latest_row["total_wealth_eur"] == summary["current_total_wealth_eur"]

def test_wealth_current_month_does_not_use_future_dated_investment_data(
    client,
    db_session,
):
    today = date.today()
    current_month_start = today.replace(day=1)
    previous_month_end = current_month_start - timedelta(days=1)
    future_date = today + timedelta(days=1)

    account_response = client.post(
        "/api/wealth/accounts",
        json={
            "name": "Savings",
            "account_type": "savings_account",
            "currency": "EUR",
        },
    )
    assert account_response.status_code == 201

    snapshot_response = client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": previous_month_end.isoformat(),
            "account_id": account_response.json()["id"],
            "balance": "1000.00",
            "currency": "EUR",
        },
    )
    assert snapshot_response.status_code == 201

    db_session.add_all(
        [
            InvestmentEvent(
                user_id=LOCAL_DEFAULT_USER_ID,
                date=today,
                source="trading212",
                account="Trading 212",
                event_type="market_buy",
                description="Buy CSPX",
                raw_description="Buy CSPX",
                instrument_name="iShares Core S&P 500",
                ticker="CSPX",
                isin="IE00B5BMR087",
                quantity=Decimal("2"),
                price=Decimal("100"),
                amount=Decimal("200"),
                currency="EUR",
                fx_rate_to_eur=Decimal("1"),
            ),
            MarketPriceHistory(
                ticker="CSPX",
                isin="IE00B5BMR087",
                price_date=today,
                close_price=Decimal("120"),
                currency="EUR",
                source="manual-current",
            ),
            MarketPriceHistory(
                ticker="CSPX",
                isin="IE00B5BMR087",
                price_date=future_date,
                close_price=Decimal("999"),
                currency="EUR",
                source="manual-future",
            ),
        ]
    )
    db_session.commit()

    response = client.get("/api/wealth/monthly")

    assert response.status_code == 200

    current_row = next(
        row
        for row in response.json()
        if row["month"] == today.strftime("%Y-%m")
    )

    assert current_row["investment_value_eur"] == "240.00"
    assert current_row["total_wealth_eur"] == "1240.00"



def test_wealth_monthly_reconstructs_historical_owed_states(
    client,
    db_session,
):
    current_item = OwedItem(
        user_id=LOCAL_DEFAULT_USER_ID,
        person="Mother",
        amount_total=Decimal("100.00"),
        amount_paid=Decimal("40.00"),
        amount_remaining=Decimal("60.00"),
        reason="Historical shared costs",
        status="open",
    )
    other_user_item = OwedItem(
        user_id="other-user",
        person="Other",
        amount_total=Decimal("900.00"),
        amount_paid=Decimal("0.00"),
        amount_remaining=Decimal("900.00"),
        reason="Other user costs",
        status="open",
    )
    db_session.add_all([current_item, other_user_item])
    db_session.flush()

    db_session.add_all(
        [
            OwedItemEvent(
                user_id=LOCAL_DEFAULT_USER_ID,
                owed_item_id=current_item.id,
                event_type="created",
                effective_date=date(2026, 1, 10),
                amount_total=Decimal("100.00"),
                amount_paid=Decimal("0.00"),
                amount_remaining=Decimal("100.00"),
                status="open",
                notes="Created.",
            ),
            OwedItemEvent(
                user_id=LOCAL_DEFAULT_USER_ID,
                owed_item_id=current_item.id,
                event_type="payment",
                effective_date=date(2026, 2, 10),
                amount_total=Decimal("100.00"),
                amount_paid=Decimal("40.00"),
                amount_remaining=Decimal("60.00"),
                status="partially_paid",
                notes="Part payment.",
            ),
            OwedItemEvent(
                user_id=LOCAL_DEFAULT_USER_ID,
                owed_item_id=current_item.id,
                event_type="cancelled",
                effective_date=date(2026, 3, 10),
                amount_total=Decimal("100.00"),
                amount_paid=Decimal("40.00"),
                amount_remaining=Decimal("60.00"),
                status="cancelled",
                notes="Cancelled.",
            ),
            OwedItemEvent(
                user_id=LOCAL_DEFAULT_USER_ID,
                owed_item_id=current_item.id,
                event_type="reopened",
                effective_date=date(2026, 4, 10),
                amount_total=Decimal("100.00"),
                amount_paid=Decimal("40.00"),
                amount_remaining=Decimal("60.00"),
                status="partially_paid",
                notes="Reopened.",
            ),
            OwedItemEvent(
                user_id=LOCAL_DEFAULT_USER_ID,
                owed_item_id=current_item.id,
                event_type="deleted",
                effective_date=date(2026, 5, 10),
                amount_total=Decimal("100.00"),
                amount_paid=Decimal("40.00"),
                amount_remaining=Decimal("60.00"),
                status="partially_paid",
                notes="Deleted.",
            ),
            OwedItemEvent(
                user_id="other-user",
                owed_item_id=other_user_item.id,
                event_type="created",
                effective_date=date(2026, 1, 10),
                amount_total=Decimal("900.00"),
                amount_paid=Decimal("0.00"),
                amount_remaining=Decimal("900.00"),
                status="open",
                notes="Other user.",
            ),
        ]
    )
    db_session.commit()

    response = client.get("/api/wealth/monthly")

    assert response.status_code == 200
    rows_by_month = {
        row["month"]: row
        for row in response.json()
    }

    assert rows_by_month["2026-01"]["total_wealth_eur"] == "100.00"
    assert rows_by_month["2026-02"]["total_wealth_eur"] == "60.00"
    assert rows_by_month["2026-03"]["total_wealth_eur"] == "0.00"
    assert rows_by_month["2026-04"]["total_wealth_eur"] == "60.00"
    assert rows_by_month["2026-05"]["total_wealth_eur"] == "0.00"


def test_wealth_monthly_loads_owed_ledger_once(
    client,
    db_session,
):
    owed_item = OwedItem(
        user_id=LOCAL_DEFAULT_USER_ID,
        person="Mother",
        amount_total=Decimal("25.00"),
        amount_paid=Decimal("0.00"),
        amount_remaining=Decimal("25.00"),
        reason="Query count",
        status="open",
    )
    db_session.add(owed_item)
    db_session.flush()
    db_session.add(
        OwedItemEvent(
            user_id=LOCAL_DEFAULT_USER_ID,
            owed_item_id=owed_item.id,
            event_type="created",
            effective_date=date(2026, 1, 10),
            amount_total=Decimal("25.00"),
            amount_paid=Decimal("0.00"),
            amount_remaining=Decimal("25.00"),
            status="open",
            notes="Created.",
        )
    )
    db_session.commit()

    query_count = 0
    engine = db_session.get_bind()

    def count_owed_event_queries(
        connection,
        cursor,
        statement,
        parameters,
        context,
        executemany,
    ):
        nonlocal query_count
        del connection, cursor, parameters, context, executemany

        normalised_statement = statement.lower().lstrip()
        if (
            normalised_statement.startswith("select")
            and "owed_item_events" in normalised_statement
        ):
            query_count += 1

    sqlalchemy_event.listen(
        engine,
        "before_cursor_execute",
        count_owed_event_queries,
    )

    try:
        response = client.get("/api/wealth/monthly")
    finally:
        sqlalchemy_event.remove(
            engine,
            "before_cursor_execute",
            count_owed_event_queries,
        )

    assert response.status_code == 200
    assert query_count == 1
