import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.models.import_batch import ImportBatch
from app.models.import_preview import ImportPreview
from app.models.transaction import Transaction
from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.import_preview_repository import ImportPreviewRepository
from app.repositories.transaction_repository import TransactionRepository
from app.services.import_preview_binding_service import (
    ImportPreviewBindingService,
)
from app.services.import_service import ImportService

LOCAL_CURRENT_USER = CurrentUser(id=LOCAL_DEFAULT_USER_ID)


def test_import_commit_inserts_then_skips_duplicates(db_session):
    csv_content = """Completed Date,Description,Amount,Currency
2026-06-09 10:00:00,Salary,1000.00,EUR
2026-06-09 12:00:00,Groceries,-25.50,EUR
"""

    transaction_repository = TransactionRepository(db_session)
    import_batch_repository = ImportBatchRepository(db_session)
    service = ImportService(
        transaction_repository=transaction_repository,
        import_batch_repository=import_batch_repository,
    )

    first_result = service.commit_import(
        source="revolut",
        csv_content=csv_content,
        filename="revolut_test.csv",
        current_user=LOCAL_CURRENT_USER,
    )
    second_result = service.commit_import(
        source="revolut",
        csv_content=csv_content,
        filename="revolut_test.csv",
        current_user=LOCAL_CURRENT_USER,
    )

    assert first_result["rows_total"] == 2
    assert first_result["rows_inserted"] == 2
    assert first_result["rows_skipped"] == 0
    assert isinstance(first_result["import_batch_id"], int)

    assert second_result["rows_total"] == 2
    assert second_result["rows_inserted"] == 0
    assert second_result["rows_skipped"] == 2
    assert isinstance(second_result["import_batch_id"], int)


def test_import_commit_rolls_back_batch_and_transactions_on_late_failure(
    db_session,
    monkeypatch,
):
    csv_content = """Completed Date,Description,Amount,Currency
2026-06-09 10:00:00,Salary,1000.00,EUR
2026-06-09 12:00:00,Groceries,-25.50,EUR
"""

    transaction_repository = TransactionRepository(db_session)
    import_batch_repository = ImportBatchRepository(db_session)
    service = ImportService(
        transaction_repository=transaction_repository,
        import_batch_repository=import_batch_repository,
    )

    original_bulk_insert = transaction_repository.bulk_insert

    def fail_after_transaction_flush(
        transactions,
        user_id,
        commit=True,
    ):
        result = original_bulk_insert(
            transactions,
            user_id=user_id,
            commit=commit,
        )
        raise RuntimeError("forced failure after transaction flush")

    monkeypatch.setattr(
        transaction_repository,
        "bulk_insert",
        fail_after_transaction_flush,
    )

    with pytest.raises(
        RuntimeError,
        match="forced failure after transaction flush",
    ):
        service.commit_import(
            source="revolut",
            csv_content=csv_content,
            filename="rollback.csv",
            current_user=LOCAL_CURRENT_USER,
        )

    assert db_session.query(ImportBatch).count() == 0
    assert db_session.query(Transaction).count() == 0


def test_import_commit_returns_controlled_conflict_for_integrity_error(
    db_session,
    monkeypatch,
):
    csv_content = """Completed Date,Description,Amount,Currency
2026-06-09 10:00:00,Salary,1000.00,EUR
"""

    transaction_repository = TransactionRepository(db_session)
    import_batch_repository = ImportBatchRepository(db_session)
    service = ImportService(
        transaction_repository=transaction_repository,
        import_batch_repository=import_batch_repository,
    )

    def raise_integrity_error(
        transactions,
        user_id,
        commit=True,
    ):
        raise IntegrityError(
            "INSERT INTO transactions",
            {},
            Exception("duplicate dedupe hash"),
        )

    monkeypatch.setattr(
        transaction_repository,
        "bulk_insert",
        raise_integrity_error,
    )

    with pytest.raises(HTTPException) as caught_error:
        service.commit_import(
            source="revolut",
            csv_content=csv_content,
            filename="conflict.csv",
            current_user=LOCAL_CURRENT_USER,
        )

    assert caught_error.value.status_code == 409
    assert (
        caught_error.value.detail
        == "Import conflicts with records committed by another request"
    )
    assert db_session.query(ImportBatch).count() == 0
    assert db_session.query(Transaction).count() == 0


def test_import_batch_counts_match_committed_transactions(db_session):
    csv_content = """Completed Date,Description,Amount,Currency
2026-06-09 10:00:00,Salary,1000.00,EUR
2026-06-09 12:00:00,Groceries,-25.50,EUR
"""

    service = ImportService(
        transaction_repository=TransactionRepository(db_session),
        import_batch_repository=ImportBatchRepository(db_session),
    )

    result = service.commit_import(
        source="revolut",
        csv_content=csv_content,
        filename="counts.csv",
        current_user=LOCAL_CURRENT_USER,
    )

    import_batch = db_session.get(
        ImportBatch,
        result["import_batch_id"],
    )
    committed_transactions = (
        db_session.query(Transaction)
        .filter(Transaction.import_batch_id == import_batch.id)
        .count()
    )

    assert import_batch is not None
    assert import_batch.rows_total == 2
    assert import_batch.rows_inserted == committed_transactions == 2
    assert import_batch.rows_skipped == 0
    assert result["rows_inserted"] == committed_transactions

def build_file_import_service(db_session):
    return ImportService(
        transaction_repository=TransactionRepository(db_session),
        import_batch_repository=ImportBatchRepository(db_session),
        preview_binding_service=ImportPreviewBindingService(
            ImportPreviewRepository(db_session)
        ),
    )


def test_file_commit_requires_exact_previewed_file(db_session):
    service = build_file_import_service(db_session)
    preview_bytes = (
        b"Completed Date,Description,Amount,Currency\n"
        b"2026-06-09 10:00:00,Salary,1000.00,EUR\n"
    )
    changed_bytes = (
        b"Completed Date,Description,Amount,Currency\n"
        b"2026-06-09 10:00:00,Changed,1000.00,EUR\n"
    )

    preview = service.preview_import_from_file(
        source="revolut",
        file_content=preview_bytes,
        filename="preview.csv",
        current_user=LOCAL_CURRENT_USER,
    )

    with pytest.raises(HTTPException) as caught_error:
        service.commit_import_from_file(
            source="revolut",
            preview_id=preview.preview_id,
            file_content=changed_bytes,
            filename="preview.csv",
            current_user=LOCAL_CURRENT_USER,
        )

    assert caught_error.value.status_code == 409
    assert db_session.query(ImportBatch).count() == 0
    assert db_session.query(Transaction).count() == 0


def test_file_commit_consumes_preview_and_matches_counts(db_session):
    service = build_file_import_service(db_session)
    file_content = (
        b"Completed Date,Description,Amount,Currency\n"
        b"2026-06-09 10:00:00,Salary,1000.00,EUR\n"
        b"2026-06-09 12:00:00,Groceries,-25.50,EUR\n"
    )

    preview = service.preview_import_from_file(
        source="revolut",
        file_content=file_content,
        filename="counts.csv",
        current_user=LOCAL_CURRENT_USER,
    )
    result = service.commit_import_from_file(
        source="revolut",
        preview_id=preview.preview_id,
        file_content=file_content,
        filename="counts.csv",
        current_user=LOCAL_CURRENT_USER,
    )

    stored_preview = db_session.get(ImportPreview, preview.preview_id)

    assert result["rows_total"] == preview.rows_total == 2
    assert result["rows_inserted"] == 2
    assert result["transactions_inserted"] == 2
    assert stored_preview is not None
    assert stored_preview.consumed_at is not None


def test_file_commit_rolls_back_preview_claim_on_financial_failure(
    db_session,
    monkeypatch,
):
    transaction_repository = TransactionRepository(db_session)
    service = ImportService(
        transaction_repository=transaction_repository,
        import_batch_repository=ImportBatchRepository(db_session),
        preview_binding_service=ImportPreviewBindingService(
            ImportPreviewRepository(db_session)
        ),
    )
    file_content = (
        b"Completed Date,Description,Amount,Currency\n"
        b"2026-06-09 10:00:00,Salary,1000.00,EUR\n"
    )
    preview = service.preview_import_from_file(
        source="revolut",
        file_content=file_content,
        filename="rollback.csv",
        current_user=LOCAL_CURRENT_USER,
    )

    def fail_bulk_insert(transactions, user_id, commit=True):
        del transactions, user_id, commit
        raise RuntimeError("forced file commit failure")

    monkeypatch.setattr(
        transaction_repository,
        "bulk_insert",
        fail_bulk_insert,
    )

    with pytest.raises(
        RuntimeError,
        match="forced file commit failure",
    ):
        service.commit_import_from_file(
            source="revolut",
            preview_id=preview.preview_id,
            file_content=file_content,
            filename="rollback.csv",
            current_user=LOCAL_CURRENT_USER,
        )

    db_session.expire_all()
    stored_preview = db_session.get(ImportPreview, preview.preview_id)

    assert stored_preview is not None
    assert stored_preview.consumed_at is None
    assert db_session.query(ImportBatch).count() == 0
    assert db_session.query(Transaction).count() == 0
