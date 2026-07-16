from datetime import date
from decimal import Decimal

from app.auth.current_user import CurrentUser
from app.models.owed_item import OwedItem
from app.models.owed_item_event import OwedItemEvent
from app.models.owed_payment import OwedPayment, OwedPaymentAllocation
from app.models.transaction import Transaction
from app.repositories.owed_repository import OwedRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.owed_item import OwedItemCreate, OwedPaymentCreate
from app.schemas.transaction import TransactionCreate
from app.services.owed_service import OwedService


USER = CurrentUser(id="command-user")


def build_transaction_create(direction: str = "out") -> TransactionCreate:
    return TransactionCreate(
        date=date(2026, 7, 16),
        description="Atomic workflow",
        raw_description="Atomic workflow",
        amount=Decimal("50.00"),
        direction=direction,
        source="manual",
        currency="EUR",
    )


def test_transaction_create_can_be_rolled_back(db_session):
    repository = TransactionRepository(db_session)

    transaction = repository.create(
        build_transaction_create(),
        user_id=USER.id,
        commit=False,
    )

    assert transaction.id is not None
    assert db_session.query(Transaction).count() == 1

    db_session.rollback()

    assert db_session.query(Transaction).count() == 0


def test_owed_item_create_can_be_rolled_back_with_event(db_session):
    transaction_repository = TransactionRepository(db_session)
    owed_repository = OwedRepository(db_session)
    service = OwedService(owed_repository, transaction_repository)

    transaction = transaction_repository.create(
        build_transaction_create(),
        user_id=USER.id,
        commit=False,
    )
    owed_item = service.create_owed_item(
        OwedItemCreate(
            person="Alice",
            amount_total=Decimal("20.00"),
            reason="Shared expense",
            linked_transaction_id=transaction.id,
        ),
        current_user=USER,
        commit=False,
    )

    assert owed_item.id is not None
    assert db_session.query(Transaction).count() == 1
    assert db_session.query(OwedItem).count() == 1
    assert db_session.query(OwedItemEvent).count() == 1

    db_session.rollback()

    assert db_session.query(Transaction).count() == 0
    assert db_session.query(OwedItem).count() == 0
    assert db_session.query(OwedItemEvent).count() == 0


def test_owed_payment_create_can_be_rolled_back_with_allocation(db_session):
    transaction_repository = TransactionRepository(db_session)
    owed_repository = OwedRepository(db_session)
    service = OwedService(owed_repository, transaction_repository)

    expense = transaction_repository.create(
        build_transaction_create(),
        user_id=USER.id,
        commit=False,
    )
    payment_transaction = transaction_repository.create(
        build_transaction_create(direction="in"),
        user_id=USER.id,
        commit=False,
    )
    owed_item = service.create_owed_item(
        OwedItemCreate(
            person="Alice",
            amount_total=Decimal("20.00"),
            reason="Shared expense",
            linked_transaction_id=expense.id,
        ),
        current_user=USER,
        commit=False,
    )
    payment = service.record_payment(
        OwedPaymentCreate(
            person="Alice",
            payment_date=date(2026, 7, 16),
            amount=Decimal("20.00"),
            method="bank_transfer",
            linked_transaction_id=payment_transaction.id,
            allocations=[
                {
                    "owed_item_id": owed_item.id,
                    "amount": Decimal("20.00"),
                }
            ],
        ),
        current_user=USER,
        commit=False,
    )

    assert payment.id is not None
    assert db_session.query(Transaction).count() == 2
    assert db_session.query(OwedItem).count() == 1
    assert db_session.query(OwedPayment).count() == 1
    assert db_session.query(OwedPaymentAllocation).count() == 1
    assert db_session.query(OwedItemEvent).count() == 2

    db_session.rollback()

    assert db_session.query(Transaction).count() == 0
    assert db_session.query(OwedItem).count() == 0
    assert db_session.query(OwedPayment).count() == 0
    assert db_session.query(OwedPaymentAllocation).count() == 0
    assert db_session.query(OwedItemEvent).count() == 0
