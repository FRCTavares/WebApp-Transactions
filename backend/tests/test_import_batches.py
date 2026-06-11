from datetime import date
from decimal import Decimal

from app.models.import_batch import ImportBatch
from app.models.transaction import Transaction


def create_import_batch(
    db_session,
    *,
    source="revolut",
    filename="test.csv",
    rows_total=2,
    rows_inserted=2,
    rows_skipped=0,
    status="success",
):
    import_batch = ImportBatch(
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
):
    transaction = Transaction(
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

