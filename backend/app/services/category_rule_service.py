from fastapi import HTTPException, status

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
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

    def create_rule(
        self,
        rule_data: CategoryRuleCreate,
        current_user: CurrentUser | None = None,
    ) -> CategoryRule:
        user_id = self._get_user_id(current_user)
        self._raise_if_duplicate_rule(rule_data, user_id)
        return self.category_rule_repository.create(rule_data, user_id)

    def list_rules(
        self,
        active_only: bool = False,
        limit: int = 100,
        offset: int = 0,
        current_user: CurrentUser | None = None,
    ) -> list[CategoryRule]:
        user_id = self._get_user_id(current_user)

        return self.category_rule_repository.list(
            user_id=user_id,
            active_only=active_only,
            limit=limit,
            offset=offset,
        )

    def get_rule(
        self,
        rule_id: int,
        current_user: CurrentUser | None = None,
    ) -> CategoryRule:
        user_id = self._get_user_id(current_user)
        rule = self.category_rule_repository.get_by_id(rule_id, user_id)

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
        current_user: CurrentUser | None = None,
    ) -> CategoryRule:
        rule = self.get_rule(rule_id, current_user)
        user_id = self._get_user_id(current_user)
        self._raise_if_duplicate_rule_update(rule, rule_data, user_id)
        return self.category_rule_repository.update(rule, rule_data)

    def delete_rule(
        self,
        rule_id: int,
        current_user: CurrentUser | None = None,
    ) -> None:
        rule = self.get_rule(rule_id, current_user)
        self.category_rule_repository.delete(rule)

    def get_rule_suggestions(
        self,
        direction: str | None = None,
        limit: int = 20,
        current_user: CurrentUser | None = None,
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
        current_user: CurrentUser | None = None,
    ) -> tuple[str | None, str | None]:
        rules = self.category_rule_repository.list(
            user_id=self._get_user_id(current_user),
            active_only=True,
        )

        for rule in rules:
            if self._matches_rule(transaction, rule):
                return rule.category, rule.subcategory

        return None, None

    def apply_rules_to_existing_transactions(
        self,
        limit: int = 1000,
        current_user: CurrentUser | None = None,
    ) -> dict[str, int]:
        if self.transaction_repository is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Transaction repository is required to apply category rules",
            )

        transactions = self.transaction_repository.list_uncategorised(limit=limit)
        updated_count = 0

        for transaction in transactions:
            normalised_transaction = self._normalise_existing_transaction(transaction)
            category, subcategory = self.guess_category(
                normalised_transaction,
                current_user,
            )

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

    def _raise_if_duplicate_rule(
        self,
        rule_data: CategoryRuleCreate,
        user_id: str,
        exclude_rule_id: int | None = None,
    ) -> None:
        new_fingerprint = self._rule_fingerprint(
            match_text=rule_data.match_text,
            match_field=rule_data.match_field,
            direction=rule_data.direction,
            source=rule_data.source,
            category=rule_data.category,
            subcategory=rule_data.subcategory,
        )

        for existing_rule in self.category_rule_repository.list_all(user_id):
            if exclude_rule_id is not None and existing_rule.id == exclude_rule_id:
                continue

            existing_fingerprint = self._rule_fingerprint(
                match_text=existing_rule.match_text,
                match_field=existing_rule.match_field,
                direction=existing_rule.direction,
                source=existing_rule.source,
                category=existing_rule.category,
                subcategory=existing_rule.subcategory,
            )

            if existing_fingerprint == new_fingerprint:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An equivalent category rule already exists",
                )

    def _raise_if_duplicate_rule_update(
        self,
        rule: CategoryRule,
        rule_data: CategoryRuleUpdate,
        user_id: str,
    ) -> None:
        update_data = rule_data.model_dump(exclude_unset=True)

        candidate_rule_data = CategoryRuleCreate(
            name=update_data.get("name", rule.name),
            category=update_data.get("category", rule.category),
            subcategory=update_data.get("subcategory", rule.subcategory),
            match_text=update_data.get("match_text", rule.match_text),
            match_field=update_data.get("match_field", rule.match_field),
            direction=update_data.get("direction", rule.direction),
            source=update_data.get("source", rule.source),
            is_active=update_data.get("is_active", rule.is_active),
        )

        self._raise_if_duplicate_rule(
            candidate_rule_data,
            user_id=user_id,
            exclude_rule_id=rule.id,
        )


    def _get_user_id(self, current_user: CurrentUser | None) -> str:
        if current_user is None:
            return LOCAL_DEFAULT_USER_ID

        return current_user.id

    def _rule_fingerprint(
        self,
        match_text: str,
        match_field: str,
        direction: str | None,
        source: str | None,
        category: str,
        subcategory: str | None,
    ) -> tuple[str, str, str | None, str | None, str, str | None]:
        return (
            self._normalise_rule_value(match_text) or "",
            self._normalise_rule_value(match_field) or "",
            self._normalise_rule_value(direction),
            self._normalise_rule_value(source),
            self._normalise_rule_value(category) or "",
            self._normalise_rule_value(subcategory),
        )

    def _normalise_rule_value(self, value: str | None) -> str | None:
        if value is None:
            return None

        return value.strip().casefold()

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
