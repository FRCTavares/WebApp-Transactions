from fastapi import HTTPException, status

from app.models.description_rule import DescriptionRule
from app.models.transaction import Transaction
from app.repositories.description_rule_repository import DescriptionRuleRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.description_rule import (
    DescriptionRuleCreate,
    DescriptionRuleSuggestion,
    DescriptionRuleUpdate,
)


class DescriptionRuleService:
    def __init__(
        self,
        description_rule_repository: DescriptionRuleRepository,
        transaction_repository: TransactionRepository | None = None,
    ) -> None:
        self.description_rule_repository = description_rule_repository
        self.transaction_repository = transaction_repository

    def create_rule(self, rule_data: DescriptionRuleCreate) -> DescriptionRule:
        self._raise_if_duplicate_rule(rule_data)
        return self.description_rule_repository.create(rule_data)

    def list_rules(
        self,
        active_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> list[DescriptionRule]:
        return self.description_rule_repository.list(
            active_only=active_only,
            limit=limit,
            offset=offset,
        )

    def get_rule(self, rule_id: int) -> DescriptionRule:
        rule = self.description_rule_repository.get_by_id(rule_id)

        if rule is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Description rule not found",
            )

        return rule

    def update_rule(
        self,
        rule_id: int,
        rule_data: DescriptionRuleUpdate,
    ) -> DescriptionRule:
        rule = self.get_rule(rule_id)
        self._raise_if_duplicate_rule_update(rule, rule_data)
        return self.description_rule_repository.update(rule, rule_data)

    def delete_rule(self, rule_id: int) -> None:
        rule = self.get_rule(rule_id)
        self.description_rule_repository.delete(rule)

    def apply_rules_to_existing_transactions(self, limit: int = 1000) -> dict[str, int]:
        if self.transaction_repository is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Transaction repository is required to apply description rules",
            )

        transactions = self.transaction_repository.list_for_description_rule_application(
            limit=limit,
        )
        rules = self.description_rule_repository.list(active_only=True, limit=1000)
        updated_count = 0

        for transaction in transactions:
            cleaned_description = self._get_cleaned_description(transaction, rules)

            if cleaned_description is None:
                continue

            if transaction.description == cleaned_description:
                continue

            self.transaction_repository.update_description(
                transaction=transaction,
                description=cleaned_description,
            )
            updated_count += 1

        return {
            "checked": len(transactions),
            "updated": updated_count,
        }

    def get_rule_suggestions(
        self,
        direction: str | None = None,
        limit: int = 50,
    ) -> list[DescriptionRuleSuggestion]:
        if self.transaction_repository is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Transaction repository is required for description rule suggestions",
            )

        rows = self.transaction_repository.get_description_rule_suggestions(
            direction=direction,
            limit=limit,
        )

        return [
            DescriptionRuleSuggestion(
                raw_description=raw_description,
                description=description,
                source=source,
                direction=row_direction,
                count=count,
                total=total,
            )
            for raw_description, description, source, row_direction, count, total in rows
        ]

    def _get_cleaned_description(
        self,
        transaction: Transaction,
        rules: list[DescriptionRule],
    ) -> str | None:
        for rule in rules:
            if self._matches_rule(transaction, rule):
                return rule.cleaned_description

        return None

    def _raise_if_duplicate_rule(
        self,
        rule_data: DescriptionRuleCreate,
        exclude_rule_id: int | None = None,
    ) -> None:
        new_fingerprint = self._rule_fingerprint(
            match_text=rule_data.match_text,
            match_field=rule_data.match_field,
            direction=rule_data.direction,
            source=rule_data.source,
        )

        for existing_rule in self.description_rule_repository.list_all():
            if exclude_rule_id is not None and existing_rule.id == exclude_rule_id:
                continue

            existing_fingerprint = self._rule_fingerprint(
                match_text=existing_rule.match_text,
                match_field=existing_rule.match_field,
                direction=existing_rule.direction,
                source=existing_rule.source,
            )

            if existing_fingerprint == new_fingerprint:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An equivalent description rule already exists",
                )

    def _raise_if_duplicate_rule_update(
        self,
        rule: DescriptionRule,
        rule_data: DescriptionRuleUpdate,
    ) -> None:
        update_data = rule_data.model_dump(exclude_unset=True)

        candidate_rule_data = DescriptionRuleCreate(
            name=update_data.get("name", rule.name),
            cleaned_description=update_data.get(
                "cleaned_description",
                rule.cleaned_description,
            ),
            match_text=update_data.get("match_text", rule.match_text),
            match_field=update_data.get("match_field", rule.match_field),
            direction=update_data.get("direction", rule.direction),
            source=update_data.get("source", rule.source),
            is_active=update_data.get("is_active", rule.is_active),
        )

        self._raise_if_duplicate_rule(
            candidate_rule_data,
            exclude_rule_id=rule.id,
        )

    def _rule_fingerprint(
        self,
        match_text: str,
        match_field: str,
        direction: str | None,
        source: str | None,
    ) -> tuple[str, str, str | None, str | None]:
        return (
            self._normalise_rule_value(match_text) or "",
            self._normalise_rule_value(match_field) or "",
            self._normalise_rule_value(direction),
            self._normalise_rule_value(source),
        )

    def _normalise_rule_value(self, value: str | None) -> str | None:
        if value is None:
            return None

        return value.strip().casefold()

    def _matches_rule(
        self,
        transaction: Transaction,
        rule: DescriptionRule,
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
        transaction: Transaction,
        match_field: str,
    ) -> str | None:
        if match_field == "description":
            return transaction.description

        if match_field == "raw_description":
            return transaction.raw_description

        if match_field == "merchant":
            return transaction.merchant

        return None
