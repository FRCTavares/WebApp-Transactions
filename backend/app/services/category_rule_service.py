from fastapi import HTTPException, status

from app.importers.base import NormalisedTransaction
from app.models.category_rule import CategoryRule
from app.models.transaction import Transaction
from app.repositories.category_rule_repository import CategoryRuleRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.category_rule import (
    CategoryRuleCreate,
    CategoryRuleSuggestion,
    CategoryRuleUpdate,
)


class CategoryRuleService:
    def __init__(
        self,
        category_rule_repository: CategoryRuleRepository,
        transaction_repository: TransactionRepository | None = None,
    ) -> None:
        self.category_rule_repository = category_rule_repository
        self.transaction_repository = transaction_repository

    def create_rule(self, rule_data: CategoryRuleCreate) -> CategoryRule:
        return self.category_rule_repository.create(rule_data)

    def list_rules(
        self,
        active_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CategoryRule]:
        return self.category_rule_repository.list(
            active_only=active_only,
            limit=limit,
            offset=offset,
        )

    def get_rule(self, rule_id: int) -> CategoryRule:
        rule = self.category_rule_repository.get_by_id(rule_id)

        if rule is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category rule not found",
            )

        return rule

    def update_rule(
        self,
        rule_id: int,
        rule_data: CategoryRuleUpdate,
    ) -> CategoryRule:
        rule = self.get_rule(rule_id)
        return self.category_rule_repository.update(rule, rule_data)

    def delete_rule(self, rule_id: int) -> None:
        rule = self.get_rule(rule_id)
        self.category_rule_repository.delete(rule)

    def get_rule_suggestions(
        self,
        direction: str | None = None,
        limit: int = 20,
    ) -> list[CategoryRuleSuggestion]:
        if self.transaction_repository is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Transaction repository is required for rule suggestions",
            )

        rows = self.transaction_repository.get_uncategorised_suggestions(
            direction=direction,
            limit=limit,
        )

        return [
            CategoryRuleSuggestion(
                description=description,
                source=source,
                direction=row_direction,
                count=count,
                total=total,
            )
            for description, source, row_direction, count, total in rows
        ]

    def guess_category(
        self,
        transaction: NormalisedTransaction,
    ) -> tuple[str | None, str | None]:
        rules = self.category_rule_repository.list(active_only=True)

        for rule in rules:
            if self._matches_rule(transaction, rule):
                return rule.category, rule.subcategory

        return None, None

    def apply_rules_to_existing_transactions(self, limit: int = 1000) -> dict[str, int]:
        if self.transaction_repository is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Transaction repository is required to apply category rules",
            )

        transactions = self.transaction_repository.list_uncategorised(limit=limit)
        updated_count = 0

        for transaction in transactions:
            normalised_transaction = self._normalise_existing_transaction(transaction)
            category, subcategory = self.guess_category(normalised_transaction)

            if category is None:
                continue

            self.transaction_repository.update_category(
                transaction=transaction,
                category=category,
                subcategory=subcategory,
            )
            updated_count += 1

        return {
            "checked": len(transactions),
            "updated": updated_count,
        }

    def _normalise_existing_transaction(
        self,
        transaction: Transaction,
    ) -> NormalisedTransaction:
        return NormalisedTransaction(
            date=transaction.date,
            raw_description=transaction.raw_description,
            description=transaction.description,
            amount=transaction.amount,
            direction=transaction.direction,
            source=transaction.source,
            account=transaction.account,
            currency=transaction.currency,
            external_id=transaction.external_id,
            notes=transaction.notes,
        )

    def _matches_rule(
        self,
        transaction: NormalisedTransaction,
        rule: CategoryRule,
    ) -> bool:
        if rule.direction is not None and rule.direction != transaction.direction:
            return False

        if rule.source is not None and rule.source != transaction.source:
            return False

        field_value = self._get_match_field_value(transaction, rule.match_field)

        if field_value is None:
            return False

        return rule.match_text.lower() in field_value.lower()

    def _get_match_field_value(
        self,
        transaction: NormalisedTransaction,
        match_field: str,
    ) -> str | None:
        if match_field == "description":
            return transaction.description

        if match_field == "raw_description":
            return transaction.raw_description

        if match_field == "merchant":
            return transaction.description

        return None
