from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient

from app.main import app
from app.database import get_db
from app.models.cashflow_rule import CashflowRule
from app.models.description_rule import DescriptionRule
from app.models.import_batch import ImportBatch
from app.models.investment_event import InvestmentEvent
from app.models.owed_item import OwedItem
from app.models.owed_payment import OwedPayment, OwedPaymentAllocation
from app.models.transaction import Transaction
from app.models.wealth_account import WealthAccount
from app.models.wealth_snapshot import WealthSnapshot


def get_test_client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    return TestClient(app)


def clear_test_client_overrides() -> None:
    app.dependency_overrides.clear()



def add_export_fixture_rows(db_session, user_id: str) -> None:
    import_batch = ImportBatch(
        user_id=user_id,
        source="test",
        filename=f"{user_id}.csv",
        rows_total=1,
        rows_inserted=1,
        rows_skipped=0,
        status="success",
    )
    db_session.add(import_batch)
    db_session.flush()

    transaction = Transaction(
        user_id=user_id,
        date=date(2026, 6, 1),
        description=f"{user_id} transaction",
        raw_description=f"{user_id} raw transaction",
        amount=Decimal("12.34"),
        direction="out",
        cashflow_type="expense",
        source="manual",
        currency="EUR",
        import_batch_id=import_batch.id,
        dedupe_hash=f"{user_id}-transaction",
    )
    db_session.add(transaction)
    db_session.flush()

    owed_item = OwedItem(
        user_id=user_id,
        person="Mother",
        amount_total=Decimal("10.00"),
        amount_paid=Decimal("0.00"),
        amount_remaining=Decimal("10.00"),
        reason=f"{user_id} owed",
        status="open",
        linked_transaction_id=transaction.id,
        source="manual",
        dedupe_hash=f"{user_id}-owed-item",
    )
    db_session.add(owed_item)
    db_session.flush()

    owed_payment = OwedPayment(
        user_id=user_id,
        person="Mother",
        payment_date=date(2026, 6, 2),
        amount=Decimal("5.00"),
        currency="EUR",
        method="cash",
    )
    db_session.add(owed_payment)
    db_session.flush()

    db_session.add(
        OwedPaymentAllocation(
            user_id=user_id,
            owed_payment_id=owed_payment.id,
            owed_item_id=owed_item.id,
            amount=Decimal("5.00"),
        )
    )

    wealth_account = WealthAccount(
        user_id=user_id,
        name=f"{user_id} account",
        account_type="bank",
        currency="EUR",
        institution="Test Bank",
    )
    db_session.add(wealth_account)
    db_session.flush()

    db_session.add(
        WealthSnapshot(
            user_id=user_id,
            snapshot_date=date(2026, 6, 1),
            account_id=wealth_account.id,
            balance=Decimal("100.00"),
            currency="EUR",
            balance_eur=Decimal("100.00"),
            fx_rate_to_eur=Decimal("1.00000000"),
            source="manual",
            dedupe_hash=f"{user_id}-wealth-snapshot",
        )
    )

    db_session.add(
        InvestmentEvent(
            user_id=user_id,
            date=date(2026, 6, 3),
            source="manual",
            event_type="buy",
            description=f"{user_id} investment",
            raw_description=f"{user_id} raw investment",
            amount=Decimal("20.00"),
            currency="EUR",
            dedupe_hash=f"{user_id}-investment",
        )
    )


    db_session.add(
        CashflowRule(
            user_id=user_id,
            name=f"{user_id} cashflow rule",
            cashflow_type="expense",
            match_text=user_id,
            match_field="raw_description",
        )
    )

    db_session.add(
        DescriptionRule(
            user_id=user_id,
            name=f"{user_id} description rule",
            cleaned_description="Cleaned",
            match_text=user_id,
            match_field="raw_description",
        )
    )

    db_session.commit()


def test_export_json_returns_current_user_data_only(db_session, monkeypatch):
    monkeypatch.delenv("APP_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
    monkeypatch.delenv("ALLOWED_USER_EMAILS", raising=False)

    add_export_fixture_rows(db_session, "local-default-user")
    add_export_fixture_rows(db_session, "other-user")

    try:
        with get_test_client(db_session) as client:
            response = client.get("/api/export/json")
    finally:
        clear_test_client_overrides()

    assert response.status_code == 200

    body = response.json()
    tables = body["tables"]

    assert body["format_version"] == 1
    assert body["user_id"] == "local-default-user"
    assert body["email"] is None

    expected_tables = {
        "transactions",
        "owed_items",
        "owed_payments",
        "owed_payment_allocations",
        "wealth_accounts",
        "wealth_snapshots",
        "investment_events",
        "import_batches",
        "cashflow_rules",
        "description_rules",
    }

    assert set(tables) == expected_tables

    for table_rows in tables.values():
        assert len(table_rows) == 1
        assert table_rows[0]["user_id"] == "local-default-user"

    assert tables["transactions"][0]["amount"] == "12.34"
    assert tables["transactions"][0]["date"] == "2026-06-01"
    assert tables["transactions"][0]["raw_description"] == (
        "local-default-user raw transaction"
    )


def test_export_json_uses_header_bridge_user_when_allowlist_enabled(
    db_session,
    monkeypatch,
):
    monkeypatch.delenv("APP_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    add_export_fixture_rows(db_session, "me@example.com")
    add_export_fixture_rows(db_session, "other@example.com")

    try:
        with get_test_client(db_session) as client:
            response = client.get(
                "/api/export/json",
                headers={"X-App-User-Email": "ME@example.com"},
            )
    finally:
        clear_test_client_overrides()

    assert response.status_code == 200

    body = response.json()

    assert body["user_id"] == "me@example.com"
    assert body["email"] == "me@example.com"

    for table_rows in body["tables"].values():
        assert len(table_rows) == 1
        assert table_rows[0]["user_id"] == "me@example.com"


def test_export_json_requires_auth_when_supabase_auth_is_enabled(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
    monkeypatch.delenv("APP_ACCESS_TOKEN", raising=False)
    monkeypatch.setenv("ALLOWED_USER_EMAILS", "me@example.com")

    with TestClient(app) as client:
        response = client.get("/api/export/json")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing bearer token"}
