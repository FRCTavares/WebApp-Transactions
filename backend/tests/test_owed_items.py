from decimal import Decimal


def create_owed_item(
    client,
    *,
    person="John",
    reason="Dinner",
    amount_total="30.00",
    amount_paid="0.00",
    due_date=None,
    notes=None,
):
    payload = {
        "person": person,
        "reason": reason,
        "amount_total": amount_total,
        "amount_paid": amount_paid,
        "due_date": due_date,
        "notes": notes,
    }

    return client.post("/api/owed", json=payload)


def test_create_owed_item_calculates_remaining_and_open_status(client):
    response = create_owed_item(
        client,
        person="Alice",
        reason="Concert ticket",
        amount_total="50.00",
    )

    assert response.status_code == 201

    data = response.json()

    assert data["person"] == "Alice"
    assert data["reason"] == "Concert ticket"
    assert data["amount_total"] == "50.00"
    assert data["amount_paid"] == "0.00"
    assert data["amount_remaining"] == "50.00"
    assert data["status"] == "open"


def test_create_owed_item_with_partial_payment_becomes_partially_paid(client):
    response = create_owed_item(
        client,
        amount_total="80.00",
        amount_paid="25.00",
    )

    assert response.status_code == 201

    data = response.json()

    assert data["amount_remaining"] == "55.00"
    assert data["status"] == "partially_paid"


def test_create_owed_item_fully_paid_becomes_paid(client):
    response = create_owed_item(
        client,
        amount_total="40.00",
        amount_paid="40.00",
    )

    assert response.status_code == 201

    data = response.json()

    assert data["amount_remaining"] == "0.00"
    assert data["status"] == "paid"


def test_create_owed_item_rejects_paid_amount_greater_than_total(client):
    response = create_owed_item(
        client,
        amount_total="30.00",
        amount_paid="40.00",
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Amount paid cannot be greater than amount total"


def test_list_owed_items_filters_by_status_and_person(client):
    create_owed_item(
        client,
        person="Alice",
        reason="Dinner",
        amount_total="30.00",
        amount_paid="0.00",
    )
    create_owed_item(
        client,
        person="Alice",
        reason="Trip",
        amount_total="100.00",
        amount_paid="50.00",
    )
    create_owed_item(
        client,
        person="Bob",
        reason="Coffee",
        amount_total="5.00",
        amount_paid="5.00",
    )

    response = client.get("/api/owed?status=partially_paid&person=Alice")

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["person"] == "Alice"
    assert data[0]["reason"] == "Trip"
    assert data[0]["status"] == "partially_paid"


def test_list_owed_items_active_status_returns_open_and_partially_paid_only(client):
    create_owed_item(
        client,
        person="Alice",
        reason="Dinner",
        amount_total="30.00",
        amount_paid="0.00",
    )
    create_owed_item(
        client,
        person="Alice",
        reason="Trip",
        amount_total="100.00",
        amount_paid="50.00",
    )
    create_owed_item(
        client,
        person="Bob",
        reason="Coffee",
        amount_total="5.00",
        amount_paid="5.00",
    )

    response = client.get("/api/owed?status=active")

    assert response.status_code == 200

    data = response.json()
    statuses = {item["status"] for item in data}

    assert len(data) == 2
    assert statuses == {"open", "partially_paid"}


def test_get_missing_owed_item_returns_404(client):
    response = client.get("/api/owed/999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Owed item not found"


def test_update_owed_item_recalculates_remaining_and_status(client):
    create_response = create_owed_item(
        client,
        person="Alice",
        reason="Dinner",
        amount_total="60.00",
        amount_paid="0.00",
    )

    owed_item_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/owed/{owed_item_id}",
        json={
            "amount_paid": "20.00",
            "notes": "Paid part in cash",
        },
    )

    assert update_response.status_code == 200

    data = update_response.json()

    assert data["amount_total"] == "60.00"
    assert data["amount_paid"] == "20.00"
    assert data["amount_remaining"] == "40.00"
    assert data["status"] == "partially_paid"
    assert data["notes"] == "Paid part in cash"


def test_mark_owed_item_paid_by_updating_amount_paid(client):
    create_response = create_owed_item(
        client,
        amount_total="70.00",
        amount_paid="10.00",
    )

    owed_item_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/owed/{owed_item_id}",
        json={
            "amount_paid": "70.00",
        },
    )

    assert update_response.status_code == 200

    data = update_response.json()

    assert data["amount_remaining"] == "0.00"
    assert data["status"] == "paid"


def test_update_owed_item_can_keep_manual_cancelled_status(client):
    create_response = create_owed_item(
        client,
        amount_total="25.00",
        amount_paid="0.00",
    )

    owed_item_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/owed/{owed_item_id}",
        json={
            "status": "cancelled",
        },
    )

    assert update_response.status_code == 200

    data = update_response.json()

    assert data["amount_remaining"] == "25.00"
    assert data["status"] == "cancelled"


def test_delete_owed_item_removes_it(client):
    create_response = create_owed_item(client)
    owed_item_id = create_response.json()["id"]

    delete_response = client.delete(f"/api/owed/{owed_item_id}")

    assert delete_response.status_code == 204

    get_response = client.get(f"/api/owed/{owed_item_id}")

    assert get_response.status_code == 404


def test_decimal_values_are_returned_with_two_decimal_places(client):
    response = create_owed_item(
        client,
        amount_total="12.345",
        amount_paid="1.235",
    )

    assert response.status_code == 201

    data = response.json()

    assert Decimal(data["amount_total"]) == Decimal("12.35")
    assert Decimal(data["amount_paid"]) == Decimal("1.24")
    assert Decimal(data["amount_remaining"]) == Decimal("11.11")
