from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.repositories.description_rule_repository import DescriptionRuleRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.description_rule import DescriptionRuleCreate, DescriptionRuleUpdate
from app.schemas.transaction import TransactionCreate
from app.services.description_rule_service import DescriptionRuleService


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

    service.create_rule(rule_data)

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
            )
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
        )
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
        )
    )

    with pytest.raises(HTTPException) as caught_error:
        service.update_rule(
            second_rule.id,
            DescriptionRuleUpdate(
                match_text=existing_rule.match_text,
            ),
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
        )
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
        )
    )

    result = service.apply_rules_to_existing_transactions()

    updated_transaction = transaction_repository.get_by_id(transaction.id)

    assert result == {
        "checked": 1,
        "updated": 1,
    }
    assert updated_transaction is not None
    assert updated_transaction.description == "Too Good To Go"
    assert updated_transaction.raw_description == "TGTG aqwt6rwqmw7b0 LISBOA PT"


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
        )
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
        )
    )

    result = service.apply_rules_to_existing_transactions()

    updated_transaction = transaction_repository.get_by_id(transaction.id)

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
            )
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
        )
    )

    suggestions = service.get_rule_suggestions(direction="out")

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
