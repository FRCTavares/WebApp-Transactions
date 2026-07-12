from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.repositories.transaction_repository import TransactionRepository
from app.services.import_service import ImportService

LOCAL_CURRENT_USER = CurrentUser(id=LOCAL_DEFAULT_USER_ID)


def test_trading212_commit_allows_pending_fx_investment_events(db_session):
    csv_content = """Action,Time,Notes,ID,Total,Currency (Total),Charge amount,Currency (Charge amount),Deposit fee,Currency (Deposit fee),Merchant name,Merchant category
Deposit,2024-09-09 10:00:00,Transaction ID: ABC123,deposit-1,37.00,USD,,,,,,
Market buy,2024-09-09 10:05:00,Market buy,market-1,37.00,USD,,,,,,
"""

    transaction_repository = TransactionRepository(db_session)
    investment_event_repository = InvestmentEventRepository(db_session)
    service = ImportService(
        transaction_repository=transaction_repository,
        import_batch_repository=ImportBatchRepository(db_session),
        investment_event_repository=investment_event_repository,
    )

    preview = service.preview_import(source="trading212", csv_content=csv_content, current_user=LOCAL_CURRENT_USER)

    assert preview.rows_total == 2
    assert len(preview.transactions) == 0
    assert len(preview.investment_events) == 2
    assert preview.investment_events[0].event_type == "deposit"
    assert preview.investment_events[0].fx_rate_source == "pending"
    assert preview.investment_events[0].funding_source == "activobank"
    assert preview.investment_events[0].funding_match_status == "unmatched"
    assert preview.investment_events[1].fx_rate_source == "pending"

    result = service.commit_import(
        source="trading212",
        csv_content=csv_content,
        filename="trading212.csv",
        current_user=LOCAL_CURRENT_USER,
    )

    assert result["transactions_inserted"] == 0
    assert result["investment_events_inserted"] == 2

    events = investment_event_repository.list(
        source="trading212",
        user_id=LOCAL_DEFAULT_USER_ID,
    )
    assert len(events) == 2
    assert {event.event_type for event in events} == {"deposit", "market_buy"}
