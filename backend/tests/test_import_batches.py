from datetime import date
from decimal import Decimal

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.models.import_batch import ImportBatch
from app.models.investment_event import InvestmentEvent
from app.models.owed_item import OwedItem
from app.models.transaction import Transaction
from app.models.wealth_account import WealthAccount
from app.models.wealth_snapshot import WealthSnapshot


def create_import_batch(
    db_session,
    *,
    source="revolut",
    filename="test.csv",
    rows_total=2,
    rows_inserted=2,
    rows_skipped=0,
    status="success",
    user_id=LOCAL_DEFAULT_USER_ID,
):
    import_batch = ImportBatch(
        user_id=user_id,
        source=source,
        filename=filename,
        rows_total=rows_total,
        rows_inserted=rows_inserted,
        rows_skipped=rows_skipped,
        status=status,
    )

    db_session.add(import_batch)
    db_session.commit()
    db_session.refresh(import_batch)

    return import_batch


def create_transaction(
    db_session,
    *,
    import_batch_id,
    transaction_date,
    description,
    amount,
    user_id=LOCAL_DEFAULT_USER_ID,
):
    transaction = Transaction(
        user_id=user_id,
        date=transaction_date,
        description=description,
        raw_description=description,
        amount=Decimal(amount),
        direction="out",
        source="revolut",
        account="Test account",
        category=None,
        currency="EUR",
        import_batch_id=import_batch_id,
    )

    db_session.add(transaction)
    db_session.commit()
    db_session.refresh(transaction)

    return transaction


def test_list_import_batches_returns_newest_first(client, db_session):
    older_batch = create_import_batch(
        db_session,
        source="revolut",
        filename="older.csv",
        rows_total=2,
        rows_inserted=2,
        rows_skipped=0,
        status="success",
    )
    newer_batch = create_import_batch(
        db_session,
        source="activobank",
        filename="newer.xlsx",
        rows_total=10,
        rows_inserted=8,
        rows_skipped=2,
        status="partial",
    )

    response = client.get("/api/import/batches?limit=10")

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 2
    assert data[0]["id"] == newer_batch.id
    assert data[0]["source"] == "activobank"
    assert data[0]["filename"] == "newer.xlsx"
    assert data[0]["rows_total"] == 10
    assert data[0]["rows_inserted"] == 8
    assert data[0]["rows_skipped"] == 2
    assert data[0]["status"] == "partial"

    assert data[1]["id"] == older_batch.id
    assert data[1]["source"] == "revolut"


def test_get_import_batch_by_id(client, db_session):
    import_batch = create_import_batch(
        db_session,
        source="trading212",
        filename="trading212.csv",
        rows_total=5,
        rows_inserted=5,
        rows_skipped=0,
        status="success",
    )

    response = client.get(f"/api/import/batches/{import_batch.id}")

    assert response.status_code == 200

    data = response.json()

    assert data["id"] == import_batch.id
    assert data["source"] == "trading212"
    assert data["filename"] == "trading212.csv"
    assert data["rows_total"] == 5
    assert data["rows_inserted"] == 5
    assert data["rows_skipped"] == 0
    assert data["status"] == "success"


def test_get_import_batch_returns_404_when_missing(client):
    response = client.get("/api/import/batches/999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Import batch not found"


def test_list_import_batch_transactions(client, db_session):
    import_batch = create_import_batch(db_session)
    other_batch = create_import_batch(
        db_session,
        filename="other.csv",
    )

    newer_transaction = create_transaction(
        db_session,
        import_batch_id=import_batch.id,
        transaction_date=date(2026, 5, 2),
        description="Newer transaction",
        amount="20.00",
    )
    older_transaction = create_transaction(
        db_session,
        import_batch_id=import_batch.id,
        transaction_date=date(2026, 5, 1),
        description="Older transaction",
        amount="10.00",
    )
    create_transaction(
        db_session,
        import_batch_id=other_batch.id,
        transaction_date=date(2026, 5, 3),
        description="Other batch transaction",
        amount="30.00",
    )

    response = client.get(f"/api/import/batches/{import_batch.id}/transactions")

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 2
    assert data[0]["id"] == newer_transaction.id
    assert data[0]["description"] == "Newer transaction"
    assert data[1]["id"] == older_transaction.id
    assert data[1]["description"] == "Older transaction"


def test_list_import_batch_transactions_returns_404_when_batch_missing(client):
    response = client.get("/api/import/batches/999/transactions")

    assert response.status_code == 404
    assert response.json()["detail"] == "Import batch not found"

def test_delete_import_batch_deletes_batch_and_its_transactions(client, db_session):
    import_batch = create_import_batch(db_session)
    other_batch = create_import_batch(
        db_session,
        filename="other.csv",
    )

    transaction_to_delete = create_transaction(
        db_session,
        import_batch_id=import_batch.id,
        transaction_date=date(2026, 5, 1),
        description="Imported transaction",
        amount="10.00",
    )
    transaction_to_keep = create_transaction(
        db_session,
        import_batch_id=other_batch.id,
        transaction_date=date(2026, 5, 2),
        description="Other batch transaction",
        amount="20.00",
    )

    import_batch_id = import_batch.id
    other_batch_id = other_batch.id
    transaction_to_delete_id = transaction_to_delete.id
    transaction_to_keep_id = transaction_to_keep.id

    response = client.delete(f"/api/import/batches/{import_batch_id}")

    assert response.status_code == 200

    data = response.json()

    assert data["import_batch_id"] == import_batch_id
    assert data["deleted_transactions"] == 1
    assert data["status"] == "deleted"

    assert db_session.get(ImportBatch, import_batch_id) is None
    assert db_session.get(Transaction, transaction_to_delete_id) is None
    assert db_session.get(ImportBatch, other_batch_id) is not None
    assert db_session.get(Transaction, transaction_to_keep_id) is not None


def test_delete_import_batch_returns_404_when_missing(client):
    response = client.delete("/api/import/batches/999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Import batch not found"



def test_import_batches_are_isolated_by_current_user(client, db_session):
    first_batch = create_import_batch(
        db_session,
        filename="first-user.csv",
        user_id="local-default-user",
    )
    second_batch = create_import_batch(
        db_session,
        filename="second-user.csv",
        user_id="other-user",
    )

    first_transaction = create_transaction(
        db_session,
        import_batch_id=first_batch.id,
        transaction_date=date(2026, 6, 1),
        description="First user transaction",
        amount="10.00",
        user_id="local-default-user",
    )
    create_transaction(
        db_session,
        import_batch_id=second_batch.id,
        transaction_date=date(2026, 6, 1),
        description="Second user transaction",
        amount="20.00",
        user_id="other-user",
    )

    list_response = client.get("/api/import/batches?limit=10")

    assert list_response.status_code == 200
    data = list_response.json()
    assert [batch["id"] for batch in data] == [first_batch.id]

    missing_response = client.get(f"/api/import/batches/{second_batch.id}")
    assert missing_response.status_code == 404

    transactions_response = client.get(
        f"/api/import/batches/{first_batch.id}/transactions"
    )
    assert transactions_response.status_code == 200
    transactions = transactions_response.json()
    assert [transaction["id"] for transaction in transactions] == [first_transaction.id]

    delete_response = client.delete(f"/api/import/batches/{second_batch.id}")
    assert delete_response.status_code == 404



def test_delete_import_batch_response_includes_source_filename_and_total(
    client,
    db_session,
):
    import_batch = create_import_batch(
        db_session,
        source="revolut",
        filename="rollback.csv",
    )

    create_transaction(
        db_session,
        import_batch_id=import_batch.id,
        transaction_date=date(2026, 5, 1),
        description="Imported transaction",
        amount="10.00",
    )

    response = client.delete(f"/api/import/batches/{import_batch.id}")

    assert response.status_code == 200

    data = response.json()

    assert data["import_batch_id"] == import_batch.id
    assert data["source"] == "revolut"
    assert data["filename"] == "rollback.csv"
    assert data["deleted_transactions"] == 1
    assert data["deleted_investment_events"] == 0
    assert data["deleted_owed_items"] == 0
    assert data["deleted_wealth_snapshots"] == 0
    assert data["deleted_total"] == 1
    assert data["status"] == "deleted"


def test_delete_import_batch_deletes_all_supported_imported_record_types(
    client,
    db_session,
):
    import_batch = create_import_batch(
        db_session,
        source="mixed_test",
        filename="mixed.csv",
    )

    transaction = create_transaction(
        db_session,
        import_batch_id=import_batch.id,
        transaction_date=date(2026, 5, 1),
        description="Imported transaction",
        amount="10.00",
    )

    investment_event = InvestmentEvent(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 5, 2),
        source="trading212",
        event_type="buy",
        description="Imported investment",
        raw_description="Imported investment raw",
        amount=Decimal("20.00"),
        currency="EUR",
        import_batch_id=import_batch.id,
        dedupe_hash="imported-investment-event",
    )
    db_session.add(investment_event)

    owed_item = OwedItem(
        user_id=LOCAL_DEFAULT_USER_ID,
        person="Mother",
        amount_total=Decimal("5.00"),
        amount_paid=Decimal("0.00"),
        amount_remaining=Decimal("5.00"),
        reason="Imported owed item",
        status="open",
        source="legacy_excel",
        import_batch_id=import_batch.id,
        dedupe_hash="imported-owed-item",
    )
    db_session.add(owed_item)

    wealth_account = WealthAccount(
        user_id=LOCAL_DEFAULT_USER_ID,
        name="Imported account",
        account_type="bank",
        currency="EUR",
    )
    db_session.add(wealth_account)
    db_session.flush()

    wealth_snapshot = WealthSnapshot(
        user_id=LOCAL_DEFAULT_USER_ID,
        snapshot_date=date(2026, 5, 3),
        account_id=wealth_account.id,
        balance=Decimal("100.00"),
        currency="EUR",
        balance_eur=Decimal("100.00"),
        fx_rate_to_eur=Decimal("1.00000000"),
        source="legacy_excel_wealth",
        import_batch_id=import_batch.id,
        dedupe_hash="imported-wealth-snapshot",
    )
    db_session.add(wealth_snapshot)
    db_session.commit()

    import_batch_id = import_batch.id
    transaction_id = transaction.id
    investment_event_id = investment_event.id
    owed_item_id = owed_item.id
    wealth_snapshot_id = wealth_snapshot.id
    wealth_account_id = wealth_account.id

    response = client.delete(f"/api/import/batches/{import_batch_id}")

    assert response.status_code == 200

    data = response.json()

    assert data["deleted_transactions"] == 1
    assert data["deleted_investment_events"] == 1
    assert data["deleted_owed_items"] == 1
    assert data["deleted_wealth_snapshots"] == 1
    assert data["deleted_total"] == 4
    assert data["status"] == "deleted"

    assert db_session.get(ImportBatch, import_batch_id) is None
    assert db_session.get(Transaction, transaction_id) is None
    assert db_session.get(InvestmentEvent, investment_event_id) is None
    assert db_session.get(OwedItem, owed_item_id) is None
    assert db_session.get(WealthSnapshot, wealth_snapshot_id) is None
    assert db_session.get(WealthAccount, wealth_account_id) is not None


def test_delete_import_batch_preserves_manual_and_other_batch_records(
    client,
    db_session,
):
    import_batch = create_import_batch(
        db_session,
        source="revolut",
        filename="delete-me.csv",
    )
    other_batch = create_import_batch(
        db_session,
        source="revolut",
        filename="keep-me.csv",
    )

    imported_transaction = create_transaction(
        db_session,
        import_batch_id=import_batch.id,
        transaction_date=date(2026, 5, 1),
        description="Imported transaction",
        amount="10.00",
    )
    other_batch_transaction = create_transaction(
        db_session,
        import_batch_id=other_batch.id,
        transaction_date=date(2026, 5, 2),
        description="Other batch transaction",
        amount="20.00",
    )
    manual_transaction = create_transaction(
        db_session,
        import_batch_id=None,
        transaction_date=date(2026, 5, 3),
        description="Manual transaction",
        amount="30.00",
    )

    import_batch_id = import_batch.id
    other_batch_id = other_batch.id
    imported_transaction_id = imported_transaction.id
    other_batch_transaction_id = other_batch_transaction.id
    manual_transaction_id = manual_transaction.id

    response = client.delete(f"/api/import/batches/{import_batch_id}")

    assert response.status_code == 200
    assert response.json()["deleted_transactions"] == 1

    assert db_session.get(Transaction, imported_transaction_id) is None
    assert db_session.get(Transaction, other_batch_transaction_id) is not None
    assert db_session.get(Transaction, manual_transaction_id) is not None
    assert db_session.get(ImportBatch, other_batch_id) is not None

