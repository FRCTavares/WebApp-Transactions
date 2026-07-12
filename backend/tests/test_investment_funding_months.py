from decimal import Decimal

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.repositories.investment_funding_month_repository import (
    InvestmentFundingMonthRepository,
)
from app.schemas.investment_funding_month import InvestmentFundingMonthCreate
from app.services.investment_funding_month_service import InvestmentFundingMonthService


def test_upsert_investment_funding_month_creates_then_updates(db_session):
    service = InvestmentFundingMonthService(
        InvestmentFundingMonthRepository(db_session),
    )
    current_user = CurrentUser(id=LOCAL_DEFAULT_USER_ID)

    created = service.upsert_funding_month(
        InvestmentFundingMonthCreate(
            month="2026-06",
            source="trading212",
            manual_amount=Decimal("100.00"),
            cashback_rounding_amount=Decimal("9.77"),
            notes="Manual investment plus cashback, rounding, and residual cash.",
        ),
        current_user=current_user,
    )

    assert created.id is not None
    assert created.month == "2026-06"
    assert created.source == "trading212"
    assert created.manual_amount == Decimal("100.00")
    assert created.cashback_rounding_amount == Decimal("9.77")

    updated = service.upsert_funding_month(
        InvestmentFundingMonthCreate(
            month="2026-06",
            source="trading212",
            manual_amount=Decimal("100.00"),
            cashback_rounding_amount=Decimal("10.00"),
            notes="Updated note.",
        ),
        current_user=current_user,
    )

    assert updated.id == created.id
    assert updated.cashback_rounding_amount == Decimal("10.00")
    assert updated.notes == "Updated note."

    funding_months = service.list_funding_months(
        month="2026-06",
        source="trading212",
        current_user=current_user,
    )

    assert len(funding_months) == 1


def test_investment_funding_month_api_lists_and_upserts(client):
    response = client.post(
        "/api/investment-funding-months",
        json={
            "month": "2026-06",
            "source": "trading212",
            "manual_amount": "100.00",
            "cashback_rounding_amount": "9.77",
            "currency": "EUR",
            "notes": "Manual investment plus cashback, rounding, and residual cash.",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["month"] == "2026-06"
    assert data["source"] == "trading212"
    assert data["manual_amount"] == "100.00"
    assert data["cashback_rounding_amount"] == "9.77"

    response = client.get("/api/investment-funding-months?month=2026-06&source=trading212")

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["notes"] == "Manual investment plus cashback, rounding, and residual cash."
