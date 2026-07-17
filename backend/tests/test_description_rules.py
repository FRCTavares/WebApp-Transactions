from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.repositories.description_rule_repository import DescriptionRuleRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.description_rule import DescriptionRuleCreate, DescriptionRuleUpdate
from app.schemas.transaction import TransactionCreate
from app.services.description_rule_service import DescriptionRuleService


LOCAL_CURRENT_USER = CurrentUser(id=LOCAL_DEFAULT_USER_ID)


def test_description_rule_service_rejects_duplicate_rule(db_session):
    repository = DescriptionRuleRepository(db_session)
    service = DescriptionRuleService(repository)

    rule_data = DescriptionRuleCreate(
        name="Too Good To Go",
        cleaned_description="Too Good To Go",
        match_text="TGTG",
        match_field="raw_description",
        direction="out",
        source="revolut",
        is_active=True,
    )

    service.create_rule(rule_data, current_user=LOCAL_CURRENT_USER)

    with pytest.raises(HTTPException) as caught_error:
        service.create_rule(
            DescriptionRuleCreate(
                name="Duplicate TGTG",
                cleaned_description="TGTG",
                match_text=" tgtg ",
                match_field="raw_description",
                direction="out",
                source="revolut",
                is_active=False,
            ),
            current_user=LOCAL_CURRENT_USER,
        )

    assert caught_error.value.status_code == 409


def test_description_rule_service_rejects_duplicate_rule_update(db_session):
    repository = DescriptionRuleRepository(db_session)
    service = DescriptionRuleService(repository)

    existing_rule = service.create_rule(
        DescriptionRuleCreate(
            name="Too Good To Go",
            cleaned_description="Too Good To Go",
            match_text="TGTG",
            match_field="raw_description",
            direction="out",
            source="revolut",
            is_active=True,
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    second_rule = service.create_rule(
        DescriptionRuleCreate(
            name="Auchan",
            cleaned_description="Auchan",
            match_text="AUCHAN",
            match_field="raw_description",
            direction="out",
            source="revolut",
            is_active=True,
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    with pytest.raises(HTTPException) as caught_error:
        service.update_rule(
            second_rule.id,
            DescriptionRuleUpdate(
                match_text=existing_rule.match_text,
            ),
            current_user=LOCAL_CURRENT_USER,
        )

    assert caught_error.value.status_code == 409


def test_apply_description_rules_updates_description_and_preserves_raw_description(db_session):
    transaction_repository = TransactionRepository(db_session)
    description_rule_repository = DescriptionRuleRepository(db_session)
    service = DescriptionRuleService(
        description_rule_repository=description_rule_repository,
        transaction_repository=transaction_repository,
    )

    transaction = transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 4),
            description="TGTG aqwt6rwqmw7b0 LISBOA PT",
            raw_description="TGTG aqwt6rwqmw7b0 LISBOA PT",
            amount=Decimal("3.99"),
            direction="out",
            source="revolut",
            account="Revolut",
            currency="EUR",
            notes="Card payment",
        ),
        user_id=LOCAL_DEFAULT_USER_ID,
    )

    service.create_rule(
        DescriptionRuleCreate(
            name="Too Good To Go",
            cleaned_description="Too Good To Go",
            match_text="TGTG",
            match_field="raw_description",
            direction="out",
            source="revolut",
            is_active=True,
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    result = service.apply_rules_to_existing_transactions(current_user=LOCAL_CURRENT_USER)

    updated_transaction = transaction_repository.get_by_id(
        transaction.id,
        user_id=LOCAL_DEFAULT_USER_ID,
    )

    assert result == {
        "checked": 1,
        "updated": 1,
    }
    assert updated_transaction is not None
    assert updated_transaction.description == "Too Good To Go"
    assert updated_transaction.raw_description == "TGTG aqwt6rwqmw7b0 LISBOA PT"


def test_description_rule_application_commits_once(
    db_session,
    monkeypatch,
):
    transaction_repository = TransactionRepository(db_session)
    rule_repository = DescriptionRuleRepository(db_session)
    service = DescriptionRuleService(
        description_rule_repository=rule_repository,
        transaction_repository=transaction_repository,
    )

    for day in (1, 2):
        transaction_repository.create(
            TransactionCreate(
                date=date(2026, 5, day),
                description=f"TGTG transaction {day}",
                raw_description=f"TGTG transaction {day}",
                amount=Decimal("3.99"),
                direction="out",
                source="revolut",
                currency="EUR",
            ),
            user_id=LOCAL_DEFAULT_USER_ID,
        )

    service.create_rule(
        DescriptionRuleCreate(
            name="Too Good To Go",
            cleaned_description="Too Good To Go",
            match_text="TGTG",
            match_field="raw_description",
            direction="out",
            source="revolut",
            is_active=True,
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
    assert {transaction.description for transaction in transactions} == {
        "Too Good To Go"
    }


def test_description_rule_application_rolls_back_all_updates(
    db_session,
    monkeypatch,
):
    transaction_repository = TransactionRepository(db_session)
    rule_repository = DescriptionRuleRepository(db_session)
    service = DescriptionRuleService(
        description_rule_repository=rule_repository,
        transaction_repository=transaction_repository,
    )

    original_descriptions = {
        "TGTG transaction 1",
        "TGTG transaction 2",
    }

    for day in (1, 2):
        transaction_repository.create(
            TransactionCreate(
                date=date(2026, 5, day),
                description=f"TGTG transaction {day}",
                raw_description=f"TGTG transaction {day}",
                amount=Decimal("3.99"),
                direction="out",
                source="revolut",
                currency="EUR",
            ),
            user_id=LOCAL_DEFAULT_USER_ID,
        )

    service.create_rule(
        DescriptionRuleCreate(
            name="Too Good To Go",
            cleaned_description="Too Good To Go",
            match_text="TGTG",
            match_field="raw_description",
            direction="out",
            source="revolut",
            is_active=True,
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    original_update = transaction_repository.update_description
    update_count = 0

    def fail_after_first_update(*, transaction, description):
        nonlocal update_count
        update_count += 1

        if update_count == 2:
            raise RuntimeError("forced description rule failure")

        return original_update(
            transaction=transaction,
            description=description,
        )

    monkeypatch.setattr(
        transaction_repository,
        "update_description",
        fail_after_first_update,
    )

    with pytest.raises(RuntimeError, match="forced description rule failure"):
        service.apply_rules_to_existing_transactions(
            current_user=LOCAL_CURRENT_USER
        )

    db_session.expire_all()

    transactions = transaction_repository.list(
        user_id=LOCAL_DEFAULT_USER_ID,
    )

    assert update_count == 2
    assert {transaction.description for transaction in transactions} == (
        original_descriptions
    )


def test_inactive_description_rules_are_not_applied(db_session):
    transaction_repository = TransactionRepository(db_session)
    description_rule_repository = DescriptionRuleRepository(db_session)
    service = DescriptionRuleService(
        description_rule_repository=description_rule_repository,
        transaction_repository=transaction_repository,
    )

    transaction = transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 4),
            description="TGTG aqwt6rwqmw7b0 LISBOA PT",
            raw_description="TGTG aqwt6rwqmw7b0 LISBOA PT",
            amount=Decimal("3.99"),
            direction="out",
            source="revolut",
            account="Revolut",
            currency="EUR",
            notes="Card payment",
        ),
        user_id=LOCAL_DEFAULT_USER_ID,
    )

    service.create_rule(
        DescriptionRuleCreate(
            name="Too Good To Go",
            cleaned_description="Too Good To Go",
            match_text="TGTG",
            match_field="raw_description",
            direction="out",
            source="revolut",
            is_active=False,
        ),
        current_user=LOCAL_CURRENT_USER,
    )

    result = service.apply_rules_to_existing_transactions(current_user=LOCAL_CURRENT_USER)

    updated_transaction = transaction_repository.get_by_id(
        transaction.id,
        user_id=LOCAL_DEFAULT_USER_ID,
    )

    assert result == {
        "checked": 1,
        "updated": 0,
    }
    assert updated_transaction is not None
    assert updated_transaction.description == "TGTG aqwt6rwqmw7b0 LISBOA PT"


def test_description_rule_suggestions_group_transactions(db_session):
    transaction_repository = TransactionRepository(db_session)
    description_rule_repository = DescriptionRuleRepository(db_session)
    service = DescriptionRuleService(
        description_rule_repository=description_rule_repository,
        transaction_repository=transaction_repository,
    )

    for external_suffix in ["one", "two"]:
        transaction_repository.create(
            TransactionCreate(
                date=date(2026, 5, 4),
                description="TGTG aqwt6rwqmw7b0 LISBOA PT",
                raw_description="TGTG aqwt6rwqmw7b0 LISBOA PT",
                amount=Decimal("3.99"),
                direction="out",
                source="revolut",
                account="Revolut",
                currency="EUR",
                external_id=external_suffix,
                notes="Card payment",
            ),
            user_id=LOCAL_DEFAULT_USER_ID,
        )

    transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 5),
            description="Salary",
            raw_description="Salary May",
            amount=Decimal("1000.00"),
            direction="in",
            source="manual",
            account="Manual",
            currency="EUR",
        ),
        user_id=LOCAL_DEFAULT_USER_ID,
    )

    suggestions = service.get_rule_suggestions(direction="out", current_user=LOCAL_CURRENT_USER)

    assert len(suggestions) == 1
    assert suggestions[0].raw_description == "TGTG aqwt6rwqmw7b0 LISBOA PT"
    assert suggestions[0].description == "TGTG aqwt6rwqmw7b0 LISBOA PT"
    assert suggestions[0].source == "revolut"
    assert suggestions[0].direction == "out"
    assert suggestions[0].count == 2
    assert suggestions[0].total == Decimal("7.98")


def test_description_rule_suggestions_endpoint(client):
    create_payload = {
        "date": "2026-05-04",
        "description": "TGTG aqwt6rwqmw7b0 LISBOA PT",
        "raw_description": "TGTG aqwt6rwqmw7b0 LISBOA PT",
        "amount": "3.99",
        "direction": "out",
        "source": "revolut",
        "account": "Revolut",
        "currency": "EUR",
        "notes": "Card payment",
    }

    create_response = client.post("/api/transactions", json=create_payload)
    assert create_response.status_code == 201

    suggestions_response = client.get("/api/description-rules/suggestions?direction=out")
    assert suggestions_response.status_code == 200

    suggestions = suggestions_response.json()

    assert suggestions == [
        {
            "raw_description": "TGTG aqwt6rwqmw7b0 LISBOA PT",
            "description": "TGTG aqwt6rwqmw7b0 LISBOA PT",
            "source": "revolut",
            "direction": "out",
            "count": 1,
            "total": "3.99",
        }
    ]


def test_description_rules_are_isolated_by_user(db_session):
    repository = DescriptionRuleRepository(db_session)
    service = DescriptionRuleService(repository)

    first_user = CurrentUser(id="user-one")
    second_user = CurrentUser(id="user-two")

    payload = DescriptionRuleCreate(
        name="Too Good To Go",
        cleaned_description="Too Good To Go",
        match_text="TGTG",
        match_field="raw_description",
        direction="out",
        source="revolut",
        is_active=True,
    )

    first_rule = service.create_rule(payload, current_user=first_user)
    second_rule = service.create_rule(payload, current_user=second_user)

    assert [rule.id for rule in service.list_rules(current_user=first_user)] == [first_rule.id]
    assert [rule.id for rule in service.list_rules(current_user=second_user)] == [second_rule.id]

    with pytest.raises(HTTPException) as caught_error:
        service.get_rule(second_rule.id, current_user=first_user)

    assert caught_error.value.status_code == 404
