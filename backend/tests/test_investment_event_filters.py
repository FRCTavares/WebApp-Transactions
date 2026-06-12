from datetime import date
from decimal import Decimal

from app.models.investment_event import InvestmentEvent


def create_event(
    db_session,
    *,
    event_date,
    event_type,
    amount,
    source="trading212",
    currency="USD",
    description="Investment event",
    funding_source=None,
    funding_match_status=None,
):
    event = InvestmentEvent(
        date=event_date,
        source=source,
        account="Trading 212",
        event_type=event_type,
        description=description,
        raw_description=description,
        amount=Decimal(amount),
        currency=currency,
        original_amount=Decimal(amount),
        original_currency=currency,
        funding_source=funding_source,
        funding_match_status=funding_match_status,
    )

    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)

    return event


def test_list_investment_events(client, db_session):
    create_event(
        db_session,
        event_date=date(2024, 9, 9),
        event_type="deposit",
        amount="37.00",
        funding_source="activobank",
        funding_match_status="unmatched",
    )
    create_event(
        db_session,
        event_date=date(2024, 9, 9),
        event_type="market_buy",
        amount="37.00",
    )

    response = client.get("/api/investment-events")

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 2
    assert {event["event_type"] for event in data} == {"deposit", "market_buy"}


def test_list_investment_events_filters_by_event_type(client, db_session):
    deposit = create_event(
        db_session,
        event_date=date(2024, 9, 9),
        event_type="deposit",
        amount="37.00",
        funding_source="activobank",
        funding_match_status="unmatched",
    )
    create_event(
        db_session,
        event_date=date(2024, 9, 9),
        event_type="market_buy",
        amount="37.00",
    )

    response = client.get("/api/investment-events?event_type=deposit")

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["id"] == deposit.id
    assert data[0]["funding_source"] == "activobank"
    assert data[0]["funding_match_status"] == "unmatched"


def test_list_investment_events_filters_by_source_and_date_range(client, db_session):
    matching_event = create_event(
        db_session,
        event_date=date(2024, 10, 1),
        event_type="market_buy",
        amount="147.00",
        source="trading212",
    )
    create_event(
        db_session,
        event_date=date(2024, 10, 1),
        event_type="market_buy",
        amount="147.00",
        source="manual",
    )
    create_event(
        db_session,
        event_date=date(2024, 11, 1),
        event_type="market_buy",
        amount="147.00",
        source="trading212",
    )

    response = client.get(
        "/api/investment-events?"
        "source=trading212&"
        "date_from=2024-10-01&"
        "date_to=2024-10-31"
    )

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["id"] == matching_event.id


def test_get_investment_event(client, db_session):
    event = create_event(
        db_session,
        event_date=date(2024, 9, 9),
        event_type="deposit",
        amount="37.00",
    )

    response = client.get(f"/api/investment-events/{event.id}")

    assert response.status_code == 200

    data = response.json()

    assert data["id"] == event.id
    assert data["event_type"] == "deposit"


def test_get_missing_investment_event_returns_404(client):
    response = client.get("/api/investment-events/999999")

    assert response.status_code == 404


def test_resolve_manual_funding_creates_transaction_and_updates_event(client, db_session):
    event = create_event(
        db_session,
        event_date=date(2024, 9, 9),
        event_type="deposit",
        amount="37.00",
        funding_source="activobank",
        funding_match_status="unmatched",
        description="Trading 212 deposit",
    )

    response = client.post(
        f"/api/investment-events/{event.id}/resolve-manual-funding",
        json={
            "eur_amount": "34.10",
            "date": "2024-09-09",
            "description": "Trading 212 deposit funding",
            "notes": "Manual funding resolution",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["transaction_id"] is not None
    assert data["investment_event"]["id"] == event.id
    assert data["investment_event"]["funding_match_status"] == "manual"
    assert data["investment_event"]["transaction_id"] == data["transaction_id"]
    assert data["investment_event"]["matched_transaction_id"] == data["transaction_id"]
    assert data["investment_event"]["fx_rate_source"] == "manual"

    transaction = db_session.get(
        __import__("app.models.transaction", fromlist=["Transaction"]).Transaction,
        data["transaction_id"],
    )

    assert transaction is not None
    assert transaction.direction == "out"
    assert transaction.cashflow_type == "investment"
    assert transaction.amount == Decimal("34.10")
    assert transaction.currency == "EUR"
    assert transaction.original_amount == Decimal("37.00")
    assert transaction.original_currency == "USD"
    assert transaction.fx_rate_source == "manual"
    assert transaction.source == "manual"
    assert transaction.account == "ActivoBank"


def test_resolve_manual_funding_rejects_non_deposit_event(client, db_session):
    event = create_event(
        db_session,
        event_date=date(2024, 9, 9),
        event_type="market_buy",
        amount="37.00",
    )

    response = client.post(
        f"/api/investment-events/{event.id}/resolve-manual-funding",
        json={
            "eur_amount": "34.10",
            "date": "2024-09-09",
            "description": "Invalid funding",
        },
    )

    assert response.status_code == 400


def test_resolve_manual_funding_rejects_already_resolved_event(client, db_session):
    event = create_event(
        db_session,
        event_date=date(2024, 9, 9),
        event_type="deposit",
        amount="37.00",
        funding_source="activobank",
        funding_match_status="manual",
    )

    response = client.post(
        f"/api/investment-events/{event.id}/resolve-manual-funding",
        json={
            "eur_amount": "34.10",
            "date": "2024-09-09",
            "description": "Duplicate funding",
        },
    )

    assert response.status_code == 400
