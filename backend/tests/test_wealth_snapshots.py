from datetime import date
from decimal import Decimal

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.models.wealth_account import WealthAccount
from app.models.wealth_snapshot import WealthSnapshot

def create_account(client, name="ActivoBank Savings", account_type="savings_account"):
    response = client.post(
        "/api/wealth/accounts",
        json={
            "name": name,
            "account_type": account_type,
            "currency": "EUR",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_create_list_update_delete_wealth_snapshot(client):
    account = create_account(client)

    create_response = client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-01-31",
            "account_id": account["id"],
            "balance": "2150.00",
            "currency": "EUR",
            "interest_earned": "3.40",
            "notes": "January snapshot",
        },
    )

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["id"] > 0
    assert created["account_id"] == account["id"]
    assert created["balance"] == "2150.00"
    assert created["balance_eur"] == "2150.00"
    assert created["fx_rate_to_eur"] == "1.00000000"
    assert created["interest_earned"] == "3.40"

    list_response = client.get("/api/wealth/snapshots")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    get_response = client.get(f"/api/wealth/snapshots/{created['id']}")
    assert get_response.status_code == 200
    assert get_response.json()["notes"] == "January snapshot"

    update_response = client.patch(
        f"/api/wealth/snapshots/{created['id']}",
        json={
            "balance": "2200.00",
            "interest_earned": "4.00",
        },
    )

    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["balance"] == "2200.00"
    assert updated["balance_eur"] == "2200.00"
    assert updated["interest_earned"] == "4.00"

    delete_response = client.delete(f"/api/wealth/snapshots/{created['id']}")
    assert delete_response.status_code == 204

    list_after_delete_response = client.get("/api/wealth/snapshots")
    assert list_after_delete_response.status_code == 200
    assert list_after_delete_response.json() == []


def test_reject_snapshot_for_missing_account(client):
    response = client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-01-31",
            "account_id": 999,
            "balance": "2150.00",
            "currency": "EUR",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Wealth account not found"


def test_reject_non_eur_snapshot_without_fx_rate(client):
    account = create_account(client, name="USD Cash", account_type="cash")

    response = client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-01-31",
            "account_id": account["id"],
            "balance": "100.00",
            "currency": "USD",
        },
    )

    assert response.status_code == 422


def test_summary_returns_latest_total(client):
    savings = create_account(client, name="ActivoBank Savings")
    portfolio = create_account(client, name="Trading 212 Portfolio", account_type="brokerage")

    client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-01-31",
            "account_id": savings["id"],
            "balance": "2150.00",
            "currency": "EUR",
            "interest_earned": "3.40",
        },
    )
    client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-02-28",
            "account_id": savings["id"],
            "balance": "2200.00",
            "currency": "EUR",
            "interest_earned": "4.00",
        },
    )
    client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-02-28",
            "account_id": portfolio["id"],
            "balance": "3200.00",
            "currency": "EUR",
        },
    )

    response = client.get("/api/wealth/summary")

    assert response.status_code == 200
    summary = response.json()
    assert summary["current_total_wealth_eur"] == "5400.00"
    assert summary["account_count"] == 2
    assert summary["latest_snapshot_date"] == "2026-02-28"
    assert summary["total_interest_earned"] == "7.40"


def test_monthly_endpoint_groups_latest_snapshot_per_account_per_month(client):
    savings = create_account(client, name="ActivoBank Savings")
    portfolio = create_account(client, name="Trading 212 Portfolio", account_type="brokerage")

    client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-01-15",
            "account_id": savings["id"],
            "balance": "2000.00",
            "currency": "EUR",
        },
    )
    client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-01-31",
            "account_id": savings["id"],
            "balance": "2150.00",
            "currency": "EUR",
        },
    )
    client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-01-31",
            "account_id": portfolio["id"],
            "balance": "3000.00",
            "currency": "EUR",
        },
    )
    client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-02-28",
            "account_id": savings["id"],
            "balance": "2200.00",
            "currency": "EUR",
        },
    )

    response = client.get("/api/wealth/monthly")

    assert response.status_code == 200
    rows = response.json()

    assert rows == [
        {
            "month": "2026-01",
            "total_wealth_eur": "5150.00",
        },
        {
            "month": "2026-02",
            "total_wealth_eur": "5200.00",
        },
    ]


def test_wealth_monthly_totals_carry_forward_latest_account_balances(client):
    account_a = client.post(
        "/api/wealth/accounts",
        json={
            "name": "Current Account",
            "account_type": "current_account",
            "currency": "EUR",
            "institution": "Bank",
            "is_active": True,
            "notes": None,
        },
    ).json()
    account_b = client.post(
        "/api/wealth/accounts",
        json={
            "name": "Cash",
            "account_type": "cash",
            "currency": "EUR",
            "institution": None,
            "is_active": True,
            "notes": None,
        },
    ).json()

    client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-04-30",
            "account_id": account_a["id"],
            "balance": "100.00",
            "currency": "EUR",
            "interest_earned": "0.00",
            "notes": None,
        },
    )
    client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-04-30",
            "account_id": account_b["id"],
            "balance": "50.00",
            "currency": "EUR",
            "interest_earned": "0.00",
            "notes": None,
        },
    )
    client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-05-31",
            "account_id": account_a["id"],
            "balance": "120.00",
            "currency": "EUR",
            "interest_earned": "0.00",
            "notes": None,
        },
    )

    response = client.get("/api/wealth/monthly")

    assert response.status_code == 200
    assert response.json() == [
        {"month": "2026-04", "total_wealth_eur": "150.00"},
        {"month": "2026-05", "total_wealth_eur": "170.00"},
    ]


def test_wealth_snapshots_and_summary_are_isolated_by_current_user(client, db_session):
    current_account = WealthAccount(
        user_id=LOCAL_DEFAULT_USER_ID,
        name="Current User Savings",
        account_type="savings_account",
        currency="EUR",
    )
    other_account = WealthAccount(
        user_id="other-user",
        name="Other User Savings",
        account_type="savings_account",
        currency="EUR",
    )
    db_session.add_all([current_account, other_account])
    db_session.commit()
    db_session.refresh(current_account)
    db_session.refresh(other_account)

    db_session.add(
        WealthSnapshot(
            user_id=LOCAL_DEFAULT_USER_ID,
            snapshot_date=date(2026, 1, 31),
            account_id=current_account.id,
            balance=Decimal("100.00"),
            currency="EUR",
            balance_eur=Decimal("100.00"),
            fx_rate_to_eur=Decimal("1"),
        )
    )
    db_session.add(
        WealthSnapshot(
            user_id="other-user",
            snapshot_date=date(2026, 1, 31),
            account_id=other_account.id,
            balance=Decimal("900.00"),
            currency="EUR",
            balance_eur=Decimal("900.00"),
            fx_rate_to_eur=Decimal("1"),
        )
    )
    db_session.commit()

    snapshots_response = client.get("/api/wealth/snapshots")

    assert snapshots_response.status_code == 200
    snapshots = snapshots_response.json()

    assert len(snapshots) == 1
    assert snapshots[0]["account_id"] == current_account.id

    summary_response = client.get("/api/wealth/summary")

    assert summary_response.status_code == 200
    summary = summary_response.json()

    assert summary["current_total_wealth_eur"] == "100.00"
    assert summary["account_count"] == 1
