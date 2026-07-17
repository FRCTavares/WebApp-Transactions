from datetime import date
from decimal import Decimal

import pytest

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID

from app.repositories.cashflow_rule_repository import CashflowRuleRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.cashflow_rule import CashflowRuleCreate, CashflowRuleUpdate
from app.schemas.transaction import TransactionCreate
from app.services.cashflow_rule_service import CashflowRuleService


LOCAL_CURRENT_USER = CurrentUser(id=LOCAL_DEFAULT_USER_ID)


def test_cashflow_rule_crud(db_session):
    repository = CashflowRuleRepository(db_session)
    service = CashflowRuleService(repository)

    rule = service.create_rule(
        CashflowRuleCreate(
            name="Trading 212 investment",
            cashflow_type="transfer",
            match_text="Trading 212",
            match_field="raw_description",
            direction="out",
            source="activobank",
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    assert rule.id is not None
    assert rule.cashflow_type == "transfer"

    updated = service.update_rule(
        rule.id,
        CashflowRuleUpdate(
            name="Trading 212 movement",
            cashflow_type="transfer",
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    assert updated.name == "Trading 212 movement"
    assert updated.cashflow_type == "transfer"

    service.delete_rule(rule.id, current_user=LOCAL_CURRENT_USER)

    assert repository.get_by_id(rule.id, LOCAL_DEFAULT_USER_ID) is None


def test_duplicate_cashflow_rule_is_rejected(db_session):
    repository = CashflowRuleRepository(db_session)
    service = CashflowRuleService(repository)

    payload = CashflowRuleCreate(
        name="Trading 212 investment",
        cashflow_type="transfer",
        match_text="Trading 212",
        match_field="raw_description",
        direction="out",
        source="activobank",
    )

    service.create_rule(payload, current_user=LOCAL_CURRENT_USER)

    try:
        service.create_rule(payload, current_user=LOCAL_CURRENT_USER)
    except Exception as error:
        assert "equivalent cashflow rule" in str(error)
    else:
        raise AssertionError("Expected duplicate cashflow rule to be rejected")


def test_apply_cashflow_rule_updates_matching_transactions(db_session):
    transaction_repository = TransactionRepository(db_session)
    rule_repository = CashflowRuleRepository(db_session)
    service = CashflowRuleService(
        cashflow_rule_repository=rule_repository,
        transaction_repository=transaction_repository,
    )

    matching_transaction = transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 1),
            description="COMPRA 8801 Trading 212 Limassol CY",
            raw_description="COMPRA 8801 Trading 212 Limassol CY",
            amount=Decimal("100.00"),
            direction="out",
            source="activobank",
            currency="EUR",
        ),
        user_id=LOCAL_DEFAULT_USER_ID,
    )

    non_matching_transaction = transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 2),
            description="Groceries",
            raw_description="Groceries",
            amount=Decimal("25.00"),
            direction="out",
            source="manual",
            currency="EUR",
        ),
        user_id=LOCAL_DEFAULT_USER_ID,
    )

    service.create_rule(
        CashflowRuleCreate(
            name="Trading 212 investment",
            cashflow_type="transfer",
            match_text="Trading 212",
            match_field="raw_description",
            direction="out",
            source="activobank",
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    result = service.apply_rules_to_existing_transactions(current_user=LOCAL_CURRENT_USER)

    db_session.refresh(matching_transaction)
    db_session.refresh(non_matching_transaction)

    assert result["checked"] == 2
    assert result["updated"] == 1
    assert matching_transaction.cashflow_type == "transfer"
    assert non_matching_transaction.cashflow_type == "expense"


def test_cashflow_rule_application_commits_once(db_session, monkeypatch):
    transaction_repository = TransactionRepository(db_session)
    rule_repository = CashflowRuleRepository(db_session)
    service = CashflowRuleService(
        cashflow_rule_repository=rule_repository,
        transaction_repository=transaction_repository,
    )

    for day in (1, 2):
        transaction_repository.create(
            TransactionCreate(
                date=date(2026, 5, day),
                description=f"Trading 212 transaction {day}",
                raw_description=f"Trading 212 transaction {day}",
                amount=Decimal("100.00"),
                direction="out",
                source="activobank",
                currency="EUR",
            ),
            user_id=LOCAL_DEFAULT_USER_ID,
        )

    service.create_rule(
        CashflowRuleCreate(
            name="Trading 212 investment",
            cashflow_type="transfer",
            match_text="Trading 212",
            match_field="raw_description",
            direction="out",
            source="activobank",
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    commit_count = 0
    original_commit = db_session.commit

    def count_commit():
        nonlocal commit_count
        commit_count += 1
        original_commit()

    monkeypatch.setattr(db_session, "commit", count_commit)

    result = service.apply_rules_to_existing_transactions(
        current_user=LOCAL_CURRENT_USER
    )

    transactions = transaction_repository.list(
        user_id=LOCAL_DEFAULT_USER_ID,
    )

    assert result == {"checked": 2, "updated": 2}
    assert commit_count == 1
    assert {transaction.cashflow_type for transaction in transactions} == {
        "transfer"
    }


def test_cashflow_rule_application_rolls_back_all_updates(
    db_session,
    monkeypatch,
):
    transaction_repository = TransactionRepository(db_session)
    rule_repository = CashflowRuleRepository(db_session)
    service = CashflowRuleService(
        cashflow_rule_repository=rule_repository,
        transaction_repository=transaction_repository,
    )

    for day in (1, 2):
        transaction_repository.create(
            TransactionCreate(
                date=date(2026, 5, day),
                description=f"Trading 212 transaction {day}",
                raw_description=f"Trading 212 transaction {day}",
                amount=Decimal("100.00"),
                direction="out",
                source="activobank",
                currency="EUR",
            ),
            user_id=LOCAL_DEFAULT_USER_ID,
        )

    service.create_rule(
        CashflowRuleCreate(
            name="Trading 212 investment",
            cashflow_type="transfer",
            match_text="Trading 212",
            match_field="raw_description",
            direction="out",
            source="activobank",
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    original_update = transaction_repository.update_cashflow_type
    update_count = 0

    def fail_after_first_update(*, transaction, cashflow_type):
        nonlocal update_count
        update_count += 1

        if update_count == 2:
            raise RuntimeError("forced cashflow rule failure")

        return original_update(
            transaction=transaction,
            cashflow_type=cashflow_type,
        )

    monkeypatch.setattr(
        transaction_repository,
        "update_cashflow_type",
        fail_after_first_update,
    )

    with pytest.raises(RuntimeError, match="forced cashflow rule failure"):
        service.apply_rules_to_existing_transactions(
            current_user=LOCAL_CURRENT_USER
        )

    db_session.expire_all()

    transactions = transaction_repository.list(
        user_id=LOCAL_DEFAULT_USER_ID,
    )

    assert update_count == 2
    assert {transaction.cashflow_type for transaction in transactions} == {
        "expense"
    }


def test_cashflow_rules_endpoint_create_and_apply(client):
    create_transaction_response = client.post(
        "/api/transactions",
        json={
            "date": "2026-05-01",
            "description": "COMPRA 8801 Trading 212 Limassol CY",
            "raw_description": "COMPRA 8801 Trading 212 Limassol CY",
            "amount": "100.00",
            "direction": "out",
            "source": "activobank",
            "currency": "EUR",
        },
    )

    assert create_transaction_response.status_code == 201

    create_rule_response = client.post(
        "/api/cashflow-rules",
        json={
            "name": "Trading 212 investment",
            "cashflow_type": "transfer",
            "match_text": "Trading 212",
            "match_field": "raw_description",
            "direction": "out",
            "source": "activobank",
            "is_active": True,
        },
    )

    assert create_rule_response.status_code == 201

    apply_response = client.post("/api/cashflow-rules/apply")

    assert apply_response.status_code == 200
    assert apply_response.json()["updated"] == 1

    transactions_response = client.get("/api/transactions?cashflow_type=transfer")

    assert transactions_response.status_code == 200
    transactions = transactions_response.json()
    assert len(transactions) == 1
    assert transactions[0]["cashflow_type"] == "transfer"


def test_cashflow_rule_can_set_income_type(db_session):
    repository = CashflowRuleRepository(db_session)
    service = CashflowRuleService(repository)

    rule = service.create_rule(
        CashflowRuleCreate(
            name="Mother income",
            cashflow_type="income",
            match_text="MOTHER",
            match_field="raw_description",
            direction="in",
            source="activobank",
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    assert rule.cashflow_type == "income"


def test_cashflow_rule_can_set_expense_type(db_session):
    repository = CashflowRuleRepository(db_session)
    service = CashflowRuleService(repository)

    rule = service.create_rule(
        CashflowRuleCreate(
            name="Reimbursed health expense",
            cashflow_type="expense",
            match_text="SOFIA",
            match_field="raw_description",
            direction="out",
            source="activobank",
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    assert rule.cashflow_type == "expense"


def test_cashflow_rules_are_isolated_by_user(db_session):
    from fastapi import HTTPException
    import pytest


    repository = CashflowRuleRepository(db_session)
    service = CashflowRuleService(repository)

    first_user = CurrentUser(id="user-one")
    second_user = CurrentUser(id="user-two")

    payload = CashflowRuleCreate(
        name="Trading 212 investment",
        cashflow_type="transfer",
        match_text="Trading 212",
        match_field="raw_description",
        direction="out",
        source="activobank",
    )

    first_rule = service.create_rule(payload, current_user=first_user)
    second_rule = service.create_rule(payload, current_user=second_user)

    assert [rule.id for rule in service.list_rules(current_user=first_user)] == [first_rule.id]
    assert [rule.id for rule in service.list_rules(current_user=second_user)] == [second_rule.id]

    with pytest.raises(HTTPException) as caught_error:
        service.get_rule(second_rule.id, current_user=first_user)

    assert caught_error.value.status_code == 404
