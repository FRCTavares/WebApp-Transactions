from datetime import date
from decimal import Decimal

from sqlalchemy import select

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.models.investment_event import InvestmentEvent
from app.models.transaction import Transaction
from app.models.trip_savings_allocation import TripSavingsAllocation


def add_income_and_spending(
    db_session,
    *,
    year: int = 2026,
    month: int = 5,
) -> None:
    db_session.add_all(
        [
            Transaction(
                user_id=LOCAL_DEFAULT_USER_ID,
                date=date(year, month, 1),
                description="Salary",
                raw_description="Salary",
                amount=Decimal("1000.00"),
                direction="in",
                cashflow_type="income",
                source="manual",
                currency="EUR",
            ),
            Transaction(
                user_id=LOCAL_DEFAULT_USER_ID,
                date=date(year, month, 2),
                description="Living costs",
                raw_description="Living costs",
                amount=Decimal("600.00"),
                direction="out",
                cashflow_type="expense",
                source="manual",
                currency="EUR",
            ),
            InvestmentEvent(
                user_id=LOCAL_DEFAULT_USER_ID,
                date=date(year, month, 3),
                source="manual",
                event_type="market_buy",
                description="Investment",
                raw_description="Investment",
                amount=Decimal("100.00"),
                currency="EUR",
            ),
        ]
    )
    db_session.commit()


def read_summary(client, *, year: int = 2026, month: int = 5):
    response = client.get(
        f"/api/summary?year={year}&month={month}"
    )
    assert response.status_code == 200
    return response.json()


def test_default_trip_savings_reduces_available_net(client, db_session):
    add_income_and_spending(db_session)

    summary = read_summary(client)

    assert summary["personal_net"] == "400.00"
    assert summary["net_invested_cash"] == "100.00"
    assert summary["trip_savings_goal_eur"] == "50.00"
    assert summary["trip_savings_allocated_eur"] == "50.00"
    assert summary["trip_savings_allocation_source"] == "default"
    assert summary["trip_savings_goal_status"] == "reached"
    assert summary["available_net"] == "250.00"

    persisted = db_session.scalar(
        select(TripSavingsAllocation)
        .where(
            TripSavingsAllocation.user_id
            == LOCAL_DEFAULT_USER_ID
        )
        .where(TripSavingsAllocation.month == "2026-05")
    )
    assert persisted is None


def test_month_override_and_zero_are_authoritative(client, db_session):
    add_income_and_spending(db_session)

    response = client.put(
        "/api/summary/trip-savings?year=2026&month=5",
        json={"amount_eur": "80.00"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "month": "2026-05",
        "amount_eur": "80.00",
        "goal_eur": "50.00",
        "source": "override",
    }

    summary = read_summary(client)
    assert summary["trip_savings_allocated_eur"] == "80.00"
    assert summary["trip_savings_goal_status"] == "exceeded"
    assert summary["available_net"] == "220.00"

    response = client.put(
        "/api/summary/trip-savings?year=2026&month=5",
        json={"amount_eur": "0.00"},
    )
    assert response.status_code == 200

    summary = read_summary(client)
    assert summary["trip_savings_allocated_eur"] == "0.00"
    assert summary["trip_savings_allocation_source"] == "override"
    assert summary["trip_savings_goal_status"] == "in_progress"
    assert summary["available_net"] == "300.00"


def test_decimal_precision_and_negative_available_net(
    client,
    db_session,
):
    add_income_and_spending(db_session)

    response = client.put(
        "/api/summary/trip-savings?year=2026&month=5",
        json={"amount_eur": "450.55"},
    )
    assert response.status_code == 200
    assert response.json()["amount_eur"] == "450.55"

    summary = read_summary(client)
    assert summary["available_net"] == "-150.55"

    invalid = client.put(
        "/api/summary/trip-savings?year=2026&month=5",
        json={"amount_eur": "12.345"},
    )
    assert invalid.status_code == 422


def test_month_can_return_to_its_normal_default(client, db_session):
    add_income_and_spending(db_session)

    assert client.put(
        "/api/summary/trip-savings?year=2026&month=5",
        json={"amount_eur": "75.00"},
    ).status_code == 200

    response = client.put(
        "/api/summary/trip-savings?year=2026&month=5",
        json={"amount_eur": None},
    )

    assert response.status_code == 200
    assert response.json()["amount_eur"] == "50.00"
    assert response.json()["goal_eur"] == "50.00"
    assert response.json()["source"] == "default"

    summary = read_summary(client)
    assert summary["available_net"] == "250.00"


def test_month_write_is_isolated_to_authenticated_user(
    client,
    db_session,
):
    db_session.add(
        TripSavingsAllocation(
            user_id="other-user",
            month="2026-05",
            amount_eur=Decimal("999.00"),
            goal_eur=Decimal("50.00"),
            source="override",
        )
    )
    db_session.commit()

    response = client.put(
        "/api/summary/trip-savings?year=2026&month=5",
        json={"amount_eur": "75.00"},
    )
    assert response.status_code == 200

    other = db_session.scalar(
        select(TripSavingsAllocation)
        .where(TripSavingsAllocation.user_id == "other-user")
        .where(TripSavingsAllocation.month == "2026-05")
    )
    current = db_session.scalar(
        select(TripSavingsAllocation)
        .where(
            TripSavingsAllocation.user_id
            == LOCAL_DEFAULT_USER_ID
        )
        .where(TripSavingsAllocation.month == "2026-05")
    )

    assert other is not None
    assert other.amount_eur == Decimal("999.00")
    assert current is not None
    assert current.amount_eur == Decimal("75.00")


def test_default_change_preserves_historical_months(
    client,
    db_session,
):
    db_session.add(
        Transaction(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2020, 5, 1),
            description="Historical salary",
            raw_description="Historical salary",
            amount=Decimal("100.00"),
            direction="in",
            cashflow_type="income",
            source="manual",
            currency="EUR",
        )
    )
    db_session.commit()

    assert client.get("/api/preferences").status_code == 200

    response = client.put(
        "/api/preferences",
        json={
            "locale": "en-GB",
            "currency": "EUR",
            "time_zone": "Europe/Lisbon",
            "date_format": "medium",
            "language": "en",
            "monthly_trip_savings_goal_eur": "100.00",
        },
    )
    assert response.status_code == 200
    assert (
        response.json()["monthly_trip_savings_goal_eur"]
        == "100.00"
    )

    historical = db_session.scalar(
        select(TripSavingsAllocation)
        .where(
            TripSavingsAllocation.user_id
            == LOCAL_DEFAULT_USER_ID
        )
        .where(TripSavingsAllocation.month == "2020-05")
    )

    assert historical is not None
    assert historical.amount_eur == Decimal("50.00")
    assert historical.goal_eur == Decimal("50.00")
    assert historical.source == "default"

    historical_summary = read_summary(
        client,
        year=2020,
        month=5,
    )
    assert historical_summary["trip_savings_goal_eur"] == "50.00"
    assert (
        historical_summary["trip_savings_allocated_eur"]
        == "50.00"
    )

    reset = client.put(
        "/api/summary/trip-savings?year=2020&month=5",
        json={"amount_eur": None},
    )
    assert reset.status_code == 200
    assert reset.json()["amount_eur"] == "50.00"
    assert reset.json()["goal_eur"] == "50.00"
    assert reset.json()["source"] == "default"

    future_summary = read_summary(
        client,
        year=2100,
        month=1,
    )
    assert future_summary["trip_savings_goal_eur"] == "100.00"
    assert (
        future_summary["trip_savings_allocated_eur"]
        == "100.00"
    )
    assert future_summary["available_net"] == "-100.00"


def test_trip_savings_stays_known_when_investment_cashflow_is_unavailable(
    client,
    db_session,
):
    db_session.add(
        InvestmentEvent(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 5, 1),
            source="manual",
            event_type="market_buy",
            description="Pending FX investment",
            raw_description="Pending FX investment",
            amount=Decimal("100.00"),
            currency="USD",
            funding_source="activobank",
            funding_match_status="unmatched",
            fx_rate_source="pending",
        )
    )
    db_session.commit()

    summary = read_summary(client)

    assert summary["net_invested_cash"] is None
    assert summary["available_net"] is None
    assert summary["trip_savings_goal_eur"] == "50.00"
    assert summary["trip_savings_allocated_eur"] == "50.00"
