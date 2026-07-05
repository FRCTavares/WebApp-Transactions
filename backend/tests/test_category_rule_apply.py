from datetime import date
from decimal import Decimal

from app.repositories.category_rule_repository import CategoryRuleRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.category_rule import CategoryRuleCreate
from app.schemas.transaction import TransactionCreate
from app.services.category_rule_service import CategoryRuleService

def test_apply_rules_to_existing_transactions_updates_uncategorised_rows(db_session):
    transaction_repository = TransactionRepository(db_session)
    category_rule_repository = CategoryRuleRepository(db_session)
    service = CategoryRuleService(
        category_rule_repository=category_rule_repository,
        transaction_repository=transaction_repository,
    )

    transaction = transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 4),
            description="AUCHAN PARQUE DAS NA",
            raw_description="AUCHAN PARQUE DAS NA | ID: test-id",
            amount=Decimal("10.86"),
            direction="out",
            source="trading212",
            account="Trading 212",
            currency="EUR",
            notes="Card debit",
        )
    )

    service.create_rule(
        CategoryRuleCreate(
            name="Auchan groceries",
            category="Groceries",
            match_text="AUCHAN",
            match_field="description",
            direction="out",
            source="trading212",
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
    assert updated_transaction.category == "Groceries"
