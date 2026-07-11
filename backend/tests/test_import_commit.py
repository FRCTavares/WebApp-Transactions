import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.models.import_batch import ImportBatch
from app.models.transaction import Transaction
from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.transaction_repository import TransactionRepository
from app.services.import_service import ImportService


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
    )
    second_result = service.commit_import(
        source="revolut",
        csv_content=csv_content,
        filename="revolut_test.csv",
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
