from datetime import date
from decimal import Decimal

import pytest

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.models.owed_item import OwedItem
from app.models.owed_item_event import OwedItemEvent
from app.models.owed_payment import OwedPayment, OwedPaymentAllocation
from app.models.transaction import Transaction
from app.repositories.owed_repository import OwedRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.financial_command import TransactionCreateWithOwedCommand
from app.schemas.owed_item import OwedItemCreate
from app.schemas.transaction import TransactionCreate
from app.services.financial_command_service import FinancialCommandService
from app.services.owed_service import OwedService


USER = CurrentUser(id=LOCAL_DEFAULT_USER_ID)


def build_service(db_session):
    transaction_repository = TransactionRepository(db_session)
    owed_repository = OwedRepository(db_session)
    owed_service = OwedService(owed_repository, transaction_repository)
    return FinancialCommandService(
        db=db_session,
        transaction_repository=transaction_repository,
        owed_service=owed_service,
    )


def test_create_transaction_with_owed_items_uses_one_api_request(
    client,
    db_session,
):
    response = client.post(
        "/api/transactions/commands/create-with-owed",
        json={
            "transaction": {
                "date": "2026-07-16",
                "description": "Shared dinner",
                "raw_description": "Shared dinner",
                "amount": "50.00",
                "direction": "out",
                "cashflow_type": "expense",
                "source": "manual",
                "currency": "EUR",
            },
            "owed_items": [
                {
                    "person": "Alice",
                    "amount_total": "20.00",
                    "reason": "Shared dinner",
                },
                {
                    "person": "Bob",
                    "amount_total": "10.00",
                    "reason": "Shared dinner",
                },
            ],
        },
    )

    assert response.status_code == 201
    data = response.json()

    assert data["is_owed"] is True
    assert data["owed_person"] == "2 people"
    assert data["owed_amount_total"] == "30.00"
    assert db_session.query(Transaction).count() == 1
    assert db_session.query(OwedItem).count() == 2
    assert db_session.query(OwedItemEvent).count() == 2


def test_create_transaction_with_owed_rejects_excess_total(
    client,
    db_session,
):
    response = client.post(
        "/api/transactions/commands/create-with-owed",
        json={
            "transaction": {
                "date": "2026-07-16",
                "description": "Shared dinner",
                "raw_description": "Shared dinner",
                "amount": "20.00",
                "direction": "out",
                "cashflow_type": "expense",
                "source": "manual",
                "currency": "EUR",
            },
            "owed_items": [
                {
                    "person": "Alice",
                    "amount_total": "25.00",
                    "reason": "Shared dinner",
                }
            ],
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Total owed amount cannot exceed transaction amount"
    )
    assert db_session.query(Transaction).count() == 0
    assert db_session.query(OwedItem).count() == 0


def test_create_transaction_with_owed_rolls_back_late_failure(
    db_session,
    monkeypatch,
):
    service = build_service(db_session)
    original_create = service.owed_service.create_owed_item
    create_count = 0

    def fail_after_first_owed_item(
        owed_data,
        *,
        current_user,
        commit=True,
    ):
        nonlocal create_count
        create_count += 1

        result = original_create(
            owed_data,
            current_user=current_user,
            commit=commit,
        )

        if create_count == 1:
            raise RuntimeError("forced failure after owed item flush")

        return result

    monkeypatch.setattr(
        service.owed_service,
        "create_owed_item",
        fail_after_first_owed_item,
    )

    command = TransactionCreateWithOwedCommand(
        transaction=TransactionCreate(
            date=date(2026, 7, 16),
            description="Rollback dinner",
            raw_description="Rollback dinner",
            amount=Decimal("50.00"),
            direction="out",
            source="manual",
            currency="EUR",
        ),
        owed_items=[
            OwedItemCreate(
                person="Alice",
                amount_total=Decimal("20.00"),
                reason="Rollback dinner",
            )
        ],
    )

    with pytest.raises(
        RuntimeError,
        match="forced failure after owed item flush",
    ):
        service.create_transaction_with_owed(
            command,
            current_user=USER,
        )

    assert db_session.query(Transaction).count() == 0
    assert db_session.query(OwedItem).count() == 0
    assert db_session.query(OwedItemEvent).count() == 0
    assert db_session.query(OwedPayment).count() == 0
    assert db_session.query(OwedPaymentAllocation).count() == 0

def create_transaction_model(
    db_session,
    *,
    direction,
    amount="50.00",
    description="Transaction",
):
    transaction = Transaction(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 7, 16),
        description=description,
        raw_description=description,
        amount=Decimal(amount),
        direction=direction,
        source="manual",
        currency="EUR",
    )
    db_session.add(transaction)
    db_session.commit()
    return transaction


def test_existing_transaction_owed_split_uses_one_api_request(
    client,
    db_session,
):
    expense = create_transaction_model(
        db_session,
        direction="out",
        description="Shared holiday",
    )
    payment_transaction = create_transaction_model(
        db_session,
        direction="in",
        amount="30.00",
        description="Alice transfer",
    )

    response = client.post(
        (
            f"/api/transactions/{expense.id}"
            "/commands/create-owed-split"
        ),
        json={
            "rows": [
                {
                    "person": "Alice",
                    "amount": "20.00",
                    "payment": {
                        "linked_transaction_id": payment_transaction.id,
                        "payment_date": "2026-07-16",
                        "amount": "30.00",
                        "currency": "EUR",
                        "method": "bank_transfer",
                        "unallocated_category": "Gift",
                    },
                },
                {
                    "person": "Bob",
                    "amount": "10.00",
                },
            ]
        },
    )

    assert response.status_code == 201
    data = response.json()

    assert data["owed_items_created"] == 2
    assert data["payments_created"] == 1
    assert data["transaction"]["is_owed"] is True
    assert data["transaction"]["owed_amount_total"] == "30.00"
    assert db_session.query(OwedItem).count() == 2
    assert db_session.query(OwedPayment).count() == 1
    assert db_session.query(OwedPaymentAllocation).count() == 1
    assert db_session.query(OwedItemEvent).count() == 3


def test_existing_transaction_owed_split_groups_rows_by_person(
    client,
    db_session,
):
    expense = create_transaction_model(
        db_session,
        direction="out",
        description="Shared shopping",
    )

    response = client.post(
        (
            f"/api/transactions/{expense.id}"
            "/commands/create-owed-split"
        ),
        json={
            "rows": [
                {"person": "Alice", "amount": "10.00"},
                {"person": "Alice", "amount": "15.00"},
            ]
        },
    )

    assert response.status_code == 201
    assert response.json()["owed_items_created"] == 1

    owed_item = db_session.query(OwedItem).one()
    assert owed_item.person == "Alice"
    assert owed_item.amount_total == Decimal("25.00")


def test_existing_transaction_owed_split_rejects_other_user_transaction(
    db_session,
):
    transaction = Transaction(
        user_id="other-user",
        date=date(2026, 7, 16),
        description="Other user expense",
        raw_description="Other user expense",
        amount=Decimal("50.00"),
        direction="out",
        source="manual",
        currency="EUR",
    )
    db_session.add(transaction)
    db_session.commit()

    service = build_service(db_session)

    from app.schemas.financial_command import (
        ExistingTransactionOwedSplitCommand,
    )

    command = ExistingTransactionOwedSplitCommand(
        rows=[
            {
                "person": "Alice",
                "amount": Decimal("10.00"),
            }
        ]
    )

    with pytest.raises(Exception) as caught_error:
        service.create_owed_split_for_transaction(
            transaction.id,
            command,
            current_user=USER,
        )

    assert getattr(caught_error.value, "status_code", None) == 404
    assert db_session.query(OwedItem).count() == 0


def test_existing_transaction_owed_split_rolls_back_late_payment_failure(
    db_session,
    monkeypatch,
):
    expense = create_transaction_model(
        db_session,
        direction="out",
        description="Rollback expense",
    )
    payment_transaction = create_transaction_model(
        db_session,
        direction="in",
        description="Rollback payment",
    )
    service = build_service(db_session)
    original_record_payment = service.owed_service.record_payment

    def fail_after_payment_flush(
        payment_data,
        *,
        current_user,
        commit=True,
    ):
        result = original_record_payment(
            payment_data,
            current_user=current_user,
            commit=commit,
        )
        raise RuntimeError("forced failure after payment flush")

    monkeypatch.setattr(
        service.owed_service,
        "record_payment",
        fail_after_payment_flush,
    )

    from app.schemas.financial_command import (
        ExistingTransactionOwedSplitCommand,
    )

    command = ExistingTransactionOwedSplitCommand(
        rows=[
            {
                "person": "Alice",
                "amount": Decimal("20.00"),
                "payment": {
                    "linked_transaction_id": payment_transaction.id,
                    "payment_date": date(2026, 7, 16),
                    "amount": Decimal("20.00"),
                    "method": "bank_transfer",
                },
            }
        ]
    )

    with pytest.raises(
        RuntimeError,
        match="forced failure after payment flush",
    ):
        service.create_owed_split_for_transaction(
            expense.id,
            command,
            current_user=USER,
        )

    assert db_session.query(Transaction).count() == 2
    assert db_session.query(OwedItem).count() == 0
    assert db_session.query(OwedPayment).count() == 0
    assert db_session.query(OwedPaymentAllocation).count() == 0
    assert db_session.query(OwedItemEvent).count() == 0
