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
