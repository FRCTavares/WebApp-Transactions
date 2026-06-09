from datetime import date
from decimal import Decimal

from app.importers.base import NormalisedTransaction
from app.repositories.category_rule_repository import CategoryRuleRepository
from app.schemas.category_rule import CategoryRuleCreate
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
