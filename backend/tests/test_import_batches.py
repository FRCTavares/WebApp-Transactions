from app.models.import_batch import ImportBatch


def test_list_import_batches_returns_newest_first(client, db_session):
    older_batch = ImportBatch(
        source="revolut",
        filename="older.csv",
        rows_total=2,
        rows_inserted=2,
        rows_skipped=0,
        status="success",
    )
    newer_batch = ImportBatch(
        source="activobank",
        filename="newer.xlsx",
        rows_total=10,
        rows_inserted=8,
        rows_skipped=2,
        status="partial",
    )

    db_session.add_all([older_batch, newer_batch])
    db_session.commit()

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
    import_batch = ImportBatch(
        source="trading212",
        filename="trading212.csv",
        rows_total=5,
        rows_inserted=5,
        rows_skipped=0,
        status="success",
    )

    db_session.add(import_batch)
    db_session.commit()

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
