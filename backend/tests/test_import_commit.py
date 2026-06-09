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
