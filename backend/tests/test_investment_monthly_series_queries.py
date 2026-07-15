from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import event

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.models.investment_event import InvestmentEvent
from app.models.market_price_history import MarketPriceHistory


def test_monthly_series_loads_reusable_history_once(client, db_session):
    today = date.today()
    current_month_start = today.replace(day=1)
    previous_month_end = current_month_start - timedelta(days=1)
    previous_month_start = previous_month_end.replace(day=1)
    two_months_ago_end = previous_month_start - timedelta(days=1)
    two_months_ago_start = two_months_ago_end.replace(day=1)
    buy_date = two_months_ago_start - timedelta(days=1)

    db_session.add_all(
        [
            InvestmentEvent(
                user_id=LOCAL_DEFAULT_USER_ID,
                date=buy_date,
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
                currency="EUR",
                fx_rate_to_eur=Decimal("1"),
            ),
            MarketPriceHistory(
                ticker="CSPX",
                isin="IE00B5BMR087",
                price_date=two_months_ago_end,
                close_price=Decimal("110"),
                currency="EUR",
                source="manual",
            ),
            MarketPriceHistory(
                ticker="CSPX",
                isin="IE00B5BMR087",
                price_date=previous_month_end,
                close_price=Decimal("115"),
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
        ]
    )
    db_session.commit()

    query_counts = {
        "investment_events": 0,
        "market_price_history": 0,
    }

    engine = db_session.get_bind()

    def count_relevant_queries(
        connection,
        cursor,
        statement,
        parameters,
        context,
        executemany,
    ):
        del connection, cursor, parameters, context, executemany

        normalised_statement = statement.lower()

        if not normalised_statement.lstrip().startswith("select"):
            return

        if "investment_events" in normalised_statement:
            query_counts["investment_events"] += 1

        if "market_price_history" in normalised_statement:
            query_counts["market_price_history"] += 1

    event.listen(engine, "before_cursor_execute", count_relevant_queries)

    try:
        response = client.get(
            "/api/investment-events/monthly-series?months=3"
        )
    finally:
        event.remove(
            engine,
            "before_cursor_execute",
            count_relevant_queries,
        )

    assert response.status_code == 200
    assert len(response.json()) == 3

    assert query_counts == {
        "investment_events": 1,
        "market_price_history": 1,
    }
