from fastapi.testclient import TestClient

from app.main import app
from tests.test_legacy_excel_importer import build_workbook_bytes


def test_legacy_excel_preview_endpoint_returns_transactions_and_owed_items():
    client = TestClient(app)

    response = client.post(
        "/api/legacy-excel-import/preview",
        files={
            "file": (
                "legacy_finance.xlsx",
                build_workbook_bytes(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["source"] == "legacy_excel"
    assert data["filename"] == "legacy_finance.xlsx"
    assert data["rows_invalid"] == 0
    assert len(data["transactions"]) == 6
    assert len(data["owed_items"]) == 3
    assert data["summary"]["transaction_count"] == 6
    assert data["summary"]["owed_item_count"] == 3
    assert data["summary"]["money_in_total"] == "665.00"
    assert data["summary"]["money_out_total"] == "63.77"

    first_transaction = data["transactions"][0]
    assert first_transaction["source"] == "legacy_excel"
    assert first_transaction["account"] == "manual_history"
    assert first_transaction["currency"] == "EUR"
    assert first_transaction["dedupe_hash"]
    assert first_transaction["is_duplicate"] is False


def test_legacy_excel_preview_marks_duplicate_transactions_inside_file():
    client = TestClient(app)
    workbook_content = build_workbook_bytes()

    response = client.post(
        "/api/legacy-excel-import/preview",
        files={
            "file": (
                "legacy_finance.xlsx",
                workbook_content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 200

    data = response.json()

    duplicate_count = sum(
        1
        for transaction in data["transactions"]
        if transaction["is_duplicate"]
    )

    assert duplicate_count == 0
