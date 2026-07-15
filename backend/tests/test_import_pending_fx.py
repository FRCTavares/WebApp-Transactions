from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.investment_event_repository import (
    InvestmentEventRepository,
)
from app.repositories.transaction_repository import TransactionRepository
from app.services.import_fx_resolution_service import (
    ImportFxResolutionService,
)
from app.services.import_service import ImportService
from app.services.market_data.base import (
    MarketDataHistoryPoint,
    MarketDataProviderError,
)


LOCAL_CURRENT_USER = CurrentUser(id=LOCAL_DEFAULT_USER_ID)


class FakeFxProvider:
    def __init__(self, *, fail=False):
        self.fail = fail

    def get_history(self, symbol, date_from, date_to):
        del symbol, date_from, date_to

        if self.fail:
            raise MarketDataProviderError("provider unavailable")

        return [
            MarketDataHistoryPoint(
                price_date=date(2024, 9, 9),
                close_price=Decimal("0.92"),
                currency="EUR",
            )
        ]


def build_service(db_session, *, fail_fx=False):
    investment_event_repository = InvestmentEventRepository(
        db_session
    )
    return (
        ImportService(
            transaction_repository=TransactionRepository(db_session),
            import_batch_repository=ImportBatchRepository(db_session),
            investment_event_repository=investment_event_repository,
            fx_resolution_service=ImportFxResolutionService(
                FakeFxProvider(fail=fail_fx)
            ),
        ),
        investment_event_repository,
    )


def test_trading212_resolves_market_event_and_keeps_deposit_unresolved(
    db_session,
):
    csv_content = """Action,Time,Notes,ID,Total,Currency (Total),Charge amount,Currency (Charge amount),Deposit fee,Currency (Deposit fee),Merchant name,Merchant category
Deposit,2024-09-09 10:00:00,Transaction ID: ABC123,deposit-1,37.00,USD,,,,,,
Market buy,2024-09-09 10:05:00,Market buy,market-1,37.00,USD,,,,,,
"""

    service, repository = build_service(db_session)

    preview = service.preview_import(
        source="trading212",
        csv_content=csv_content,
        current_user=LOCAL_CURRENT_USER,
    )

    deposit, market_buy = preview.investment_events

    assert deposit.event_type == "deposit"
    assert deposit.fx_rate_to_eur is None
    assert deposit.fx_rate_source == "pending"
    assert deposit.funding_match_status == "unmatched"

    assert market_buy.event_type == "market_buy"
    assert market_buy.fx_rate_to_eur == Decimal("0.92000000")
    assert (
        market_buy.fx_rate_source
        == "yfinance_historical:2024-09-09"
    )

    result = service.commit_import(
        source="trading212",
        csv_content=csv_content,
        filename="trading212.csv",
        current_user=LOCAL_CURRENT_USER,
    )

    assert result["investment_events_inserted"] == 2

    events = repository.list(
        source="trading212",
        user_id=LOCAL_DEFAULT_USER_ID,
    )
    stored_by_type = {
        event.event_type: event
        for event in events
    }

    assert stored_by_type["deposit"].fx_rate_source == "pending"
    assert (
        stored_by_type["market_buy"].fx_rate_to_eur
        == Decimal("0.92000000")
    )


def test_commit_blocks_market_event_when_fx_lookup_fails(
    db_session,
):
    csv_content = """Action,Time,Notes,ID,Total,Currency (Total),Charge amount,Currency (Charge amount),Deposit fee,Currency (Deposit fee),Merchant name,Merchant category
Market buy,2024-09-09 10:05:00,Market buy,market-1,37.00,USD,,,,,,
"""

    service, repository = build_service(
        db_session,
        fail_fx=True,
    )

    preview = service.preview_import(
        source="trading212",
        csv_content=csv_content,
        current_user=LOCAL_CURRENT_USER,
    )

    assert preview.investment_events[0].fx_rate_source == "pending"

    with pytest.raises(HTTPException) as caught_error:
        service.commit_import(
            source="trading212",
            csv_content=csv_content,
            filename="trading212.csv",
            current_user=LOCAL_CURRENT_USER,
        )

    assert caught_error.value.status_code == 400
    assert caught_error.value.detail[
        "pending_investment_event_rows"
    ] == [1]
    assert repository.list(
        source="trading212",
        user_id=LOCAL_DEFAULT_USER_ID,
    ) == []
