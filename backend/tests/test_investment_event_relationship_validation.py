from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import select

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
    ManualFundingResolutionCreate,
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


def test_create_event_rejects_mismatched_transaction_links(
    db_session,
):
    first_transaction = Transaction(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 7, 14),
        description="First funding",
        raw_description="First funding",
        amount=Decimal("100.00"),
        direction="out",
        cashflow_type="transfer",
        source="manual",
        currency="EUR",
    )
    second_transaction = Transaction(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 7, 14),
        description="Second funding",
        raw_description="Second funding",
        amount=Decimal("100.00"),
        direction="out",
        cashflow_type="transfer",
        source="manual",
        currency="EUR",
    )
    db_session.add_all([first_transaction, second_transaction])
    db_session.commit()

    service = build_service(db_session)

    with pytest.raises(HTTPException) as error:
        service.create_event(
            build_event_create(
                transaction_id=first_transaction.id,
                matched_transaction_id=second_transaction.id,
            ),
            current_user=LOCAL_CURRENT_USER,
        )

    assert error.value.status_code == 400
    assert "same transaction" in error.value.detail
    assert service.repository.list_all(
        user_id=LOCAL_DEFAULT_USER_ID,
    ) == []


def test_update_event_rejects_changing_only_one_transaction_link(
    db_session,
):
    first_transaction = Transaction(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 7, 14),
        description="First funding",
        raw_description="First funding",
        amount=Decimal("100.00"),
        direction="out",
        cashflow_type="transfer",
        source="manual",
        currency="EUR",
    )
    second_transaction = Transaction(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 7, 14),
        description="Second funding",
        raw_description="Second funding",
        amount=Decimal("100.00"),
        direction="out",
        cashflow_type="transfer",
        source="manual",
        currency="EUR",
    )
    db_session.add_all([first_transaction, second_transaction])
    db_session.commit()

    service = build_service(db_session)
    event = service.create_event(
        build_event_create(
            transaction_id=first_transaction.id,
            matched_transaction_id=first_transaction.id,
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    with pytest.raises(HTTPException) as error:
        service.update_event(
            event.id,
            InvestmentEventUpdate(
                transaction_id=second_transaction.id,
            ),
            current_user=LOCAL_CURRENT_USER,
        )

    assert error.value.status_code == 400
    assert "same transaction" in error.value.detail

    db_session.refresh(event)
    assert event.transaction_id == first_transaction.id
    assert event.matched_transaction_id == first_transaction.id


def test_update_event_rejects_clearing_only_one_transaction_link(
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
    event = service.create_event(
        build_event_create(
            transaction_id=transaction.id,
            matched_transaction_id=transaction.id,
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    with pytest.raises(HTTPException) as error:
        service.update_event(
            event.id,
            InvestmentEventUpdate(
                transaction_id=None,
            ),
            current_user=LOCAL_CURRENT_USER,
        )

    assert error.value.status_code == 400
    assert "same transaction" in error.value.detail

    db_session.refresh(event)
    assert event.transaction_id == transaction.id
    assert event.matched_transaction_id == transaction.id


def test_create_event_rejects_transaction_link_reuse(db_session):
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
    service.create_event(
        build_event_create(
            transaction_id=transaction.id,
            matched_transaction_id=transaction.id,
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    with pytest.raises(HTTPException) as error:
        service.create_event(
            build_event_create(
                description="Duplicate deposit",
                raw_description="Duplicate deposit",
                transaction_id=transaction.id,
            ),
            current_user=LOCAL_CURRENT_USER,
        )

    assert error.value.status_code == 400
    assert "already linked" in error.value.detail


def test_update_event_rejects_transaction_link_reuse(db_session):
    first_transaction = Transaction(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 7, 14),
        description="First funding",
        raw_description="First funding",
        amount=Decimal("100.00"),
        direction="out",
        cashflow_type="transfer",
        source="manual",
        currency="EUR",
    )
    second_transaction = Transaction(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 7, 14),
        description="Second funding",
        raw_description="Second funding",
        amount=Decimal("75.00"),
        direction="out",
        cashflow_type="transfer",
        source="manual",
        currency="EUR",
    )
    db_session.add_all([first_transaction, second_transaction])
    db_session.commit()

    service = build_service(db_session)
    service.create_event(
        build_event_create(
            transaction_id=first_transaction.id,
            matched_transaction_id=first_transaction.id,
        ),
        current_user=LOCAL_CURRENT_USER,
    )
    second_event = service.create_event(
        build_event_create(
            amount=Decimal("75.00"),
            description="Second deposit",
            raw_description="Second deposit",
            transaction_id=second_transaction.id,
            matched_transaction_id=second_transaction.id,
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    with pytest.raises(HTTPException) as error:
        service.update_event(
            second_event.id,
            InvestmentEventUpdate(
                transaction_id=first_transaction.id,
                matched_transaction_id=first_transaction.id,
            ),
            current_user=LOCAL_CURRENT_USER,
        )

    assert error.value.status_code == 400

    db_session.refresh(second_event)
    assert second_event.transaction_id == second_transaction.id
    assert (
        second_event.matched_transaction_id
        == second_transaction.id
    )


def test_update_event_allows_current_transaction_links(db_session):
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
    event = service.create_event(
        build_event_create(
            transaction_id=transaction.id,
            matched_transaction_id=transaction.id,
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    updated = service.update_event(
        event.id,
        InvestmentEventUpdate(
            transaction_id=transaction.id,
            matched_transaction_id=transaction.id,
            notes="Keep existing reconciliation",
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    assert updated.transaction_id == transaction.id
    assert updated.matched_transaction_id == transaction.id


def test_manual_funding_resolution_rolls_back_on_update_failure(
    db_session,
    monkeypatch,
):
    event = InvestmentEvent(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 7, 14),
        source="trading212",
        event_type="deposit",
        description="Investment deposit",
        raw_description="Investment deposit",
        amount=Decimal("100.00"),
        currency="USD",
        funding_source="activobank",
        funding_match_status="unmatched",
    )
    db_session.add(event)
    db_session.commit()

    service = build_service(db_session)

    def fail_update(*args, **kwargs):
        raise RuntimeError("forced event update failure")

    monkeypatch.setattr(
        service.repository,
        "update",
        fail_update,
    )

    with pytest.raises(
        RuntimeError,
        match="forced event update failure",
    ):
        service.resolve_manual_funding(
            event.id,
            ManualFundingResolutionCreate(
                eur_amount=Decimal("90.00"),
                date=date(2026, 7, 14),
                description="Manual funding",
            ),
            current_user=LOCAL_CURRENT_USER,
        )

    stored_transactions = list(
        db_session.scalars(
            select(Transaction).where(
                Transaction.user_id == LOCAL_DEFAULT_USER_ID
            )
        ).all()
    )
    assert stored_transactions == []

    db_session.refresh(event)
    assert event.funding_match_status == "unmatched"
    assert event.transaction_id is None
    assert event.matched_transaction_id is None
