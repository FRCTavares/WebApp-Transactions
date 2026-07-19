import pytest

from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.owed_repository import OwedRepository
from app.repositories.transaction_repository import TransactionRepository
from app.repositories.wealth_repository import WealthRepository
from app.services.legacy_excel_import_service import LegacyExcelImportService
from app.auth.current_user import (
    LOCAL_DEFAULT_USER_ID,
    CurrentUser,
    get_current_user,
)
from app.models.import_batch import ImportBatch
from app.models.owed_item import OwedItem
from app.models.transaction import Transaction
from tests.test_legacy_excel_importer import build_workbook_bytes

LOCAL_CURRENT_USER = CurrentUser(id=LOCAL_DEFAULT_USER_ID)



def test_legacy_excel_commit_inserts_transactions_and_owed_items(client, db_session):
    response = client.post(
        "/api/legacy-excel-import/commit",
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
    assert data["rows_total"] == 9
    assert data["rows_inserted"] == 9
    assert data["rows_skipped"] == 0
    assert data["transactions_inserted"] == 6
    assert data["owed_items_inserted"] == 3
    assert data["status"] == "success"

    import_batch = db_session.get(ImportBatch, data["import_batch_id"])
    assert import_batch is not None
    assert import_batch.source == "legacy_excel"

    transactions = db_session.query(Transaction).all()
    owed_items = db_session.query(OwedItem).all()

    assert len(transactions) == 6
    assert len(owed_items) == 3
    assert all(transaction.import_batch_id == import_batch.id for transaction in transactions)
    assert all(owed_item.import_batch_id == import_batch.id for owed_item in owed_items)
    assert all(owed_item.source == "legacy_excel" for owed_item in owed_items)
    assert all(owed_item.dedupe_hash for owed_item in owed_items)


def test_legacy_excel_commit_skips_duplicates_on_second_import(client, db_session):
    workbook_content = build_workbook_bytes()

    first_response = client.post(
        "/api/legacy-excel-import/commit",
        files={
            "file": (
                "legacy_finance.xlsx",
                workbook_content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    second_response = client.post(
        "/api/legacy-excel-import/commit",
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

    assert second_data["rows_total"] == 9
    assert second_data["rows_inserted"] == 0
    assert second_data["rows_skipped"] == 9
    assert second_data["transactions_inserted"] == 0
    assert second_data["owed_items_inserted"] == 0
    assert second_data["duplicate_transactions_skipped"] == 6
    assert second_data["duplicate_owed_items_skipped"] == 3
    assert second_data["import_batch_id"] == 0
    assert second_data["status"] == "skipped"

    assert db_session.query(Transaction).count() == 6
    assert db_session.query(OwedItem).count() == 3


def test_delete_legacy_excel_import_batch_deletes_transactions_and_owed_items(
    client,
    db_session,
):
    commit_response = client.post(
        "/api/legacy-excel-import/commit",
        files={
            "file": (
                "legacy_finance.xlsx",
                build_workbook_bytes(),
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
    assert data["deleted_transactions"] == 6
    assert data["deleted_owed_items"] == 3
    assert data["status"] == "deleted"

    assert db_session.get(ImportBatch, import_batch_id) is None
    assert db_session.query(Transaction).count() == 0
    assert db_session.query(OwedItem).count() == 0


def test_legacy_excel_import_is_scoped_to_authenticated_user(
    client,
    db_session,
):
    workbook_content = build_workbook_bytes()
    first_user = CurrentUser(id="user-one", email="one@example.com")
    second_user = CurrentUser(id="user-two", email="two@example.com")

    client.app.dependency_overrides[get_current_user] = lambda: first_user

    first_response = client.post(
        "/api/legacy-excel-import/commit",
        files={
            "file": (
                "legacy_finance.xlsx",
                workbook_content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert first_response.status_code == 200
    assert first_response.json()["rows_inserted"] == 9

    first_user_transactions = (
        db_session.query(Transaction)
        .filter(Transaction.user_id == first_user.id)
        .all()
    )
    first_user_owed_items = (
        db_session.query(OwedItem)
        .filter(OwedItem.user_id == first_user.id)
        .all()
    )
    first_user_batches = (
        db_session.query(ImportBatch)
        .filter(ImportBatch.user_id == first_user.id)
        .all()
    )

    assert len(first_user_transactions) == 6
    assert len(first_user_owed_items) == 3
    assert len(first_user_batches) == 1

    client.app.dependency_overrides[get_current_user] = lambda: second_user

    second_user_list_response = client.get("/api/transactions")

    assert second_user_list_response.status_code == 200
    assert second_user_list_response.json() == []

    second_response = client.post(
        "/api/legacy-excel-import/commit",
        files={
            "file": (
                "legacy_finance.xlsx",
                workbook_content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert second_response.status_code == 200
    assert second_response.json()["rows_inserted"] == 9

    second_user_transactions = (
        db_session.query(Transaction)
        .filter(Transaction.user_id == second_user.id)
        .all()
    )
    second_user_owed_items = (
        db_session.query(OwedItem)
        .filter(OwedItem.user_id == second_user.id)
        .all()
    )
    second_user_batches = (
        db_session.query(ImportBatch)
        .filter(ImportBatch.user_id == second_user.id)
        .all()
    )

    assert len(second_user_transactions) == 6
    assert len(second_user_owed_items) == 3
    assert len(second_user_batches) == 1

    assert (
        db_session.query(Transaction)
        .filter(Transaction.user_id == LOCAL_DEFAULT_USER_ID)
        .count()
        == 0
    )
    assert (
        db_session.query(OwedItem)
        .filter(OwedItem.user_id == LOCAL_DEFAULT_USER_ID)
        .count()
        == 0
    )
    assert (
        db_session.query(ImportBatch)
        .filter(ImportBatch.user_id == LOCAL_DEFAULT_USER_ID)
        .count()
        == 0
    )


def test_legacy_excel_commit_rolls_back_all_records_on_owed_failure(
    db_session,
    monkeypatch,
):
    transaction_repository = TransactionRepository(db_session)
    owed_repository = OwedRepository(db_session)
    import_batch_repository = ImportBatchRepository(db_session)
    service = LegacyExcelImportService(
        transaction_repository=transaction_repository,
        owed_repository=owed_repository,
        import_batch_repository=import_batch_repository,
        wealth_repository=WealthRepository(db_session),
    )

    original_bulk_insert = owed_repository.bulk_insert

    def fail_after_owed_flush(
        owed_items,
        user_id,
        commit=True,
    ):
        original_bulk_insert(
            owed_items,
            user_id=user_id,
            commit=commit,
        )
        raise RuntimeError("forced failure after owed item flush")

    monkeypatch.setattr(
        owed_repository,
        "bulk_insert",
        fail_after_owed_flush,
    )

    with pytest.raises(
        RuntimeError,
        match="forced failure after owed item flush",
    ):
        service.commit_import_from_file(
            file_content=build_workbook_bytes(),
            filename="legacy_rollback.xlsx",
            current_user=LOCAL_CURRENT_USER,
        )

    assert db_session.query(ImportBatch).count() == 0
    assert db_session.query(Transaction).count() == 0
    assert db_session.query(OwedItem).count() == 0
