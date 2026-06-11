import pytest
from fastapi import HTTPException

from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.repositories.transaction_repository import TransactionRepository
from app.services.import_service import ImportService


def test_trading212_commit_blocks_pending_fx_rows(db_session):
    csv_content = """Action,Time,Notes,ID,Total,Currency (Total),Charge amount,Currency (Charge amount),Deposit fee,Currency (Deposit fee),Merchant name,Merchant category
Deposit,2024-09-09 10:00:00,Transaction ID: ABC123,deposit-1,37.00,USD,,,,,,
Market buy,2024-09-09 10:05:00,Market buy,market-1,37.00,USD,,,,,,
"""

    service = ImportService(
        transaction_repository=TransactionRepository(db_session),
        import_batch_repository=ImportBatchRepository(db_session),
        investment_event_repository=InvestmentEventRepository(db_session),
    )

    preview = service.preview_import(source="trading212", csv_content=csv_content)

    assert preview.rows_total == 2
    assert len(preview.transactions) == 1
    assert len(preview.investment_events) == 1
    assert preview.transactions[0].fx_rate_source == "pending"
    assert preview.investment_events[0].fx_rate_source == "pending"

    with pytest.raises(HTTPException) as error:
        service.commit_import(
            source="trading212",
            csv_content=csv_content,
            filename="trading212.csv",
        )

    assert error.value.status_code == 400
    assert error.value.detail["pending_transaction_rows"] == [1]
    assert error.value.detail["pending_investment_event_rows"] == [2]
