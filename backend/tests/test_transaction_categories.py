import pytest
from fastapi import HTTPException

from app.auth.current_user import CurrentUser
from app.repositories.transaction_category_repository import (
    TransactionCategoryRepository,
)
from app.schemas.transaction_category import (
    TransactionCategoryCreate,
)
from app.services.transaction_category_service import (
    TransactionCategoryService,
)


def test_transaction_category_endpoint_crud(client):
    create_response = client.post(
        "/api/transaction-categories",
        json={
            "name": "Food",
            "direction": "out",
            "cashflow_type": "expense",
            "is_active": True,
            "sort_order": 10,
        },
    )

    assert create_response.status_code == 201
    created = create_response.json()

    assert created["name"] == "Food"
    assert created["direction"] == "out"
    assert created["cashflow_type"] == "expense"
    assert created["is_active"] is True
    assert created["sort_order"] == 10

    list_response = client.get(
        "/api/transaction-categories"
        "?active_only=true"
        "&direction=out"
        "&cashflow_type=expense"
    )

    assert list_response.status_code == 200
    assert [row["name"] for row in list_response.json()] == ["Food"]

    update_response = client.patch(
        f"/api/transaction-categories/{created['id']}",
        json={
            "name": "Groceries",
            "sort_order": 5,
        },
    )

    assert update_response.status_code == 200
    updated = update_response.json()

    assert updated["name"] == "Groceries"
    assert updated["sort_order"] == 5

    delete_response = client.delete(
        f"/api/transaction-categories/{created['id']}"
    )

    assert delete_response.status_code == 204
    assert client.get("/api/transaction-categories").json() == []


def test_transaction_category_rejects_invalid_direction_type(client):
    response = client.post(
        "/api/transaction-categories",
        json={
            "name": "Invalid category",
            "direction": "in",
            "cashflow_type": "expense",
        },
    )

    assert response.status_code == 422


def test_transaction_category_rejects_case_insensitive_duplicate(
    db_session,
):
    repository = TransactionCategoryRepository(db_session)
    service = TransactionCategoryService(repository)

    service.create_category(
        TransactionCategoryCreate(
            name="Food",
            direction="out",
            cashflow_type="expense",
        )
    )

    with pytest.raises(HTTPException) as caught_error:
        service.create_category(
            TransactionCategoryCreate(
                name=" food ",
                direction="out",
                cashflow_type="expense",
            )
        )

    assert caught_error.value.status_code == 409


def test_transaction_categories_are_isolated_by_user(db_session):
    repository = TransactionCategoryRepository(db_session)
    service = TransactionCategoryService(repository)

    first_user = CurrentUser(id="user-one")
    second_user = CurrentUser(id="user-two")

    first_category = service.create_category(
        TransactionCategoryCreate(
            name="Food",
            direction="out",
            cashflow_type="expense",
        ),
        first_user,
    )

    second_category = service.create_category(
        TransactionCategoryCreate(
            name="Salary",
            direction="in",
            cashflow_type="income",
        ),
        second_user,
    )

    assert [
        category.id
        for category in service.list_categories(
            current_user=first_user
        )
    ] == [first_category.id]

    assert [
        category.id
        for category in service.list_categories(
            current_user=second_user
        )
    ] == [second_category.id]

    with pytest.raises(HTTPException) as caught_error:
        service.get_category(
            second_category.id,
            first_user,
        )

    assert caught_error.value.status_code == 404


def test_used_transaction_category_requires_replacement(client):
    category_response = client.post(
        "/api/transaction-categories",
        json={
            "name": "Food",
            "direction": "out",
            "cashflow_type": "expense",
        },
    )
    category_id = category_response.json()["id"]

    transaction_response = client.post(
        "/api/transactions",
        json={
            "date": "2026-07-11",
            "description": "Lunch",
            "raw_description": "Lunch",
            "amount": "12.00",
            "direction": "out",
            "cashflow_type": "expense",
            "source": "manual",
            "category": "Food",
            "currency": "EUR",
        },
    )
    assert transaction_response.status_code == 201

    usage_response = client.get(
        f"/api/transaction-categories/{category_id}/usage"
    )

    assert usage_response.status_code == 200
    assert usage_response.json() == {
        "transaction_count": 1,
    }

    delete_response = client.delete(
        f"/api/transaction-categories/{category_id}"
    )

    assert delete_response.status_code == 409


def test_replace_and_delete_updates_matching_transactions(client):
    food_response = client.post(
        "/api/transaction-categories",
        json={
            "name": "Food",
            "direction": "out",
            "cashflow_type": "expense",
        },
    )
    groceries_response = client.post(
        "/api/transaction-categories",
        json={
            "name": "Groceries",
            "direction": "out",
            "cashflow_type": "expense",
        },
    )

    food_id = food_response.json()["id"]
    groceries_id = groceries_response.json()["id"]

    transaction_response = client.post(
        "/api/transactions",
        json={
            "date": "2026-07-11",
            "description": "Supermarket",
            "raw_description": "Supermarket",
            "amount": "30.00",
            "direction": "out",
            "cashflow_type": "expense",
            "source": "manual",
            "category": "Food",
            "currency": "EUR",
        },
    )
    transaction_id = transaction_response.json()["id"]

    replace_response = client.post(
        f"/api/transaction-categories/{food_id}/replace-and-delete",
        json={"replacement_category_id": groceries_id},
    )

    assert replace_response.status_code == 200
    assert replace_response.json() == {
        "deleted_category_id": food_id,
        "replacement_category_id": groceries_id,
        "transactions_updated": 1,
    }

    updated_transaction = client.get(
        f"/api/transactions/{transaction_id}"
    ).json()

    assert updated_transaction["category"] == "Groceries"
    assert client.get(
        f"/api/transaction-categories/{food_id}"
    ).status_code == 404


def test_replace_and_delete_rejects_wrong_category_group(client):
    food_response = client.post(
        "/api/transaction-categories",
        json={
            "name": "Food",
            "direction": "out",
            "cashflow_type": "expense",
        },
    )
    salary_response = client.post(
        "/api/transaction-categories",
        json={
            "name": "Salary",
            "direction": "in",
            "cashflow_type": "income",
        },
    )

    response = client.post(
        f"/api/transaction-categories/"
        f"{food_response.json()['id']}/replace-and-delete",
        json={
            "replacement_category_id": salary_response.json()["id"],
        },
    )

    assert response.status_code == 400


def test_replace_and_delete_cannot_use_inactive_category(client):
    food_response = client.post(
        "/api/transaction-categories",
        json={
            "name": "Food",
            "direction": "out",
            "cashflow_type": "expense",
        },
    )
    groceries_response = client.post(
        "/api/transaction-categories",
        json={
            "name": "Groceries",
            "direction": "out",
            "cashflow_type": "expense",
            "is_active": False,
        },
    )

    response = client.post(
        f"/api/transaction-categories/"
        f"{food_response.json()['id']}/replace-and-delete",
        json={
            "replacement_category_id": groceries_response.json()["id"],
        },
    )

    assert response.status_code == 400

def test_replace_and_delete_does_not_change_other_user_data(db_session):
    from datetime import date
    from decimal import Decimal

    from app.auth.current_user import CurrentUser
    from app.models.transaction import Transaction

    repository = TransactionCategoryRepository(db_session)
    service = TransactionCategoryService(repository)

    first_user = CurrentUser(id="user-one")
    second_user = CurrentUser(id="user-two")

    food = service.create_category(
        TransactionCategoryCreate(
            name="Food",
            direction="out",
            cashflow_type="expense",
        ),
        first_user,
    )
    groceries = service.create_category(
        TransactionCategoryCreate(
            name="Groceries",
            direction="out",
            cashflow_type="expense",
        ),
        first_user,
    )

    other_user_transaction = Transaction(
        user_id=second_user.id,
        date=date(2026, 7, 11),
        description="Other user lunch",
        raw_description="Other user lunch",
        amount=Decimal("15.00"),
        direction="out",
        cashflow_type="expense",
        source="manual",
        category="Food",
        currency="EUR",
    )
    db_session.add(other_user_transaction)
    db_session.commit()

    result = service.replace_and_delete_category(
        food.id,
        groceries.id,
        first_user,
    )

    db_session.refresh(other_user_transaction)

    assert result.transactions_updated == 0
    assert other_user_transaction.category == "Food"

def test_transaction_category_migration_preview(client):
    food_response = client.post(
        "/api/transaction-categories",
        json={
            "name": "Food",
            "direction": "out",
            "cashflow_type": "expense",
        },
    )
    groceries_response = client.post(
        "/api/transaction-categories",
        json={
            "name": "Groceries",
            "direction": "out",
            "cashflow_type": "expense",
        },
    )
    restaurants_response = client.post(
        "/api/transaction-categories",
        json={
            "name": "Restaurants",
            "direction": "out",
            "cashflow_type": "expense",
        },
    )
    salary_response = client.post(
        "/api/transaction-categories",
        json={
            "name": "Salary",
            "direction": "in",
            "cashflow_type": "income",
        },
    )

    assert groceries_response.status_code == 201
    assert restaurants_response.status_code == 201
    assert salary_response.status_code == 201

    transaction_response = client.post(
        "/api/transactions",
        json={
            "date": "2026-07-11",
            "description": "McDonalds",
            "raw_description": "MCDONALDS LISBOA",
            "amount": "12.50",
            "direction": "out",
            "cashflow_type": "expense",
            "source": "manual",
            "category": "Food",
            "currency": "EUR",
        },
    )
    assert transaction_response.status_code == 201

    category_id = food_response.json()["id"]

    preview_response = client.get(
        f"/api/transaction-categories/"
        f"{category_id}/migration-preview"
    )

    assert preview_response.status_code == 200

    preview = preview_response.json()

    assert preview["category"]["name"] == "Food"
    assert len(preview["transactions"]) == 1
    assert preview["transactions"][0]["description"] == "McDonalds"
    replacement_names = {
        category["name"]
        for category in preview["replacement_categories"]
    }

    assert replacement_names == {
        "Groceries",
        "Restaurants",
    }

def test_apply_reviewed_category_migration(client):
    food = client.post(
        "/api/transaction-categories",
        json={
            "name": "Food",
            "direction": "out",
            "cashflow_type": "expense",
        },
    ).json()
    groceries = client.post(
        "/api/transaction-categories",
        json={
            "name": "Groceries",
            "direction": "out",
            "cashflow_type": "expense",
        },
    ).json()
    restaurants = client.post(
        "/api/transaction-categories",
        json={
            "name": "Restaurants",
            "direction": "out",
            "cashflow_type": "expense",
        },
    ).json()

    supermarket = client.post(
        "/api/transactions",
        json={
            "date": "2026-07-11",
            "description": "Continente",
            "raw_description": "CONTINENTE",
            "amount": "30.00",
            "direction": "out",
            "cashflow_type": "expense",
            "source": "manual",
            "category": "Food",
            "currency": "EUR",
        },
    ).json()
    restaurant = client.post(
        "/api/transactions",
        json={
            "date": "2026-07-11",
            "description": "McDonalds",
            "raw_description": "MCDONALDS",
            "amount": "12.00",
            "direction": "out",
            "cashflow_type": "expense",
            "source": "manual",
            "category": "Food",
            "currency": "EUR",
        },
    ).json()

    response = client.post(
        f"/api/transaction-categories/"
        f"{food['id']}/apply-migration",
        json={
            "transaction_assignments": [
                {
                    "transaction_id": supermarket["id"],
                    "replacement_category_id": groceries["id"],
                },
                {
                    "transaction_id": restaurant["id"],
                    "replacement_category_id": restaurants["id"],
                },
            ],
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "deleted_category_id": food["id"],
        "transactions_updated": 2,
    }

    assert client.get(
        f"/api/transactions/{supermarket['id']}"
    ).json()["category"] == "Groceries"
    assert client.get(
        f"/api/transactions/{restaurant['id']}"
    ).json()["category"] == "Restaurants"

    assert client.get(
        f"/api/transaction-categories/{food['id']}"
    ).status_code == 404


def test_apply_reviewed_migration_requires_complete_assignments(client):
    food = client.post(
        "/api/transaction-categories",
        json={
            "name": "Food",
            "direction": "out",
            "cashflow_type": "expense",
        },
    ).json()
    groceries = client.post(
        "/api/transaction-categories",
        json={
            "name": "Groceries",
            "direction": "out",
            "cashflow_type": "expense",
        },
    ).json()

    client.post(
        "/api/transactions",
        json={
            "date": "2026-07-11",
            "description": "Continente",
            "raw_description": "CONTINENTE",
            "amount": "30.00",
            "direction": "out",
            "cashflow_type": "expense",
            "source": "manual",
            "category": "Food",
            "currency": "EUR",
        },
    )

    response = client.post(
        f"/api/transaction-categories/"
        f"{food['id']}/apply-migration",
        json={
            "transaction_assignments": [],
        },
    )

    assert response.status_code == 400
    assert client.get(
        f"/api/transaction-categories/{food['id']}"
    ).status_code == 200
    assert client.get(
        f"/api/transaction-categories/{groceries['id']}"
    ).status_code == 200
