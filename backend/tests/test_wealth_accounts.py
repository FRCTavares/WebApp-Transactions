def test_create_list_update_delete_wealth_account(client):
    create_response = client.post(
        "/api/wealth/accounts",
        json={
            "name": "ActivoBank Current Account",
            "account_type": "current_account",
            "currency": "EUR",
            "institution": "ActivoBank",
            "notes": "Main account",
        },
    )

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["id"] > 0
    assert created["name"] == "ActivoBank Current Account"
    assert created["account_type"] == "current_account"
    assert created["currency"] == "EUR"
    assert created["is_active"] is True

    list_response = client.get("/api/wealth/accounts")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    get_response = client.get(f"/api/wealth/accounts/{created['id']}")
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "ActivoBank Current Account"

    update_response = client.patch(
        f"/api/wealth/accounts/{created['id']}",
        json={
            "name": "ActivoBank Main Account",
            "is_active": False,
        },
    )

    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["name"] == "ActivoBank Main Account"
    assert updated["is_active"] is False

    delete_response = client.delete(f"/api/wealth/accounts/{created['id']}")
    assert delete_response.status_code == 204

    list_after_delete_response = client.get("/api/wealth/accounts")
    assert list_after_delete_response.status_code == 200
    assert list_after_delete_response.json() == []


def test_cannot_delete_wealth_account_with_snapshots(client):
    account_response = client.post(
        "/api/wealth/accounts",
        json={
            "name": "Emergency Fund",
            "account_type": "savings_account",
            "currency": "EUR",
        },
    )
    account_id = account_response.json()["id"]

    snapshot_response = client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-01-31",
            "account_id": account_id,
            "balance": "2150.00",
            "currency": "EUR",
        },
    )
    assert snapshot_response.status_code == 201

    delete_response = client.delete(f"/api/wealth/accounts/{account_id}")
    assert delete_response.status_code == 400
    assert delete_response.json()["detail"] == "Cannot delete a wealth account with snapshots"
