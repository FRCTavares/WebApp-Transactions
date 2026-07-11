from decimal import Decimal

import pytest

from app.models.import_batch import ImportBatch
from app.models.investment_event import InvestmentEvent
from app.models.transaction import Transaction
from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.repositories.transaction_repository import TransactionRepository
from app.services.import_service import ImportService


def test_trading212_preview_and_commit_splits_transactions_and_investment_events(db_session):
    csv_content = """Action,Time,Notes,ID,Total,Currency (Total),Charge amount,Currency (Charge amount),Deposit fee,Currency (Deposit fee),Merchant name,Merchant category
Market buy,2026-05-02 10:00:00,Market buy,market-1,12.34,EUR,,,,,,
Bank Transfer,2026-05-02 11:00:00,Bank Transfer,transfer-1,100.00,EUR,,,,,,
Interest on cash,2026-05-02 14:00:00,Interest on cash,interest-1,0.03,EUR,,,,,,
"""

    transaction_repository = TransactionRepository(db_session)
    investment_event_repository = InvestmentEventRepository(db_session)
    service = ImportService(
        transaction_repository=transaction_repository,
        import_batch_repository=ImportBatchRepository(db_session),
        investment_event_repository=investment_event_repository,
    )

    preview = service.preview_import(source="trading212", csv_content=csv_content)

    assert preview.rows_total == 3
    assert preview.rows_valid == 3
    assert preview.rows_duplicates == 0
    assert len(preview.transactions) == 0
    assert len(preview.investment_events) == 3

    assert preview.investment_events[0].event_type == "market_buy"
    assert preview.investment_events[0].amount == Decimal("12.34")

    assert preview.investment_events[1].event_type == "deposit"
    assert preview.investment_events[1].funding_source == "activobank"
    assert preview.investment_events[1].funding_match_status == "unmatched"

    result = service.commit_import(
        source="trading212",
        csv_content=csv_content,
        filename="trading212.csv",
    )

    assert result["rows_inserted"] == 3
    assert result["transactions_inserted"] == 0
    assert result["investment_events_inserted"] == 3

    transactions = transaction_repository.list(source="trading212")
    events = investment_event_repository.list(source="trading212")

    assert len(transactions) == 0
    assert len(events) == 3
    assert {event.event_type for event in events} == {"deposit", "interest", "market_buy"}


def test_trading212_import_rolls_back_batch_transactions_and_events_on_late_event_failure(
    db_session,
    monkeypatch,
):
    csv_content = """Action,Time,Notes,ID,Total,Currency (Total),Charge amount,Currency (Charge amount),Deposit fee,Currency (Deposit fee),Merchant name,Merchant category
Card debit,2026-05-02 09:00:00,Coffee,card-1,-3.50,EUR,,,,,Coffee Shop,Restaurants
Market buy,2026-05-02 10:00:00,Market buy,market-1,12.34,EUR,,,,,,
Bank Transfer,2026-05-02 11:00:00,Bank Transfer,transfer-1,100.00,EUR,,,,,,
"""

    transaction_repository = TransactionRepository(db_session)
    investment_event_repository = InvestmentEventRepository(db_session)
    service = ImportService(
        transaction_repository=transaction_repository,
        import_batch_repository=ImportBatchRepository(db_session),
        investment_event_repository=investment_event_repository,
    )

    preview = service.preview_import(
        source="trading212",
        csv_content=csv_content,
    )

    assert len(preview.transactions) == 1
    assert len(preview.investment_events) == 2

    original_bulk_insert = investment_event_repository.bulk_insert

    def fail_after_event_flush(
        events,
        user_id,
        commit=True,
    ):
        original_bulk_insert(
            events,
            user_id=user_id,
            commit=commit,
        )
        raise RuntimeError("forced failure after investment event flush")

    monkeypatch.setattr(
        investment_event_repository,
        "bulk_insert",
        fail_after_event_flush,
    )

    with pytest.raises(
        RuntimeError,
        match="forced failure after investment event flush",
    ):
        service.commit_import(
            source="trading212",
            csv_content=csv_content,
            filename="trading212_rollback.csv",
        )

    assert db_session.query(ImportBatch).count() == 0
    assert db_session.query(Transaction).count() == 0
    assert db_session.query(InvestmentEvent).count() == 0
