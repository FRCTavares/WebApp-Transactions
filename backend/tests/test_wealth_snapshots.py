from datetime import date
from decimal import Decimal

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.models.investment_event import InvestmentEvent
from app.models.market_price_history import MarketPriceHistory
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
            "investment_value_eur": "0.00",
        },
        {
            "month": "2026-02",
            "total_wealth_eur": "5200.00",
            "investment_value_eur": "0.00",
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
        {
            "month": "2026-04",
            "total_wealth_eur": "150.00",
            "investment_value_eur": "0.00",
        },
        {
            "month": "2026-05",
            "total_wealth_eur": "170.00",
            "investment_value_eur": "0.00",
        },
    ]



def test_wealth_monthly_totals_use_derived_investment_value_not_brokerage_snapshots(
    client,
    db_session,
):
    savings = create_account(client, name="Savings")
    brokerage = create_account(
        client,
        name="Trading 212 CSPX",
        account_type="brokerage",
    )

    client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-06-30",
            "account_id": savings["id"],
            "balance": "1000.00",
            "currency": "EUR",
        },
    )
    client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-06-30",
            "account_id": brokerage["id"],
            "balance": "9999.00",
            "currency": "EUR",
        },
    )

    db_session.add_all(
        [
            InvestmentEvent(
                date=date(2026, 6, 1),
                source="trading212",
                account="Trading 212",
                event_type="market_buy",
                description="Buy CSPX",
                raw_description="Buy CSPX",
                instrument_name="iShares Core S&P 500",
                ticker="CSPX",
                isin="IE00B5BMR087",
                quantity=Decimal("2"),
                price=Decimal("100"),
                amount=Decimal("200"),
                currency="EUR",
                fx_rate_to_eur=Decimal("1"),
            ),
            MarketPriceHistory(
                ticker="CSPX",
                isin="IE00B5BMR087",
                price_date=date(2026, 6, 30),
                close_price=Decimal("120"),
                currency="EUR",
                source="manual",
            ),
        ]
    )
    db_session.commit()

    response = client.get("/api/wealth/monthly")

    assert response.status_code == 200
    assert response.json() == [
        {
            "month": "2026-06",
            "total_wealth_eur": "1240.00",
            "investment_value_eur": "240.00",
        },
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



def test_create_wealth_snapshot_allows_zero_eur_balance(client, db_session):
    account_response = client.post(
        "/api/wealth/accounts",
        json={
            "name": "Zero Account",
            "account_type": "current_account",
            "currency": "EUR",
        },
    )
    assert account_response.status_code == 201

    response = client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-06-01",
            "account_id": account_response.json()["id"],
            "balance": "0.00",
            "currency": "EUR",
        },
    )

    assert response.status_code == 201

    data = response.json()

    assert data["balance"] == "0.00"
    assert data["balance_eur"] == "0.00"
    assert data["fx_rate_to_eur"] == "1.00000000"

def test_reject_duplicate_wealth_snapshot_for_same_account_and_date(client):
    account = create_account(client)

    first_response = client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-06-30",
            "account_id": account["id"],
            "balance": "100.00",
            "currency": "EUR",
        },
    )
    assert first_response.status_code == 201

    duplicate_response = client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-06-30",
            "account_id": account["id"],
            "balance": "200.00",
            "currency": "EUR",
        },
    )

    assert duplicate_response.status_code == 409
    assert duplicate_response.json()["detail"] == (
        "Wealth snapshot already exists for this account and date"
    )


def test_reject_wealth_snapshot_update_that_would_duplicate_account_date(client):
    account = create_account(client)

    first_response = client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-06-30",
            "account_id": account["id"],
            "balance": "100.00",
            "currency": "EUR",
        },
    )
    assert first_response.status_code == 201

    second_response = client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-07-31",
            "account_id": account["id"],
            "balance": "200.00",
            "currency": "EUR",
        },
    )
    assert second_response.status_code == 201

    update_response = client.patch(
        f"/api/wealth/snapshots/{second_response.json()['id']}",
        json={
            "snapshot_date": "2026-06-30",
        },
    )

    assert update_response.status_code == 409
    assert update_response.json()["detail"] == (
        "Wealth snapshot already exists for this account and date"
    )

def test_reject_wealth_snapshot_create_with_inconsistent_balance_eur(client):
    account = create_account(client, name="USD Cash", account_type="cash")

    response = client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-08-31",
            "account_id": account["id"],
            "balance": "100.00",
            "currency": "USD",
            "fx_rate_to_eur": "0.90",
            "balance_eur": "50.00",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "balance_eur must match balance multiplied by fx_rate_to_eur"
    )


def test_reject_wealth_snapshot_update_with_inconsistent_balance_eur(client):
    account = create_account(client)

    create_response = client.post(
        "/api/wealth/snapshots",
        json={
            "snapshot_date": "2026-08-31",
            "account_id": account["id"],
            "balance": "100.00",
            "currency": "EUR",
        },
    )
    assert create_response.status_code == 201

    update_response = client.patch(
        f"/api/wealth/snapshots/{create_response.json()['id']}",
        json={
            "balance_eur": "50.00",
        },
    )

    assert update_response.status_code == 400
    assert update_response.json()["detail"] == (
        "balance_eur must match balance multiplied by fx_rate_to_eur"
    )

