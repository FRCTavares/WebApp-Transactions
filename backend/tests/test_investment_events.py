from datetime import date
from decimal import Decimal

from app.repositories.investment_event_repository import InvestmentEventRepository
from app.schemas.investment_event import InvestmentEventCreate, InvestmentEventUpdate
from app.services.investment_event_service import InvestmentEventService


def test_create_and_list_investment_event(db_session):
    repository = InvestmentEventRepository(db_session)
    service = InvestmentEventService(repository)

    created_event = service.create_event(
        InvestmentEventCreate(
            date=date(2026, 5, 2),
            source="trading212",
            account="Trading 212",
            event_type="market_buy",
            description="Market buy",
            raw_description="Market buy | ID: market-1",
            instrument_name="Example ETF",
            ticker="EXMP",
            quantity=Decimal("1.50000000"),
            price=Decimal("12.34000000"),
            amount=Decimal("18.51"),
            currency="EUR",
            original_amount=Decimal("20.00"),
            original_currency="USD",
            fx_rate_to_eur=Decimal("0.92550000"),
            fx_rate_source="pending",
            external_id="market-1",
            dedupe_hash="test-investment-event-hash",
        )
    )

    events = service.list_events(source="trading212")

    assert len(events) == 1
    assert events[0].id == created_event.id
    assert events[0].event_type == "market_buy"
    assert events[0].amount == Decimal("18.51")
    assert events[0].currency == "EUR"
    assert events[0].original_amount == Decimal("20.00")
    assert events[0].original_currency == "USD"
    assert events[0].fx_rate_source == "pending"


def test_update_investment_event(db_session):
    repository = InvestmentEventRepository(db_session)
    service = InvestmentEventService(repository)

    created_event = service.create_event(
        InvestmentEventCreate(
            date=date(2026, 5, 2),
            source="trading212",
            event_type="interest",
            description="Interest on cash",
            raw_description="Interest on cash | ID: interest-1",
            amount=Decimal("0.03"),
            currency="EUR",
        )
    )

    updated_event = service.update_event(
        created_event.id,
        InvestmentEventUpdate(notes="Monthly broker interest"),
    )

    assert updated_event.notes == "Monthly broker interest"
