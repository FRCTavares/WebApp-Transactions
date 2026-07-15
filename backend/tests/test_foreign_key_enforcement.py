from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.models import (
    ImportBatch,
    InvestmentEvent,
    OwedItem,
    OwedPayment,
    OwedPaymentAllocation,
    Transaction,
    WealthAccount,
    WealthSnapshot,
)


def create_transaction(
    db_session,
    *,
    user_id: str = "user-1",
    direction: str = "out",
    import_batch_id: int | None = None,
) -> Transaction:
    transaction = Transaction(
        user_id=user_id,
        date=date(2026, 7, 14),
        description="Test transaction",
        raw_description="Test transaction",
        amount=Decimal("100.00"),
        direction=direction,
        cashflow_type="expense" if direction == "out" else "income",
        source="manual",
        currency="EUR",
        import_batch_id=import_batch_id,
    )
    db_session.add(transaction)
    db_session.flush()
    return transaction


def test_sqlite_foreign_keys_are_enabled(db_session):
    enabled = db_session.scalar(text("PRAGMA foreign_keys"))

    assert enabled == 1


def test_invalid_transaction_import_batch_is_rejected(db_session):
    with pytest.raises(IntegrityError):
        create_transaction(
            db_session,
            import_batch_id=999999,
        )

    db_session.rollback()


def test_investment_transaction_links_are_set_null_on_delete(db_session):
    transaction = create_transaction(db_session)
    event = InvestmentEvent(
        user_id="user-1",
        date=date(2026, 7, 14),
        source="manual",
        event_type="deposit",
        description="Investment deposit",
        raw_description="Investment deposit",
        amount=Decimal("100.00"),
        currency="EUR",
        transaction_id=transaction.id,
        matched_transaction_id=transaction.id,
    )
    db_session.add(event)
    db_session.commit()

    db_session.delete(transaction)
    db_session.commit()
    db_session.refresh(event)

    assert event.transaction_id is None
    assert event.matched_transaction_id is None


def test_owed_item_blocks_linked_transaction_delete(db_session):
    transaction = create_transaction(db_session)
    owed_item = OwedItem(
        user_id="user-1",
        person="Test",
        amount_total=Decimal("50.00"),
        amount_paid=Decimal("0.00"),
        amount_remaining=Decimal("50.00"),
        reason="Shared cost",
        status="open",
        linked_transaction_id=transaction.id,
        source="manual",
    )
    db_session.add(owed_item)
    db_session.commit()

    db_session.delete(transaction)

    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()
    assert db_session.get(Transaction, transaction.id) is not None


def test_owed_payment_delete_cascades_allocations(db_session):
    owed_item = OwedItem(
        user_id="user-1",
        person="Test",
        amount_total=Decimal("50.00"),
        amount_paid=Decimal("50.00"),
        amount_remaining=Decimal("0.00"),
        reason="Shared cost",
        status="paid",
        source="manual",
    )
    payment = OwedPayment(
        user_id="user-1",
        person="Test",
        payment_date=date(2026, 7, 14),
        amount=Decimal("50.00"),
        currency="EUR",
        method="bank_transfer",
    )
    db_session.add_all([owed_item, payment])
    db_session.flush()

    allocation = OwedPaymentAllocation(
        user_id="user-1",
        owed_payment_id=payment.id,
        owed_item_id=owed_item.id,
        amount=Decimal("50.00"),
    )
    db_session.add(allocation)
    db_session.commit()
    allocation_id = allocation.id

    db_session.delete(payment)
    db_session.commit()

    assert db_session.get(OwedPaymentAllocation, allocation_id) is None
    assert db_session.get(OwedItem, owed_item.id) is not None


def test_wealth_account_delete_is_restricted_when_snapshots_exist(db_session):
    account = WealthAccount(
        user_id="user-1",
        name="Savings",
        account_type="savings",
        currency="EUR",
        is_active=True,
    )
    db_session.add(account)
    db_session.flush()

    snapshot = WealthSnapshot(
        user_id="user-1",
        snapshot_date=date(2026, 7, 14),
        account_id=account.id,
        balance=Decimal("100.00"),
        currency="EUR",
        balance_eur=Decimal("100.00"),
        fx_rate_to_eur=Decimal("1.00"),
        source="manual",
    )
    db_session.add(snapshot)
    db_session.commit()

    db_session.delete(account)

    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()
    assert db_session.get(WealthAccount, account.id) is not None


def test_import_batch_delete_is_restricted_while_children_exist(db_session):
    import_batch = ImportBatch(
        user_id="user-1",
        source="activobank",
        filename="transactions.csv",
        rows_total=1,
        rows_inserted=1,
        rows_skipped=0,
        status="completed",
    )
    db_session.add(import_batch)
    db_session.flush()

    create_transaction(
        db_session,
        import_batch_id=import_batch.id,
    )
    db_session.commit()

    db_session.delete(import_batch)

    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()
    assert db_session.scalar(
        select(ImportBatch).where(ImportBatch.id == import_batch.id)
    ) is not None


def test_direct_allocation_with_missing_payment_is_rejected(db_session):
    owed_item = OwedItem(
        user_id="user-1",
        person="Test",
        amount_total=Decimal("50.00"),
        amount_paid=Decimal("0.00"),
        amount_remaining=Decimal("50.00"),
        reason="Shared cost",
        status="open",
        source="manual",
    )
    db_session.add(owed_item)
    db_session.flush()

    allocation = OwedPaymentAllocation(
        user_id="user-1",
        owed_payment_id=999999,
        owed_item_id=owed_item.id,
        amount=Decimal("10.00"),
    )
    db_session.add(allocation)

    with pytest.raises(IntegrityError):
        db_session.flush()

    db_session.rollback()
