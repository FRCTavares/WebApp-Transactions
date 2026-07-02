from datetime import date
from decimal import Decimal

from app.auth.current_user import CurrentUser
from app.models.investment_event import InvestmentEvent
from app.models.investment_funding_month import InvestmentFundingMonth
from app.models.owed_item import OwedItem
from app.models.owed_payment import OwedPayment, OwedPaymentAllocation
from app.models.transaction import Transaction
from app.repositories.month_reset_repository import MonthResetRepository
from app.schemas.admin_reset import MonthResetRequest
from app.services.admin_reset_service import AdminResetService


def test_reset_month_dry_run_counts_without_deleting(db_session):
    user = CurrentUser(id="user@example.com", email="user@example.com")
    service = AdminResetService(MonthResetRepository(db_session))

    transaction = Transaction(
        user_id=user.id,
        date=date(2026, 6, 5),
        description="Pizza",
        raw_description="Pizza raw",
        amount=Decimal("30.00"),
        direction="out",
        cashflow_type="expense",
        currency="EUR",
    )
    db_session.add(transaction)
    db_session.flush()

    owed_item = OwedItem(
        user_id=user.id,
        person="Grandma",
        amount_total=Decimal("30.00"),
        amount_paid=Decimal("0.00"),
        amount_remaining=Decimal("30.00"),
        reason="Pizza",
        status="open",
        linked_transaction_id=transaction.id,
    )
    db_session.add(owed_item)
    db_session.flush()

    payment = OwedPayment(
        user_id=user.id,
        person="Grandma",
        payment_date=date(2026, 6, 6),
        amount=Decimal("30.00"),
        currency="EUR",
        method="cash",
    )
    db_session.add(payment)
    db_session.flush()

    allocation = OwedPaymentAllocation(
        user_id=user.id,
        owed_payment_id=payment.id,
        owed_item_id=owed_item.id,
        amount=Decimal("30.00"),
    )
    investment_event = InvestmentEvent(
        user_id=user.id,
        date=date(2026, 6, 7),
        source="manual",
        event_type="deposit",
        description="Investment deposit",
        raw_description="Investment deposit raw",
        amount=Decimal("50.00"),
        currency="EUR",
    )
    funding_month = InvestmentFundingMonth(
        user_id=user.id,
        month="2026-06",
        source="trading212",
        manual_amount=Decimal("50.00"),
        cashback_rounding_amount=Decimal("0.00"),
        currency="EUR",
    )
    db_session.add_all([allocation, investment_event, funding_month])
    db_session.commit()

    response = service.reset_month(
        MonthResetRequest(
            year=2026,
            month=6,
            confirm="DELETE 2026-06",
            dry_run=True,
        ),
        user,
    )

    assert response.status == "dry_run"
    assert response.before == {
        "transactions": 1,
        "owed_items": 1,
        "owed_payments": 1,
        "owed_payment_allocations": 1,
        "investment_events": 1,
        "investment_funding_months": 1,
    }
    assert response.deleted == {
        "transactions": 0,
        "owed_items": 0,
        "owed_payments": 0,
        "owed_payment_allocations": 0,
        "investment_events": 0,
        "investment_funding_months": 0,
    }
    assert response.after == response.before


def test_reset_month_deletes_only_selected_month_and_user(db_session):
    user = CurrentUser(id="user@example.com", email="user@example.com")
    other_user = CurrentUser(id="other@example.com", email="other@example.com")
    service = AdminResetService(MonthResetRepository(db_session))

    june_transaction = Transaction(
        user_id=user.id,
        date=date(2026, 6, 5),
        description="June expense",
        raw_description="June expense raw",
        amount=Decimal("10.00"),
        direction="out",
        cashflow_type="expense",
        currency="EUR",
    )
    july_transaction = Transaction(
        user_id=user.id,
        date=date(2026, 7, 5),
        description="July expense",
        raw_description="July expense raw",
        amount=Decimal("20.00"),
        direction="out",
        cashflow_type="expense",
        currency="EUR",
    )
    other_user_transaction = Transaction(
        user_id=other_user.id,
        date=date(2026, 6, 5),
        description="Other user expense",
        raw_description="Other user expense raw",
        amount=Decimal("30.00"),
        direction="out",
        cashflow_type="expense",
        currency="EUR",
    )
    db_session.add_all([june_transaction, july_transaction, other_user_transaction])
    db_session.commit()

    response = service.reset_month(
        MonthResetRequest(
            year=2026,
            month=6,
            confirm="DELETE 2026-06",
            dry_run=False,
        ),
        user,
    )

    assert response.status == "deleted"
    assert response.before["transactions"] == 1
    assert response.deleted["transactions"] == 1
    assert response.after["transactions"] == 0

    remaining_descriptions = {
        row.description
        for row in db_session.query(Transaction).order_by(Transaction.description).all()
    }

    assert remaining_descriptions == {"July expense", "Other user expense"}
