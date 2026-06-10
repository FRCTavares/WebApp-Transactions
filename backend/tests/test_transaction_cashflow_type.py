from decimal import Decimal


def test_transaction_create_defaults_cashflow_type_from_direction(client):
    income_response = client.post(
        "/api/transactions",
        json={
            "date": "2026-05-01",
            "description": "Salary",
            "raw_description": "Salary",
            "amount": "1000.00",
            "direction": "in",
            "source": "manual",
            "currency": "EUR",
        },
    )
    expense_response = client.post(
        "/api/transactions",
        json={
            "date": "2026-05-02",
            "description": "Groceries",
            "raw_description": "Groceries",
            "amount": "20.00",
            "direction": "out",
            "source": "manual",
            "currency": "EUR",
        },
    )

    assert income_response.status_code == 201
    assert expense_response.status_code == 201
    assert income_response.json()["cashflow_type"] == "income"
    assert expense_response.json()["cashflow_type"] == "expense"


def test_transaction_can_be_marked_as_internal_transfer(client):
    create_response = client.post(
        "/api/transactions",
        json={
            "date": "2026-05-03",
            "description": "ActivoBank to Revolut",
            "raw_description": "TRF P/ REVOLUT",
            "amount": "100.00",
            "direction": "out",
            "cashflow_type": "internal_transfer",
            "source": "activobank",
            "currency": "EUR",
        },
    )

    assert create_response.status_code == 201
    assert create_response.json()["cashflow_type"] == "internal_transfer"


def test_transactions_can_be_filtered_by_cashflow_type(client):
    client.post(
        "/api/transactions",
        json={
            "date": "2026-05-03",
            "description": "ActivoBank to Revolut",
            "raw_description": "TRF P/ REVOLUT",
            "amount": "100.00",
            "direction": "out",
            "cashflow_type": "internal_transfer",
            "source": "activobank",
            "currency": "EUR",
        },
    )
    client.post(
        "/api/transactions",
        json={
            "date": "2026-05-04",
            "description": "Groceries",
            "raw_description": "Groceries",
            "amount": "20.00",
            "direction": "out",
            "cashflow_type": "expense",
            "source": "manual",
            "currency": "EUR",
        },
    )

    response = client.get("/api/transactions?cashflow_type=internal_transfer")

    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 1
    assert rows[0]["description"] == "ActivoBank to Revolut"
    assert Decimal(rows[0]["amount"]) == Decimal("100.00")
