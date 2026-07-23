from datetime import UTC, date, datetime
from decimal import Decimal

import pytest

from app.auth.current_user import (
    CurrentUser,
    LOCAL_DEFAULT_USER_ID,
)
from app.models.owed_item import OwedItem
from app.models.owed_item_event import OwedItemEvent
from app.models.owed_payment import (
    OwedPayment,
    OwedPaymentAllocation,
)
from app.models.transaction import Transaction
from app.repositories.owed_repository import OwedRepository
from app.repositories.transaction_repository import (
    TransactionRepository,
)
from app.schemas.financial_command import (
    TransactionLinkedOwedDeletionCommand,
)
from app.services.financial_command_service import (
    FinancialCommandService,
)
from app.services.owed_service import OwedService


USER = CurrentUser(id=LOCAL_DEFAULT_USER_ID)


def build_service(db_session) -> FinancialCommandService:
    transaction_repository = TransactionRepository(db_session)
    owed_repository = OwedRepository(db_session)
    owed_service = OwedService(
        owed_repository,
        transaction_repository,
    )
    return FinancialCommandService(
        db=db_session,
        transaction_repository=transaction_repository,
        owed_service=owed_service,
    )


def create_transaction(
    db_session,
    *,
    user_id: str = LOCAL_DEFAULT_USER_ID,
    direction: str = "out",
    description: str = "Shared expense",
    amount: str = "100.00",
) -> Transaction:
    transaction = Transaction(
        user_id=user_id,
        date=date(2026, 7, 23),
        description=description,
        raw_description=description,
        amount=Decimal(amount),
        direction=direction,
        cashflow_type=(
            "expense"
            if direction == "out"
            else "income"
        ),
        source="manual",
        currency="EUR",
    )
    db_session.add(transaction)
    db_session.flush()
    return transaction


def create_owed_item(
    db_session,
    *,
    transaction: Transaction | None,
    person: str = "Alice",
    amount_total: str = "50.00",
    amount_paid: str = "0.00",
    user_id: str = LOCAL_DEFAULT_USER_ID,
) -> OwedItem:
    total = Decimal(amount_total)
    paid = Decimal(amount_paid)
    remaining = total - paid

    if remaining == 0:
        item_status = "paid"
    elif paid > 0:
        item_status = "partially_paid"
    else:
        item_status = "open"

    owed_item = OwedItem(
        user_id=user_id,
        person=person,
        amount_total=total,
        amount_paid=paid,
        amount_remaining=remaining,
        reason="Shared expense",
        status=item_status,
        linked_transaction_id=(
            transaction.id
            if transaction is not None
            else None
        ),
        source="manual",
    )
    db_session.add(owed_item)
    db_session.flush()
    return owed_item


def create_payment_allocation(
    db_session,
    *,
    owed_item: OwedItem,
    amount: str,
    person: str | None = None,
    user_id: str = LOCAL_DEFAULT_USER_ID,
) -> tuple[OwedPayment, OwedPaymentAllocation]:
    payment = OwedPayment(
        user_id=user_id,
        person=person or owed_item.person,
        payment_date=date(2026, 7, 23),
        amount=Decimal(amount),
        currency="EUR",
        method="bank_transfer",
    )
    db_session.add(payment)
    db_session.flush()

    allocation = OwedPaymentAllocation(
        user_id=user_id,
        owed_payment_id=payment.id,
        owed_item_id=owed_item.id,
        amount=Decimal(amount),
    )
    db_session.add(allocation)
    db_session.flush()
    return payment, allocation


def get_preview(client, transaction_id: int) -> dict:
    response = client.get(
        f"/api/transactions/{transaction_id}/deletion-preview"
    )
    assert response.status_code == 200
    return response.json()


def execute_command(
    client,
    transaction_id: int,
    preview: dict,
    *,
    strategy: str,
    replacement_person: str | None = None,
):
    payload = {
        "strategy": strategy,
        "expected_owed_item_ids": [
            item["id"]
            for item in preview["linked_owed_items"]
        ],
        "expected_relationship_version": (
            preview["relationship_version"]
        ),
    }

    if replacement_person is not None:
        payload["replacement_person"] = replacement_person

    return client.post(
        (
            f"/api/transactions/{transaction_id}"
            "/commands/delete-linked-owed"
        ),
        json=payload,
    )


def test_unlinked_transaction_delete_uses_normal_flow(
    client,
    db_session,
):
    transaction = create_transaction(db_session)
    db_session.commit()

    response = client.delete(
        f"/api/transactions/{transaction.id}"
    )

    assert response.status_code == 204
    assert db_session.get(Transaction, transaction.id) is None


def test_normal_delete_rejects_linked_owed_records(
    client,
    db_session,
):
    transaction = create_transaction(db_session)
    owed_item = create_owed_item(
        db_session,
        transaction=transaction,
    )
    db_session.commit()

    response = client.delete(
        f"/api/transactions/{transaction.id}"
    )

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "Transaction has linked owed records. "
        "Preview the relationship and choose an explicit "
        "deletion strategy."
    )
    assert db_session.get(Transaction, transaction.id) is not None
    assert db_session.get(OwedItem, owed_item.id) is not None


def test_deletion_preview_is_authoritative_and_read_only(
    client,
    db_session,
):
    transaction = create_transaction(db_session)
    owed_item = create_owed_item(
        db_session,
        transaction=transaction,
    )
    db_session.commit()

    transaction_count = db_session.query(Transaction).count()
    owed_count = db_session.query(OwedItem).count()
    event_count = db_session.query(OwedItemEvent).count()

    preview = get_preview(client, transaction.id)

    assert preview["normal_delete_allowed"] is False
    assert preview["has_linked_owed"] is True
    assert preview["delete_with_owed_allowed"] is True
    assert preview["preserve_owed_allowed"] is True
    assert preview["available_replacement_people"] == [
        "Alice"
    ]
    assert preview["linked_owed_items"] == [
        {
            "id": owed_item.id,
            "person": "Alice",
            "amount_total": "50.00",
            "amount_paid": "0.00",
            "amount_remaining": "50.00",
            "status": "open",
            "allocation_count": 0,
            "deleted": False,
        }
    ]
    assert len(preview["relationship_version"]) == 64
    assert db_session.query(Transaction).count() == (
        transaction_count
    )
    assert db_session.query(OwedItem).count() == owed_count
    assert db_session.query(OwedItemEvent).count() == (
        event_count
    )


def test_delete_with_owed_affects_only_target_relationship(
    client,
    db_session,
):
    target_transaction = create_transaction(
        db_session,
        description="Target expense",
    )
    target_item = create_owed_item(
        db_session,
        transaction=target_transaction,
    )
    other_transaction = create_transaction(
        db_session,
        description="Other expense",
    )
    other_item = create_owed_item(
        db_session,
        transaction=other_transaction,
    )
    db_session.commit()

    preview = get_preview(client, target_transaction.id)
    response = execute_command(
        client,
        target_transaction.id,
        preview,
        strategy="delete_with_owed",
    )

    assert response.status_code == 200
    assert response.json() == {
        "deleted_transaction_id": target_transaction.id,
        "strategy": "delete_with_owed",
        "owed_items_deleted": 1,
        "owed_items_preserved": 0,
        "replacement_person": None,
    }

    db_session.expire_all()

    deleted_item = db_session.get(OwedItem, target_item.id)
    unchanged_item = db_session.get(OwedItem, other_item.id)

    assert db_session.get(
        Transaction,
        target_transaction.id,
    ) is None
    assert db_session.get(
        Transaction,
        other_transaction.id,
    ) is not None
    assert deleted_item is not None
    assert deleted_item.deleted_at is not None
    assert deleted_item.linked_transaction_id is None
    assert unchanged_item is not None
    assert unchanged_item.deleted_at is None
    assert unchanged_item.linked_transaction_id == (
        other_transaction.id
    )
    assert db_session.query(OwedItemEvent).filter(
        OwedItemEvent.owed_item_id == target_item.id,
        OwedItemEvent.event_type == "deleted",
    ).count() == 1


def test_delete_with_owed_rejects_partially_paid_item(
    client,
    db_session,
):
    transaction = create_transaction(db_session)
    owed_item = create_owed_item(
        db_session,
        transaction=transaction,
        amount_paid="10.00",
    )
    create_payment_allocation(
        db_session,
        owed_item=owed_item,
        amount="10.00",
    )
    db_session.commit()

    preview = get_preview(client, transaction.id)

    assert preview["delete_with_owed_allowed"] is False
    assert preview["delete_with_owed_block_reason"] == (
        "Paid or partially paid obligations must be preserved."
    )
    assert preview["linked_owed_items"][0][
        "allocation_count"
    ] == 1

    response = execute_command(
        client,
        transaction.id,
        preview,
        strategy="delete_with_owed",
    )

    assert response.status_code == 409
    assert db_session.get(Transaction, transaction.id) is not None
    assert db_session.get(OwedItem, owed_item.id) is not None
    assert db_session.query(
        OwedPaymentAllocation
    ).count() == 1


def test_preserve_reassigns_multiple_items_and_keeps_allocations(
    client,
    db_session,
):
    transaction = create_transaction(db_session)
    first_item = create_owed_item(
        db_session,
        transaction=transaction,
        person="Alice",
        amount_total="50.00",
        amount_paid="20.00",
    )
    second_item = create_owed_item(
        db_session,
        transaction=transaction,
        person="Carol",
        amount_total="20.00",
    )
    replacement_item = create_owed_item(
        db_session,
        transaction=None,
        person="Bob",
        amount_total="15.00",
    )
    first_payment, first_allocation = (
        create_payment_allocation(
            db_session,
            owed_item=first_item,
            amount="10.00",
        )
    )
    second_payment, second_allocation = (
        create_payment_allocation(
            db_session,
            owed_item=first_item,
            amount="10.00",
        )
    )
    db_session.commit()

    preview = get_preview(client, transaction.id)

    assert preview["delete_with_owed_allowed"] is False
    assert preview["preserve_owed_allowed"] is True
    assert {
        item["id"]: item["allocation_count"]
        for item in preview["linked_owed_items"]
    } == {
        first_item.id: 2,
        second_item.id: 0,
    }

    response = execute_command(
        client,
        transaction.id,
        preview,
        strategy="preserve_owed",
        replacement_person="Bob",
    )

    assert response.status_code == 200
    assert response.json() == {
        "deleted_transaction_id": transaction.id,
        "strategy": "preserve_owed",
        "owed_items_deleted": 0,
        "owed_items_preserved": 2,
        "replacement_person": "Bob",
    }

    db_session.expire_all()

    preserved_first = db_session.get(OwedItem, first_item.id)
    preserved_second = db_session.get(
        OwedItem,
        second_item.id,
    )

    assert db_session.get(Transaction, transaction.id) is None
    assert preserved_first is not None
    assert preserved_second is not None
    assert preserved_first.person == "Bob"
    assert preserved_second.person == "Bob"
    assert preserved_first.linked_transaction_id is None
    assert preserved_second.linked_transaction_id is None
    assert preserved_first.amount_total == Decimal("50.00")
    assert preserved_first.amount_paid == Decimal("20.00")
    assert preserved_first.amount_remaining == Decimal("30.00")
    assert preserved_second.amount_remaining == Decimal("20.00")
    assert db_session.get(
        OwedPayment,
        first_payment.id,
    ) is not None
    assert db_session.get(
        OwedPayment,
        second_payment.id,
    ) is not None
    assert db_session.get(
        OwedPaymentAllocation,
        first_allocation.id,
    ) is not None
    assert db_session.get(
        OwedPaymentAllocation,
        second_allocation.id,
    ) is not None
    assert db_session.get(
        OwedItem,
        replacement_item.id,
    ) is not None


def test_preserve_rejects_unknown_replacement_person(
    client,
    db_session,
):
    transaction = create_transaction(db_session)
    owed_item = create_owed_item(
        db_session,
        transaction=transaction,
    )
    db_session.commit()

    preview = get_preview(client, transaction.id)
    response = execute_command(
        client,
        transaction.id,
        preview,
        strategy="preserve_owed",
        replacement_person="Unknown person",
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Replacement person is not available for this user"
    )
    assert db_session.get(Transaction, transaction.id) is not None
    unchanged_item = db_session.get(OwedItem, owed_item.id)
    assert unchanged_item is not None
    assert unchanged_item.person == "Alice"
    assert unchanged_item.linked_transaction_id == transaction.id


def test_stale_preview_is_rejected_without_mutation(
    client,
    db_session,
):
    transaction = create_transaction(db_session)
    owed_item = create_owed_item(
        db_session,
        transaction=transaction,
    )
    db_session.commit()

    preview = get_preview(client, transaction.id)

    owed_item.amount_total = Decimal("60.00")
    owed_item.amount_remaining = Decimal("60.00")
    db_session.add(owed_item)
    db_session.commit()

    response = execute_command(
        client,
        transaction.id,
        preview,
        strategy="delete_with_owed",
    )

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "Linked owed records changed after the deletion preview. "
        "Refresh and review them again."
    )
    assert db_session.get(Transaction, transaction.id) is not None
    current_item = db_session.get(OwedItem, owed_item.id)
    assert current_item is not None
    assert current_item.amount_total == Decimal("60.00")
    assert current_item.deleted_at is None


def test_preview_rejects_cross_user_owed_item_reference(
    client,
    db_session,
):
    transaction = create_transaction(db_session)
    create_owed_item(
        db_session,
        transaction=transaction,
        user_id="other-user",
    )
    db_session.commit()

    response = client.get(
        f"/api/transactions/{transaction.id}/deletion-preview"
    )

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "Linked owed records have inconsistent ownership"
    )
    assert db_session.get(Transaction, transaction.id) is not None


def test_preview_rejects_cross_user_allocation_reference(
    client,
    db_session,
):
    transaction = create_transaction(db_session)
    owed_item = create_owed_item(
        db_session,
        transaction=transaction,
    )
    create_payment_allocation(
        db_session,
        owed_item=owed_item,
        amount="10.00",
        user_id="other-user",
    )
    db_session.commit()

    response = client.get(
        f"/api/transactions/{transaction.id}/deletion-preview"
    )

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "Linked owed allocations have inconsistent ownership"
    )
    assert db_session.get(Transaction, transaction.id) is not None


def test_other_user_transaction_is_not_disclosed(
    client,
    db_session,
):
    transaction = create_transaction(
        db_session,
        user_id="other-user",
    )
    create_owed_item(
        db_session,
        transaction=transaction,
        user_id="other-user",
    )
    db_session.commit()

    response = client.get(
        f"/api/transactions/{transaction.id}/deletion-preview"
    )

    assert response.status_code == 404


@pytest.mark.parametrize(
    "strategy",
    [
        "delete_with_owed",
        "preserve_owed",
    ],
)
def test_linked_delete_command_rolls_back_late_failure(
    db_session,
    monkeypatch,
    strategy,
):
    transaction = create_transaction(db_session)
    owed_item = create_owed_item(
        db_session,
        transaction=transaction,
    )

    if strategy == "preserve_owed":
        create_owed_item(
            db_session,
            transaction=None,
            person="Bob",
            amount_total="10.00",
        )

    db_session.commit()

    service = build_service(db_session)
    preview = service.preview_transaction_deletion(
        transaction.id,
        current_user=USER,
    )

    def fail_transaction_delete(
        transaction_model,
        *,
        commit=True,
    ):
        del transaction_model, commit
        raise RuntimeError("forced late deletion failure")

    monkeypatch.setattr(
        service.transaction_repository,
        "delete",
        fail_transaction_delete,
    )

    command = TransactionLinkedOwedDeletionCommand(
        strategy=strategy,
        expected_owed_item_ids=[
            item.id
            for item in preview.linked_owed_items
        ],
        expected_relationship_version=(
            preview.relationship_version
        ),
        replacement_person=(
            "Bob"
            if strategy == "preserve_owed"
            else None
        ),
    )

    with pytest.raises(
        RuntimeError,
        match="forced late deletion failure",
    ):
        service.delete_transaction_with_linked_owed(
            transaction.id,
            command,
            current_user=USER,
        )

    db_session.expire_all()

    unchanged_transaction = db_session.get(
        Transaction,
        transaction.id,
    )
    unchanged_item = db_session.get(OwedItem, owed_item.id)

    assert unchanged_transaction is not None
    assert unchanged_item is not None
    assert unchanged_item.person == "Alice"
    assert unchanged_item.linked_transaction_id == transaction.id
    assert unchanged_item.deleted_at is None
    assert db_session.query(OwedItemEvent).filter(
        OwedItemEvent.owed_item_id == owed_item.id,
    ).count() == 0

def test_linked_payment_preview_blocks_normal_deletion(
    client,
    db_session,
):
    transaction = create_transaction(
        db_session,
        direction="in",
        description="Repayment received",
    )
    payment = OwedPayment(
        user_id=LOCAL_DEFAULT_USER_ID,
        person="Alice",
        payment_date=date(2026, 7, 23),
        amount=Decimal("20.00"),
        currency="EUR",
        method="bank_transfer",
        linked_transaction_id=transaction.id,
    )
    db_session.add(payment)
    db_session.commit()

    preview = get_preview(client, transaction.id)

    assert preview["normal_delete_allowed"] is False
    assert preview["normal_delete_block_reason"] == (
        "Transaction has linked owed payment records."
    )
    assert preview["has_linked_owed"] is False
    assert preview["linked_owed_payment_count"] == 1
    assert preview["delete_with_owed_allowed"] is False
    assert preview["preserve_owed_allowed"] is False

    delete_response = client.delete(
        f"/api/transactions/{transaction.id}"
    )

    assert delete_response.status_code == 409
    assert db_session.get(Transaction, transaction.id) is not None
    assert db_session.get(OwedPayment, payment.id) is not None


def test_preview_rejects_cross_user_linked_payment(
    client,
    db_session,
):
    transaction = create_transaction(
        db_session,
        direction="in",
    )
    payment = OwedPayment(
        user_id="other-user",
        person="Other user",
        payment_date=date(2026, 7, 23),
        amount=Decimal("20.00"),
        currency="EUR",
        method="bank_transfer",
        linked_transaction_id=transaction.id,
    )
    db_session.add(payment)
    db_session.commit()

    response = client.get(
        f"/api/transactions/{transaction.id}/deletion-preview"
    )

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "Linked owed payment records have inconsistent ownership"
    )
    assert db_session.get(Transaction, transaction.id) is not None
    assert db_session.get(OwedPayment, payment.id) is not None


def test_soft_deleted_linked_item_blocks_both_strategies(
    client,
    db_session,
):
    transaction = create_transaction(db_session)
    owed_item = create_owed_item(
        db_session,
        transaction=transaction,
    )
    owed_item.deleted_at = datetime.now(UTC)
    db_session.add(owed_item)
    db_session.commit()

    preview = get_preview(client, transaction.id)

    assert preview["normal_delete_allowed"] is False
    assert preview["delete_with_owed_allowed"] is False
    assert preview["delete_with_owed_block_reason"] == (
        "Previously deleted owed records require manual review "
        "before deleting the transaction."
    )
    assert preview["preserve_owed_allowed"] is False
    assert preview["preserve_owed_block_reason"] == (
        "Previously deleted owed records cannot be preserved."
    )

    response = execute_command(
        client,
        transaction.id,
        preview,
        strategy="delete_with_owed",
    )

    assert response.status_code == 409
    assert db_session.get(Transaction, transaction.id) is not None

    current_item = db_session.get(OwedItem, owed_item.id)

    assert current_item is not None
    assert current_item.linked_transaction_id == transaction.id
    assert current_item.deleted_at is not None
