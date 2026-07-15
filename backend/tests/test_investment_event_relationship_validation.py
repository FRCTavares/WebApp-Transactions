from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.models.investment_event import InvestmentEvent
from app.models.transaction import Transaction
from app.repositories.investment_event_repository import (
    InvestmentEventRepository,
)
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.investment_event import (
    InvestmentEventCreate,
    InvestmentEventUpdate,
)
from app.services.investment_event_service import InvestmentEventService


LOCAL_CURRENT_USER = CurrentUser(id=LOCAL_DEFAULT_USER_ID)


def build_service(db_session) -> InvestmentEventService:
    return InvestmentEventService(
        repository=InvestmentEventRepository(db_session),
        transaction_repository=TransactionRepository(db_session),
    )


def build_event_create(**overrides) -> InvestmentEventCreate:
    values = {
        "date": date(2026, 7, 14),
        "source": "manual",
        "event_type": "deposit",
        "description": "Investment deposit",
        "raw_description": "Investment deposit",
        "amount": Decimal("100.00"),
        "currency": "EUR",
    }
    values.update(overrides)
    return InvestmentEventCreate(**values)


@pytest.mark.parametrize(
    "field_name",
    ["transaction_id", "matched_transaction_id"],
)
def test_create_event_rejects_missing_transaction_link(
    db_session,
    field_name,
):
    service = build_service(db_session)
    event_data = build_event_create(
        **{field_name: 999999},
    )

    with pytest.raises(HTTPException) as error:
        service.create_event(
            event_data,
            current_user=LOCAL_CURRENT_USER,
        )

    assert error.value.status_code == 400
    assert error.value.detail.endswith("not found")
    assert service.repository.list_all(
        user_id=LOCAL_DEFAULT_USER_ID,
    ) == []


@pytest.mark.parametrize(
    "field_name",
    ["transaction_id", "matched_transaction_id"],
)
def test_create_event_rejects_other_user_transaction_link(
    db_session,
    field_name,
):
    other_transaction = Transaction(
        user_id="other-user",
        date=date(2026, 7, 14),
        description="Other transaction",
        raw_description="Other transaction",
        amount=Decimal("100.00"),
        direction="out",
        cashflow_type="transfer",
        source="manual",
        currency="EUR",
    )
    db_session.add(other_transaction)
    db_session.commit()

    service = build_service(db_session)
    event_data = build_event_create(
        **{field_name: other_transaction.id},
    )

    with pytest.raises(HTTPException) as error:
        service.create_event(
            event_data,
            current_user=LOCAL_CURRENT_USER,
        )

    assert error.value.status_code == 400
    assert error.value.detail.endswith("not found")


def test_create_event_accepts_same_user_transaction_links(
    db_session,
):
    transaction = Transaction(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 7, 14),
        description="Funding transaction",
        raw_description="Funding transaction",
        amount=Decimal("100.00"),
        direction="out",
        cashflow_type="transfer",
        source="manual",
        currency="EUR",
    )
    db_session.add(transaction)
    db_session.commit()

    service = build_service(db_session)
    created = service.create_event(
        build_event_create(
            transaction_id=transaction.id,
            matched_transaction_id=transaction.id,
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    assert created.transaction_id == transaction.id
    assert created.matched_transaction_id == transaction.id


def test_update_event_rejects_other_user_transaction_link(
    db_session,
):
    other_transaction = Transaction(
        user_id="other-user",
        date=date(2026, 7, 14),
        description="Other transaction",
        raw_description="Other transaction",
        amount=Decimal("100.00"),
        direction="out",
        cashflow_type="transfer",
        source="manual",
        currency="EUR",
    )
    event = InvestmentEvent(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 7, 14),
        source="manual",
        event_type="deposit",
        description="Investment deposit",
        raw_description="Investment deposit",
        amount=Decimal("100.00"),
        currency="EUR",
    )
    db_session.add_all([other_transaction, event])
    db_session.commit()

    service = build_service(db_session)

    with pytest.raises(HTTPException) as error:
        service.update_event(
            event.id,
            InvestmentEventUpdate(
                transaction_id=other_transaction.id,
            ),
            current_user=LOCAL_CURRENT_USER,
        )

    assert error.value.status_code == 400

    db_session.refresh(event)
    assert event.transaction_id is None


def test_update_event_allows_explicit_unlink(db_session):
    transaction = Transaction(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 7, 14),
        description="Funding transaction",
        raw_description="Funding transaction",
        amount=Decimal("100.00"),
        direction="out",
        cashflow_type="transfer",
        source="manual",
        currency="EUR",
    )
    db_session.add(transaction)
    db_session.flush()

    event = InvestmentEvent(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 7, 14),
        source="manual",
        event_type="deposit",
        description="Investment deposit",
        raw_description="Investment deposit",
        amount=Decimal("100.00"),
        currency="EUR",
        transaction_id=transaction.id,
        matched_transaction_id=transaction.id,
    )
    db_session.add(event)
    db_session.commit()

    service = build_service(db_session)
    updated = service.update_event(
        event.id,
        InvestmentEventUpdate(
            transaction_id=None,
            matched_transaction_id=None,
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    assert updated.transaction_id is None
    assert updated.matched_transaction_id is None
