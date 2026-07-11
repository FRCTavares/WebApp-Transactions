from io import BytesIO
from decimal import Decimal

import pytest

from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.owed_repository import OwedRepository
from app.repositories.transaction_repository import TransactionRepository
from app.repositories.wealth_repository import WealthRepository
from app.services.legacy_excel_import_service import LegacyExcelImportService
from openpyxl import Workbook

from app.importers.legacy_excel import LegacyExcelImporter
from app.models.import_batch import ImportBatch
from app.models.wealth_account import WealthAccount
from app.models.wealth_snapshot import WealthSnapshot


def build_wealth_workbook_bytes() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Painel Central"

    sheet["F10"] = "Conta"
    sheet["G10"] = "Setembro 24"
    sheet["H10"] = "Outubro 24"
    sheet["I10"] = "Maio 26"
    sheet["J10"] = "Junho 26"

    sheet["F11"] = "ActivoBank"
    sheet["G11"] = 1000
    sheet["H11"] = 1100
    sheet["I11"] = 5657.21
    sheet["J11"] = 6000

    sheet["F12"] = "Revolut"
    sheet["G12"] = 50
    sheet["H12"] = 60
    sheet["I12"] = 52

    sheet["F13"] = "Trading 212"
    sheet["G13"] = 500
    sheet["H13"] = 600
    sheet["I13"] = 1447.27

    sheet["F14"] = "Bank Notes"
    sheet["G14"] = 20
    sheet["H14"] = 20
    sheet["I14"] = 20

    sheet["F15"] = "Dívidas Não Pagas"
    sheet["G15"] = 0
    sheet["H15"] = 10
    sheet["I15"] = 141.13

    sheet["F16"] = "Total"
    sheet["G16"] = 1570
    sheet["H16"] = 1790
    sheet["I16"] = 7317.61

    output = BytesIO()
    workbook.save(output)

    return output.getvalue()


def test_legacy_excel_importer_parses_wealth_snapshots_from_painel_central():
    snapshots = LegacyExcelImporter().parse_wealth_snapshots(build_wealth_workbook_bytes())

    assert len(snapshots) == 14
    assert {snapshot.account_name for snapshot in snapshots} == {
        "ActivoBank",
        "Revolut",
        "Trading 212",
        "Bank Notes",
        "Money Owed To Me",
    }
    assert all(snapshot.snapshot_date.isoformat() <= "2026-05-31" for snapshot in snapshots)

    may_activobank = next(
        snapshot
        for snapshot in snapshots
        if snapshot.account_name == "ActivoBank"
        and snapshot.snapshot_date.isoformat() == "2026-05-31"
    )

    assert may_activobank.balance == Decimal("5657.21")
    assert may_activobank.balance_eur == Decimal("5657.21")
    assert may_activobank.account_type == "current_account"


def test_legacy_excel_wealth_preview_endpoint(client):
    response = client.post(
        "/api/legacy-excel-import/wealth-preview",
        files={
            "file": (
                "legacy_finance.xlsx",
                build_wealth_workbook_bytes(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["source"] == "legacy_excel"
    assert data["filename"] == "legacy_finance.xlsx"
    assert data["rows_total"] == 14
    assert data["rows_valid"] == 14
    assert data["rows_duplicates"] == 0
    assert data["summary"]["snapshot_count"] == 14
    assert data["summary"]["account_count"] == 5
    assert data["summary"]["latest_snapshot_date"] == "2026-05-31"

    first_snapshot = data["snapshots"][0]
    assert first_snapshot["account_name"] == "ActivoBank"
    assert first_snapshot["currency"] == "EUR"
    assert first_snapshot["dedupe_hash"]
    assert first_snapshot["is_duplicate"] is False


def test_legacy_excel_wealth_commit_creates_accounts_and_snapshots(client, db_session):
    response = client.post(
        "/api/legacy-excel-import/wealth-commit",
        files={
            "file": (
                "legacy_finance.xlsx",
                build_wealth_workbook_bytes(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["source"] == "legacy_excel"
    assert data["rows_total"] == 14
    assert data["rows_inserted"] == 14
    assert data["rows_skipped"] == 0
    assert data["accounts_created"] == 5
    assert data["snapshots_inserted"] == 14
    assert data["duplicate_snapshots_skipped"] == 0
    assert data["status"] == "success"

    import_batch = db_session.get(ImportBatch, data["import_batch_id"])
    assert import_batch is not None
    assert import_batch.source == "legacy_excel_wealth"

    assert db_session.query(WealthAccount).count() == 5
    assert db_session.query(WealthSnapshot).count() == 14
    assert {
        snapshot.source
        for snapshot in db_session.query(WealthSnapshot).all()
    } == {"legacy_excel_wealth"}


def test_legacy_excel_wealth_commit_skips_duplicates_on_second_import(client, db_session):
    workbook_content = build_wealth_workbook_bytes()

    first_response = client.post(
        "/api/legacy-excel-import/wealth-commit",
        files={
            "file": (
                "legacy_finance.xlsx",
                workbook_content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    second_response = client.post(
        "/api/legacy-excel-import/wealth-commit",
        files={
            "file": (
                "legacy_finance.xlsx",
                workbook_content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200

    second_data = second_response.json()

    assert second_data["rows_total"] == 14
    assert second_data["rows_inserted"] == 0
    assert second_data["rows_skipped"] == 14
    assert second_data["accounts_created"] == 0
    assert second_data["snapshots_inserted"] == 0
    assert second_data["duplicate_snapshots_skipped"] == 14
    assert second_data["import_batch_id"] == 0
    assert second_data["status"] == "skipped"

    assert db_session.query(WealthAccount).count() == 5
    assert db_session.query(WealthSnapshot).count() == 14


def test_delete_legacy_wealth_import_batch_deletes_snapshots(client, db_session):
    commit_response = client.post(
        "/api/legacy-excel-import/wealth-commit",
        files={
            "file": (
                "legacy_finance.xlsx",
                build_wealth_workbook_bytes(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert commit_response.status_code == 200

    import_batch_id = commit_response.json()["import_batch_id"]

    delete_response = client.delete(f"/api/import/batches/{import_batch_id}")

    assert delete_response.status_code == 200

    data = delete_response.json()

    assert data["import_batch_id"] == import_batch_id
    assert data["deleted_transactions"] == 0
    assert data["deleted_owed_items"] == 0
    assert data["deleted_wealth_snapshots"] == 14
    assert data["status"] == "deleted"

    assert db_session.get(ImportBatch, import_batch_id) is None
    assert db_session.query(WealthSnapshot).count() == 0
    assert db_session.query(WealthAccount).count() == 5


def test_legacy_wealth_commit_rolls_back_accounts_batch_and_snapshots(
    db_session,
    monkeypatch,
):
    wealth_repository = WealthRepository(db_session)
    service = LegacyExcelImportService(
        transaction_repository=TransactionRepository(db_session),
        owed_repository=OwedRepository(db_session),
        import_batch_repository=ImportBatchRepository(db_session),
        wealth_repository=wealth_repository,
    )

    original_bulk_insert = wealth_repository.bulk_insert_snapshots

    def fail_after_snapshot_flush(
        snapshots,
        user_id,
        commit=True,
    ):
        original_bulk_insert(
            snapshots,
            user_id=user_id,
            commit=commit,
        )
        raise RuntimeError("forced failure after wealth snapshot flush")

    monkeypatch.setattr(
        wealth_repository,
        "bulk_insert_snapshots",
        fail_after_snapshot_flush,
    )

    with pytest.raises(
        RuntimeError,
        match="forced failure after wealth snapshot flush",
    ):
        service.commit_wealth_import_from_file(
            file_content=build_wealth_workbook_bytes(),
            filename="wealth_rollback.xlsx",
        )

    assert db_session.query(ImportBatch).count() == 0
    assert db_session.query(WealthAccount).count() == 0
    assert db_session.query(WealthSnapshot).count() == 0
