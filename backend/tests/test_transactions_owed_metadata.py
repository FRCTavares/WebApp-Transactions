from datetime import UTC, date, datetime

import pytest
from fastapi import HTTPException

from app.auth.current_user import CurrentUser
from decimal import Decimal

from app.models.owed_item import OwedItem
from app.models.transaction import Transaction
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import TransactionCreate
from app.services.transaction_service import TransactionService


def test_list_transactions_includes_owed_metadata(db_session):
    transaction = Transaction(
        date=date(2026, 5, 28),
        description="Dominos",
        raw_description="DOMINOS EXPO II",
        amount=Decimal("29.00"),
        direction="out",
        source="manual",
        account=None,
        category="Restaurants",
        currency="EUR",
    )
    db_session.add(transaction)
    db_session.flush()

    owed_item = OwedItem(
        person="Grandma",
        amount_total=Decimal("29.00"),
        amount_paid=Decimal("0.00"),
        amount_remaining=Decimal("29.00"),
        reason="Pizza",
        status="open",
        linked_transaction_id=transaction.id,
        source="manual",
    )
    db_session.add(owed_item)
    db_session.commit()

    service = TransactionService(TransactionRepository(db_session))

    transactions = service.list_transactions(direction="out")

    assert len(transactions) == 1
    assert transactions[0].is_owed is True
    assert transactions[0].owed_item_id == owed_item.id
    assert transactions[0].owed_status == "open"
    assert transactions[0].owed_person == "Grandma"
    assert transactions[0].owed_amount_total == Decimal("29.00")
    assert transactions[0].owed_amount_paid == Decimal("0.00")
    assert transactions[0].owed_amount_remaining == Decimal("29.00")


def test_list_transactions_marks_non_owed_transaction(db_session):
    transaction = Transaction(
        date=date(2026, 5, 28),
        description="Coffee",
        raw_description="MY BREAK DELTA",
        amount=Decimal("1.10"),
        direction="out",
        source="manual",
        account=None,
        category="Food",
        currency="EUR",
    )
    db_session.add(transaction)
    db_session.commit()

    service = TransactionService(TransactionRepository(db_session))

    transactions = service.list_transactions(direction="out")

    assert len(transactions) == 1
    assert transactions[0].is_owed is False
    assert transactions[0].owed_item_id is None
    assert transactions[0].owed_status is None
    assert transactions[0].owed_person is None
    assert transactions[0].owed_amount_total is None
    assert transactions[0].owed_amount_paid is None
    assert transactions[0].owed_amount_remaining is None


def test_get_transaction_includes_paid_owed_metadata(db_session):
    transaction = Transaction(
        date=date(2026, 5, 28),
        description="Dominos",
        raw_description="DOMINOS EXPO II",
        amount=Decimal("29.00"),
        direction="out",
        source="manual",
        account=None,
        category="Restaurants",
        currency="EUR",
    )
    db_session.add(transaction)
    db_session.flush()

    owed_item = OwedItem(
        person="Grandma",
        amount_total=Decimal("29.00"),
        amount_paid=Decimal("29.00"),
        amount_remaining=Decimal("0.00"),
        reason="Pizza",
        status="paid",
        linked_transaction_id=transaction.id,
        source="manual",
    )
    db_session.add(owed_item)
    db_session.commit()

    service = TransactionService(TransactionRepository(db_session))

    result = service.get_transaction(transaction.id)

    assert result.is_owed is True
    assert result.owed_item_id == owed_item.id
    assert result.owed_status == "paid"
    assert result.owed_person == "Grandma"
    assert result.owed_amount_total == Decimal("29.00")
    assert result.owed_amount_paid == Decimal("29.00")
    assert result.owed_amount_remaining == Decimal("0.00")


def test_list_transactions_only_includes_current_user_owed_metadata(db_session):
    transaction = Transaction(
        date=date(2026, 5, 28),
        description="Dominos",
        raw_description="DOMINOS EXPO II",
        amount=Decimal("29.00"),
        direction="out",
        source="manual",
        account=None,
        category="Restaurants",
        currency="EUR",
    )
    db_session.add(transaction)
    db_session.flush()

    other_user_owed_item = OwedItem(
        user_id="other-user",
        person="Grandma",
        amount_total=Decimal("29.00"),
        amount_paid=Decimal("0.00"),
        amount_remaining=Decimal("29.00"),
        reason="Pizza",
        status="open",
        linked_transaction_id=transaction.id,
        source="manual",
    )
    db_session.add(other_user_owed_item)
    db_session.commit()

    service = TransactionService(TransactionRepository(db_session))

    transactions = service.list_transactions(
        direction="out",
        current_user=CurrentUser(id="local-default-user"),
    )

    assert len(transactions) == 1
    assert transactions[0].is_owed is False
    assert transactions[0].owed_item_id is None



def test_transactions_are_isolated_by_current_user(db_session):
    repository = TransactionRepository(db_session)
    service = TransactionService(repository)

    first_transaction = repository.create(
        TransactionCreate(
            date=date(2026, 6, 1),
            description="User one groceries",
            raw_description="User one groceries",
            amount=Decimal("10.00"),
            direction="out",
            source="manual",
            currency="EUR",
        ),
        user_id="user-one",
    )
    second_transaction = repository.create(
        TransactionCreate(
            date=date(2026, 6, 2),
            description="User two groceries",
            raw_description="User two groceries",
            amount=Decimal("20.00"),
            direction="out",
            source="manual",
            currency="EUR",
        ),
        user_id="user-two",
    )

    first_user_rows = service.list_transactions(
        current_user=CurrentUser(id="user-one"),
    )
    second_user_rows = service.list_transactions(
        current_user=CurrentUser(id="user-two"),
    )

    assert [transaction.id for transaction in first_user_rows] == [first_transaction.id]
    assert [transaction.id for transaction in second_user_rows] == [second_transaction.id]

    with pytest.raises(HTTPException) as caught_error:
        service.get_transaction(
            second_transaction.id,
            current_user=CurrentUser(id="user-one"),
        )

    assert caught_error.value.status_code == 404


def test_transaction_read_normalises_legacy_cashflow_type(db_session):
    transaction = Transaction(
        id=999001,
        created_at=datetime(2026, 5, 28, tzinfo=UTC),
        updated_at=datetime(2026, 5, 28, tzinfo=UTC),
        date=date(2026, 5, 28),
        description="Trading 212 deposit",
        raw_description="TRADING 212 DEPOSIT",
        amount=Decimal("100.00"),
        direction="out",
        cashflow_type="investment",
        source="manual",
        account=None,
        category="Investments",
        currency="EUR",
    )

    service = TransactionService(TransactionRepository(db_session))

    result = service._build_transaction_read(transaction, None)

    assert result.cashflow_type == "transfer"


def test_transaction_read_falls_back_for_unknown_cashflow_type(db_session):
    transaction = Transaction(
        id=999002,
        created_at=datetime(2026, 5, 28, tzinfo=UTC),
        updated_at=datetime(2026, 5, 28, tzinfo=UTC),
        date=date(2026, 5, 28),
        description="Legacy income",
        raw_description="LEGACY INCOME",
        amount=Decimal("100.00"),
        direction="in",
        cashflow_type="legacy_unknown",
        source="manual",
        account=None,
        category=None,
        currency="EUR",
    )

    service = TransactionService(TransactionRepository(db_session))

    result = service._build_transaction_read(transaction, None)

    assert result.cashflow_type == "income"
