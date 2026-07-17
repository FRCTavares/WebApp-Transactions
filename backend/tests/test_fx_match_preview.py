from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.models.transaction import Transaction
from app.repositories.import_batch_repository import ImportBatchRepository
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.repositories.transaction_repository import TransactionRepository
from app.services.fx_match_service import FxMatchService
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
    def __init__(
        self,
        rate: Decimal | None = Decimal("0.92162162"),
        *,
        fail: bool = False,
    ) -> None:
        self.rate = rate
        self.fail = fail

    def get_history(self, symbol, date_from, date_to):
        del symbol, date_from

        if self.fail:
            raise MarketDataProviderError("provider unavailable")

        if self.rate is None:
            return []

        return [
            MarketDataHistoryPoint(
                price_date=date_to,
                close_price=self.rate,
                currency="EUR",
            )
        ]


def build_service(
    db_session,
    *,
    provider: FakeFxProvider | None = None,
) -> FxMatchService:
    transaction_repository = TransactionRepository(db_session)
    import_service = ImportService(
        transaction_repository=transaction_repository,
        import_batch_repository=ImportBatchRepository(db_session),
        investment_event_repository=InvestmentEventRepository(db_session),
    )

    return FxMatchService(
        transaction_repository=transaction_repository,
        import_service=import_service,
        fx_resolution_service=ImportFxResolutionService(
            provider or FakeFxProvider()
        ),
    )


def test_fx_match_preview_suggests_activobank_outflows(db_session):
    transaction_repository = TransactionRepository(db_session)
    transaction_repository.bulk_insert(
        [
            Transaction(
                user_id=LOCAL_DEFAULT_USER_ID,
                date=date(2024, 9, 8),
                description="Transfer to Trading 212",
                raw_description="Transfer to Trading 212",
                amount=Decimal("34.10"),
                direction="out",
                cashflow_type="transfer",
                source="activobank",
                account="ActivoBank",
                currency="EUR",
            ),
            Transaction(
                user_id=LOCAL_DEFAULT_USER_ID,
                date=date(2024, 9, 20),
                description="Too far away",
                raw_description="Too far away",
                amount=Decimal("34.10"),
                direction="out",
                cashflow_type="transfer",
                source="activobank",
                account="ActivoBank",
                currency="EUR",
            ),
            Transaction(
                user_id=LOCAL_DEFAULT_USER_ID,
                date=date(2024, 9, 8),
                description="Wrong source",
                raw_description="Wrong source",
                amount=Decimal("34.10"),
                direction="out",
                cashflow_type="transfer",
                source="revolut",
                account="Revolut",
                currency="EUR",
            ),
        ],
        user_id=LOCAL_DEFAULT_USER_ID,
    )

    csv_content = """Action,Time,Notes,ID,Total,Currency (Total),Charge amount,Currency (Charge amount),Deposit fee,Currency (Deposit fee),Merchant name,Merchant category
Deposit,2024-09-09 10:00:00,Transaction ID: ABC123,deposit-1,37.00,USD,,,,,,
Market buy,2024-09-09 10:05:00,Market buy,market-1,37.00,USD,,,,,,
"""

    service = build_service(db_session)

    response = service.preview_matches_from_file(
        source="trading212",
        file_content=csv_content.encode("utf-8"),
        filename="trading212.csv",
        current_user=LOCAL_CURRENT_USER,
    )

    assert response.source == "trading212"
    assert len(response.pending_deposits) == 1

    pending_deposit = response.pending_deposits[0]

    assert pending_deposit.row_number == 1
    assert pending_deposit.amount == Decimal("37.00")
    assert pending_deposit.currency == "USD"
    assert len(pending_deposit.candidates) == 1

    candidate = pending_deposit.candidates[0]

    assert candidate.description == "Transfer to Trading 212"
    assert candidate.source == "activobank"
    assert candidate.amount == Decimal("34.10")
    assert candidate.currency == "EUR"
    assert candidate.date_distance_days == 1


def test_fx_match_preview_rejects_non_trading212_source(db_session):
    service = build_service(db_session)

    with pytest.raises(HTTPException) as error:
        service.preview_matches_from_file(
            source="revolut",
            file_content=b"",
            filename="revolut.csv",
            current_user=LOCAL_CURRENT_USER,
        )

    assert error.value.status_code == 400


def test_fx_match_preview_uses_date_appropriate_rate_for_ranking(
    db_session,
):
    transaction_repository = TransactionRepository(db_session)
    transaction_repository.bulk_insert(
        [
            Transaction(
                user_id=LOCAL_DEFAULT_USER_ID,
                date=date(2024, 9, 9),
                description="Transfer to Trading 212",
                raw_description="Transfer to Trading 212",
                amount=Decimal("30.00"),
                direction="out",
                cashflow_type="transfer",
                source="activobank",
                account="ActivoBank",
                currency="EUR",
            ),
            Transaction(
                user_id=LOCAL_DEFAULT_USER_ID,
                date=date(2024, 9, 9),
                description="Transfer to Trading 212",
                raw_description="Transfer to Trading 212",
                amount=Decimal("34.00"),
                direction="out",
                cashflow_type="transfer",
                source="activobank",
                account="ActivoBank",
                currency="EUR",
            ),
        ],
        user_id=LOCAL_DEFAULT_USER_ID,
    )

    csv_content = """Action,Time,Notes,ID,Total,Currency (Total),Charge amount,Currency (Charge amount),Deposit fee,Currency (Deposit fee),Merchant name,Merchant category
Deposit,2024-09-09 10:00:00,Transaction ID: ABC123,deposit-1,37.00,USD,,,,,,
"""

    low_rate_response = build_service(
        db_session,
        provider=FakeFxProvider(Decimal("0.81")),
    ).preview_matches_from_file(
        source="trading212",
        file_content=csv_content.encode("utf-8"),
        filename="trading212.csv",
        current_user=LOCAL_CURRENT_USER,
    )

    high_rate_response = build_service(
        db_session,
        provider=FakeFxProvider(Decimal("0.92")),
    ).preview_matches_from_file(
        source="trading212",
        file_content=csv_content.encode("utf-8"),
        filename="trading212.csv",
        current_user=LOCAL_CURRENT_USER,
    )

    assert (
        low_rate_response.pending_deposits[0].candidates[0].amount
        == Decimal("30.00")
    )
    assert (
        high_rate_response.pending_deposits[0].candidates[0].amount
        == Decimal("34.00")
    )


def test_fx_match_preview_surfaces_missing_historical_rate(db_session):
    csv_content = """Action,Time,Notes,ID,Total,Currency (Total),Charge amount,Currency (Charge amount),Deposit fee,Currency (Deposit fee),Merchant name,Merchant category
Deposit,2024-09-09 10:00:00,Transaction ID: ABC123,deposit-1,37.00,USD,,,,,,
"""

    service = build_service(
        db_session,
        provider=FakeFxProvider(fail=True),
    )

    with pytest.raises(HTTPException) as error:
        service.preview_matches_from_file(
            source="trading212",
            file_content=csv_content.encode("utf-8"),
            filename="trading212.csv",
            current_user=LOCAL_CURRENT_USER,
        )

    assert error.value.status_code == 503
    assert error.value.detail == (
        "Historical FX rate is unavailable for USD on 2024-09-09"
    )
