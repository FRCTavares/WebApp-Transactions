"""Covers Issue #99: transactions must only reference a category that
exists, is active, and belongs to the authenticated user for the same
direction/cashflow type.
"""

from datetime import date
from decimal import Decimal

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.models.transaction import Transaction
from app.models.transaction_category import TransactionCategory


def create_category(client, name, direction="out", cashflow_type="expense", is_active=True):
    response = client.post(
        "/api/transaction-categories",
        json={
            "name": name,
            "direction": direction,
            "cashflow_type": cashflow_type,
            "is_active": is_active,
        },
    )
    assert response.status_code == 201
    return response.json()


def base_transaction_payload(**overrides):
    payload = {
        "date": "2026-05-04",
        "description": "Groceries run",
        "raw_description": "Groceries run",
        "amount": "12.50",
        "direction": "out",
        "cashflow_type": "expense",
        "source": "manual",
        "currency": "EUR",
    }
    payload.update(overrides)
    return payload


def test_create_transaction_with_no_category_succeeds(client):
    response = client.post(
        "/api/transactions",
        json=base_transaction_payload(),
    )

    assert response.status_code == 201
    assert response.json()["category"] is None


def test_create_transaction_with_known_category_succeeds(client):
    create_category(client, "Groceries")

    response = client.post(
        "/api/transactions",
        json=base_transaction_payload(category="Groceries"),
    )

    assert response.status_code == 201
    assert response.json()["category"] == "Groceries"


def test_create_transaction_with_unknown_category_is_rejected(client):
    response = client.post(
        "/api/transactions",
        json=base_transaction_payload(category="Nonexistent Category"),
    )

    assert response.status_code == 400
    assert "does not exist" in response.json()["detail"]


def test_create_transaction_with_inactive_category_is_rejected(client):
    create_category(client, "Retired Category", is_active=False)

    response = client.post(
        "/api/transactions",
        json=base_transaction_payload(category="Retired Category"),
    )

    assert response.status_code == 400


def test_create_transaction_category_must_match_direction(client):
    create_category(client, "Salary", direction="in", cashflow_type="income")

    response = client.post(
        "/api/transactions",
        json=base_transaction_payload(category="Salary"),
    )

    assert response.status_code == 400


def test_create_transaction_category_is_case_insensitive(client):
    create_category(client, "Groceries")

    response = client.post(
        "/api/transactions",
        json=base_transaction_payload(category="groceries"),
    )

    assert response.status_code == 201


def test_update_transaction_to_unknown_category_is_rejected(client):
    create_category(client, "Groceries")
    create_response = client.post(
        "/api/transactions",
        json=base_transaction_payload(category="Groceries"),
    )
    transaction_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/transactions/{transaction_id}",
        json={"category": "Nonexistent Category"},
    )

    assert update_response.status_code == 400

    unchanged = client.get(f"/api/transactions/{transaction_id}")
    assert unchanged.json()["category"] == "Groceries"


def test_update_transaction_to_known_category_succeeds(client):
    create_category(client, "Groceries")
    create_category(client, "Restaurants")
    create_response = client.post(
        "/api/transactions",
        json=base_transaction_payload(category="Groceries"),
    )
    transaction_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/transactions/{transaction_id}",
        json={"category": "Restaurants"},
    )

    assert update_response.status_code == 200
    assert update_response.json()["category"] == "Restaurants"


def test_update_cashflow_type_revalidates_existing_category(client):
    create_category(client, "Groceries")
    create_response = client.post(
        "/api/transactions",
        json=base_transaction_payload(category="Groceries"),
    )
    transaction_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/transactions/{transaction_id}",
        json={"cashflow_type": "transfer"},
    )

    assert update_response.status_code == 400

    unchanged = client.get(f"/api/transactions/{transaction_id}").json()
    assert unchanged["cashflow_type"] == "expense"
    assert unchanged["category"] == "Groceries"


def test_update_direction_and_cashflow_type_revalidate_existing_category(
    client,
):
    create_category(client, "Groceries")
    create_response = client.post(
        "/api/transactions",
        json=base_transaction_payload(category="Groceries"),
    )
    transaction_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/transactions/{transaction_id}",
        json={
            "direction": "in",
            "cashflow_type": "income",
        },
    )

    assert update_response.status_code == 400

    unchanged = client.get(f"/api/transactions/{transaction_id}").json()
    assert unchanged["direction"] == "out"
    assert unchanged["cashflow_type"] == "expense"
    assert unchanged["category"] == "Groceries"


def test_update_cashflow_type_accepts_category_in_target_group(client):
    create_category(client, "Flexible", cashflow_type="expense")
    create_category(client, "Flexible", cashflow_type="transfer")

    create_response = client.post(
        "/api/transactions",
        json=base_transaction_payload(category="Flexible"),
    )
    transaction_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/transactions/{transaction_id}",
        json={"cashflow_type": "transfer"},
    )

    assert update_response.status_code == 200
    assert update_response.json()["cashflow_type"] == "transfer"
    assert update_response.json()["category"] == "Flexible"


def test_update_transaction_unrelated_field_keeps_legacy_category(client, db_session):
    """A transaction imported with legacy free-text category data (no
    matching TransactionCategory row) must remain editable for unrelated
    fields without being forced to fix the category first.
    """
    legacy_transaction = Transaction(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 5, 4),
        description="Groceries run",
        raw_description="Groceries run",
        amount=Decimal("12.50"),
        direction="out",
        cashflow_type="expense",
        source="legacy_excel",
        category="Groceries",
        currency="EUR",
    )
    db_session.add(legacy_transaction)
    db_session.commit()
    transaction_id = legacy_transaction.id

    update_response = client.patch(
        f"/api/transactions/{transaction_id}",
        json={"notes": "Weekly shop"},
    )

    assert update_response.status_code == 200
    assert update_response.json()["category"] == "Groceries"
    assert update_response.json()["notes"] == "Weekly shop"


def test_update_transaction_resubmitting_same_legacy_category_is_allowed(client, db_session):
    from datetime import date
    from decimal import Decimal

    from app.auth.current_user import LOCAL_DEFAULT_USER_ID
    from app.models.transaction import Transaction

    legacy_transaction = Transaction(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 5, 4),
        description="Groceries run",
        raw_description="Groceries run",
        amount=Decimal("12.50"),
        direction="out",
        cashflow_type="expense",
        source="legacy_excel",
        category="Groceries",
        currency="EUR",
    )
    db_session.add(legacy_transaction)
    db_session.commit()
    transaction_id = legacy_transaction.id

    update_response = client.patch(
        f"/api/transactions/{transaction_id}",
        json={"category": "Groceries"},
    )

    assert update_response.status_code == 200


def test_update_transaction_clearing_category_succeeds(client):
    create_category(client, "Groceries")
    create_response = client.post(
        "/api/transactions",
        json=base_transaction_payload(category="Groceries"),
    )
    transaction_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/transactions/{transaction_id}",
        json={"category": None},
    )

    assert update_response.status_code == 200
    assert update_response.json()["category"] is None


def test_category_from_another_user_is_rejected(client, db_session):
    other_user_category = TransactionCategory(
        user_id="someone-else",
        name="Groceries",
        direction="out",
        cashflow_type="expense",
        is_active=True,
        sort_order=0,
    )
    db_session.add(other_user_category)
    db_session.commit()

    response = client.post(
        "/api/transactions",
        json=base_transaction_payload(category="Groceries"),
    )

    assert response.status_code == 400


def base_transaction_with_owed_payload(**overrides):
    return {
        "transaction": base_transaction_payload(**overrides),
        "owed_items": [],
    }


def test_create_with_owed_unknown_category_is_rejected(client):
    response = client.post(
        "/api/transactions/commands/create-with-owed",
        json=base_transaction_with_owed_payload(
            category="Nonexistent Category"
        ),
    )

    assert response.status_code == 400
    assert "does not exist" in response.json()["detail"]


def test_create_with_owed_known_category_succeeds(client):
    create_category(client, "Groceries")

    response = client.post(
        "/api/transactions/commands/create-with-owed",
        json=base_transaction_with_owed_payload(category="Groceries"),
    )

    assert response.status_code == 201
    assert response.json()["category"] == "Groceries"


def test_create_with_owed_category_is_case_insensitive(client):
    create_category(client, "Groceries")

    response = client.post(
        "/api/transactions/commands/create-with-owed",
        json=base_transaction_with_owed_payload(category="groceries"),
    )

    assert response.status_code == 201


def test_create_with_owed_category_must_match_direction(client):
    create_category(client, "Salary", direction="in", cashflow_type="income")

    response = client.post(
        "/api/transactions/commands/create-with-owed",
        json=base_transaction_with_owed_payload(category="Salary"),
    )

    assert response.status_code == 400
