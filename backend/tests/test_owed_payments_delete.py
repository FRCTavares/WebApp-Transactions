def create_owed_item(
    client,
    *,
    person="Mother",
    reason="Groceries",
    amount_total="30.00",
):
    return client.post(
        "/api/owed",
        json={
            "person": person,
            "reason": reason,
            "amount_total": amount_total,
            "amount_paid": "0.00",
        },
    )


def test_delete_owed_payment_reopens_fully_paid_item(client):
    create_response = create_owed_item(
        client,
        person="Mother",
        reason="Cinema",
        amount_total="7.67",
    )
    owed_item_id = create_response.json()["id"]

    payment_response = client.post(
        "/api/owed/payments",
        json={
            "person": "Mother",
            "payment_date": "2026-06-22",
            "amount": "7.67",
            "method": "bank_transfer",
            "allocations": [
                {
                    "owed_item_id": owed_item_id,
                    "amount": "7.67",
                },
            ],
        },
    )
    payment_id = payment_response.json()["id"]

    delete_response = client.delete(f"/api/owed/payments/{payment_id}")

    assert delete_response.status_code == 204

    payment_get_response = client.get(f"/api/owed/payments/{payment_id}")
    owed_response = client.get(f"/api/owed/{owed_item_id}")

    assert payment_get_response.status_code == 404

    owed_item = owed_response.json()
    assert owed_item["amount_paid"] == "0.00"
    assert owed_item["amount_remaining"] == "7.67"
    assert owed_item["status"] == "open"


def test_delete_owed_payment_reverts_partial_allocations(client):
    first_response = create_owed_item(
        client,
        person="Mother",
        reason="Groceries",
        amount_total="20.00",
    )
    second_response = create_owed_item(
        client,
        person="Mother",
        reason="Pharmacy",
        amount_total="30.00",
    )

    first_id = first_response.json()["id"]
    second_id = second_response.json()["id"]

    payment_response = client.post(
        "/api/owed/payments",
        json={
            "person": "Mother",
            "payment_date": "2026-06-22",
            "amount": "35.00",
            "method": "bank_transfer",
            "allocations": [
                {
                    "owed_item_id": first_id,
                    "amount": "20.00",
                },
                {
                    "owed_item_id": second_id,
                    "amount": "15.00",
                },
            ],
        },
    )
    payment_id = payment_response.json()["id"]

    delete_response = client.delete(f"/api/owed/payments/{payment_id}")

    assert delete_response.status_code == 204

    first_owed = client.get(f"/api/owed/{first_id}").json()
    second_owed = client.get(f"/api/owed/{second_id}").json()

    assert first_owed["amount_paid"] == "0.00"
    assert first_owed["amount_remaining"] == "20.00"
    assert first_owed["status"] == "open"

    assert second_owed["amount_paid"] == "0.00"
    assert second_owed["amount_remaining"] == "30.00"
    assert second_owed["status"] == "open"


def test_delete_missing_owed_payment_returns_404(client):
    response = client.delete("/api/owed/payments/999999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Owed payment not found"
