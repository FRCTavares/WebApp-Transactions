from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.importers.base import NormalisedTransaction
from app.repositories.category_rule_repository import CategoryRuleRepository
from app.schemas.category_rule import CategoryRuleCreate, CategoryRuleUpdate
from app.services.category_rule_service import CategoryRuleService


def test_category_rule_service_guesses_category(db_session):
    repository = CategoryRuleRepository(db_session)
    service = CategoryRuleService(repository)

    service.create_rule(
        CategoryRuleCreate(
            name="Auchan groceries",
            category="Groceries",
            subcategory="Supermarket",
            match_text="AUCHAN",
            match_field="description",
            direction="out",
            source="trading212",
            is_active=True,
        )
    )

    transaction = NormalisedTransaction(
        date=date(2026, 5, 4),
        raw_description="AUCHAN PARQUE DAS NA | ID: test-id",
        description="AUCHAN PARQUE DAS NA",
        amount=Decimal("10.86"),
        direction="out",
        source="trading212",
        account="Trading 212",
        currency="EUR",
        external_id="test-id",
        notes="Card debit",
    )

    category, subcategory = service.guess_category(transaction)

    assert category == "Groceries"
    assert subcategory == "Supermarket"


def test_category_rule_service_rejects_duplicate_rule(db_session):
    repository = CategoryRuleRepository(db_session)
    service = CategoryRuleService(repository)

    rule_data = CategoryRuleCreate(
        name="Auchan groceries",
        category="Groceries",
        subcategory="Supermarket",
        match_text="AUCHAN",
        match_field="description",
        direction="out",
        source="trading212",
        is_active=True,
    )

    service.create_rule(rule_data)

    with pytest.raises(HTTPException) as caught_error:
        service.create_rule(
            CategoryRuleCreate(
                name="Another name",
                category=" groceries ",
                subcategory=" supermarket ",
                match_text=" auchan ",
                match_field="description",
                direction="out",
                source="trading212",
                is_active=False,
            )
        )

    assert caught_error.value.status_code == 409


def test_category_rule_service_rejects_duplicate_rule_update(db_session):
    repository = CategoryRuleRepository(db_session)
    service = CategoryRuleService(repository)

    existing_rule = service.create_rule(
        CategoryRuleCreate(
            name="Auchan groceries",
            category="Groceries",
            subcategory="Supermarket",
            match_text="AUCHAN",
            match_field="description",
            direction="out",
            source="trading212",
            is_active=True,
        )
    )

    second_rule = service.create_rule(
        CategoryRuleCreate(
            name="Pingo Doce groceries",
            category="Groceries",
            subcategory="Supermarket",
            match_text="PINGO DOCE",
            match_field="description",
            direction="out",
            source="trading212",
            is_active=True,
        )
    )

    with pytest.raises(HTTPException) as caught_error:
        service.update_rule(
            second_rule.id,
            CategoryRuleUpdate(
                match_text=existing_rule.match_text,
            ),
        )

    assert caught_error.value.status_code == 409


def test_category_rules_are_isolated_by_user(db_session):
    from app.auth.current_user import CurrentUser

    repository = CategoryRuleRepository(db_session)
    service = CategoryRuleService(repository)

    first_user = CurrentUser(id="user-one")
    second_user = CurrentUser(id="user-two")

    first_rule_data = CategoryRuleCreate(
        name="Auchan groceries",
        category="Groceries",
        subcategory="Supermarket",
        match_text="AUCHAN",
        match_field="description",
        direction="out",
        source="trading212",
        is_active=True,
    )

    second_rule_data = CategoryRuleCreate(
        name="Auchan groceries other user",
        category="Groceries",
        subcategory="Supermarket",
        match_text="AUCHAN",
        match_field="description",
        direction="out",
        source="trading212",
        is_active=True,
    )

    first_rule = service.create_rule(first_rule_data, first_user)
    second_rule = service.create_rule(second_rule_data, second_user)

    assert [rule.id for rule in service.list_rules(current_user=first_user)] == [first_rule.id]
    assert [rule.id for rule in service.list_rules(current_user=second_user)] == [second_rule.id]

    with pytest.raises(HTTPException) as caught_error:
        service.get_rule(second_rule.id, first_user)

    assert caught_error.value.status_code == 404
