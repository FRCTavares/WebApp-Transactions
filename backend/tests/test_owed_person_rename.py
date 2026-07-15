from datetime import date
from decimal import Decimal

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.models.owed_item import OwedItem
from app.models.owed_payment import OwedPayment
from app.models.transaction import Transaction
from app.repositories.owed_repository import OwedRepository
from app.services.owed_service import OwedService


LOCAL_CURRENT_USER = CurrentUser(id=LOCAL_DEFAULT_USER_ID)


def test_rename_person_updates_owed_items_and_payments(db_session):
    owed_transaction = Transaction(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 7, 6),
        description="Compras Auchan",
        raw_description="Compras Auchan",
        amount=Decimal("12.81"),
        direction="out",
        cashflow_type="expense",
        source="manual",
        currency="EUR",
    )
    payment_transaction = Transaction(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 7, 7),
        description="Pagamento Avó",
        raw_description="Pagamento Avó",
        amount=Decimal("20.00"),
        direction="in",
        cashflow_type="income",
        source="manual",
        currency="EUR",
    )
    db_session.add_all(
        [
            owed_transaction,
            payment_transaction,
        ]
    )
    db_session.flush()

    owed_item = OwedItem(
        user_id=LOCAL_DEFAULT_USER_ID,
        person="Avó",
        amount_total=Decimal("12.81"),
        amount_paid=Decimal("12.81"),
        amount_remaining=Decimal("0.00"),
        reason="Compras Auchan",
        status="paid",
        linked_transaction_id=owed_transaction.id,
        source="manual",
    )
    payment = OwedPayment(
        user_id=LOCAL_DEFAULT_USER_ID,
        person="Avó",
        payment_date=date(2026, 7, 7),
        amount=Decimal("20.00"),
        currency="EUR",
        method="bank_transfer",
        linked_transaction_id=payment_transaction.id,
    )
    db_session.add_all([owed_item, payment])
    db_session.commit()

    service = OwedService(OwedRepository(db_session))

    result = service.rename_person(
        rename_data=type(
            "RenameData",
            (),
            {"from_person": "Avó", "to_person": "Grandma"},
        )(),
        current_user=LOCAL_CURRENT_USER,
    )

    db_session.refresh(owed_item)
    db_session.refresh(payment)

    assert result.from_person == "Avó"
    assert result.to_person == "Grandma"
    assert result.owed_items_updated == 1
    assert result.payments_updated == 1
    assert owed_item.person == "Grandma"
    assert payment.person == "Grandma"


def test_rename_person_is_scoped_to_current_user(db_session):
    own_owed_item = OwedItem(
        user_id="user-one",
        person="Avó",
        amount_total=Decimal("12.81"),
        amount_paid=Decimal("0.00"),
        amount_remaining=Decimal("12.81"),
        reason="Own item",
        status="open",
        source="manual",
    )
    other_owed_item = OwedItem(
        user_id="user-two",
        person="Avó",
        amount_total=Decimal("12.81"),
        amount_paid=Decimal("0.00"),
        amount_remaining=Decimal("12.81"),
        reason="Other item",
        status="open",
        source="manual",
    )
    db_session.add_all([own_owed_item, other_owed_item])
    db_session.commit()

    service = OwedService(OwedRepository(db_session))

    result = service.rename_person(
        rename_data=type(
            "RenameData",
            (),
            {"from_person": "Avó", "to_person": "Grandma"},
        )(),
        current_user=CurrentUser(id="user-one"),
    )

    db_session.refresh(own_owed_item)
    db_session.refresh(other_owed_item)

    assert result.owed_items_updated == 1
    assert result.payments_updated == 0
    assert own_owed_item.person == "Grandma"
    assert other_owed_item.person == "Avó"
