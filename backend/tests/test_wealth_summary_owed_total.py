from datetime import date
from decimal import Decimal

from app.models.owed_item import OwedItem
from app.models.wealth_account import WealthAccount
from app.models.wealth_snapshot import WealthSnapshot
from app.repositories.owed_repository import OwedRepository
from app.repositories.wealth_repository import WealthRepository
from app.services.wealth_service import WealthService


def test_wealth_summary_includes_active_owed_remaining_total(db_session):
    account = WealthAccount(
        name="Savings",
        account_type="savings_account",
        currency="EUR",
        is_active=True,
    )
    db_session.add(account)
    db_session.flush()

    db_session.add(
        WealthSnapshot(
            snapshot_date=date(2026, 6, 1),
            account_id=account.id,
            balance=Decimal("1000.00"),
            currency="EUR",
            balance_eur=Decimal("1000.00"),
            fx_rate_to_eur=Decimal("1.00000000"),
        )
    )
    db_session.add(
        OwedItem(
            person="Mother",
            amount_total=Decimal("200.00"),
            amount_paid=Decimal("50.00"),
            amount_remaining=Decimal("150.00"),
            reason="Shared expenses",
            status="partially_paid",
        )
    )
    db_session.add(
        OwedItem(
            person="Friend",
            amount_total=Decimal("30.00"),
            amount_paid=Decimal("30.00"),
            amount_remaining=Decimal("0.00"),
            reason="Paid back",
            status="paid",
        )
    )
    db_session.add(
        OwedItem(
            person="Cancelled",
            amount_total=Decimal("40.00"),
            amount_paid=Decimal("0.00"),
            amount_remaining=Decimal("40.00"),
            reason="Cancelled item",
            status="cancelled",
        )
    )
    db_session.commit()

    service = WealthService(
        WealthRepository(db_session),
        OwedRepository(db_session),
    )

    summary = service.get_summary()

    assert summary.money_owed_to_me_eur == Decimal("150.00")
    assert summary.current_total_wealth_eur == Decimal("1150.00")
