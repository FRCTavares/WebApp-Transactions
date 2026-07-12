from fastapi import HTTPException, status

from app.auth.current_user import CurrentUser
from app.models.transaction_category import TransactionCategory
from app.repositories.transaction_category_repository import (
    TransactionCategoryRepository,
)
from app.schemas.transaction_category import (
    TransactionCategoryCreate,
    TransactionCategoryMigrationApply,
    TransactionCategoryMigrationApplyRead,
    TransactionCategoryMigrationPreviewRead,
    TransactionCategoryMigrationTransactionRead,
    TransactionCategoryRead,
    TransactionCategoryReplaceDeleteRead,
    TransactionCategoryUpdate,
    TransactionCategoryUsageRead,
)


class TransactionCategoryService:
    def __init__(
        self,
        repository: TransactionCategoryRepository,
    ) -> None:
        self.repository = repository

    def create_category(
        self,
        category_data: TransactionCategoryCreate,
        *,
        current_user: CurrentUser,
    ) -> TransactionCategory:
        user_id = current_user.id
        normalised_data = self._normalise_create(category_data)

        self._raise_if_duplicate(
            category_data=normalised_data,
            user_id=user_id,
        )

        return self.repository.create(normalised_data, user_id)

    def list_categories(
        self,
        active_only: bool = False,
        direction: str | None = None,
        cashflow_type: str | None = None,
        limit: int = 200,
        offset: int = 0,
        *,
        current_user: CurrentUser,
    ) -> list[TransactionCategory]:
        return self.repository.list(
            user_id=current_user.id,
            active_only=active_only,
            direction=direction,
            cashflow_type=cashflow_type,
            limit=limit,
            offset=offset,
        )

    def get_category(
        self,
        category_id: int,
        *,
        current_user: CurrentUser,
    ) -> TransactionCategory:
        category = self.repository.get_by_id(
            category_id,
            current_user.id,
        )

        if category is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction category not found",
            )

        return category

    def update_category(
        self,
        category_id: int,
        category_data: TransactionCategoryUpdate,
        *,
        current_user: CurrentUser,
    ) -> TransactionCategory:
        category = self.get_category(category_id, current_user=current_user)
        user_id = current_user.id
        candidate_data = self._get_update_candidate(
            category,
            category_data,
        )

        self._raise_if_duplicate(
            category_data=candidate_data,
            user_id=user_id,
            exclude_category_id=category.id,
        )

        return self.repository.update(
            category,
            self._normalise_update(category_data),
        )

    def get_migration_preview(
        self,
        category_id: int,
        *,
        current_user: CurrentUser,
    ) -> TransactionCategoryMigrationPreviewRead:
        category = self.get_category(category_id, current_user=current_user)
        transactions = self.repository.list_migration_transactions(category)

        replacement_categories = [
            replacement
            for replacement in self.repository.list(
                user_id=current_user.id,
                active_only=True,
                direction=category.direction,
                cashflow_type=category.cashflow_type,
                limit=500,
            )
            if replacement.id != category.id
        ]

        return TransactionCategoryMigrationPreviewRead(
            category=TransactionCategoryRead.model_validate(category),
            transactions=[
                TransactionCategoryMigrationTransactionRead(
                    id=transaction.id,
                    date=transaction.date,
                    description=transaction.description,
                    raw_description=transaction.raw_description,
                    merchant=transaction.merchant,
                    source=transaction.source,
                    account=transaction.account,
                    amount=str(transaction.amount),
                    currency=transaction.currency,
                )
                for transaction in transactions
            ],
            replacement_categories=[
                TransactionCategoryRead.model_validate(replacement)
                for replacement in replacement_categories
            ],
        )

    def apply_reviewed_migration(
        self,
        category_id: int,
        migration_data: TransactionCategoryMigrationApply,
        *,
        current_user: CurrentUser,
    ) -> TransactionCategoryMigrationApplyRead:
        category = self.get_category(category_id, current_user=current_user)
        affected_transactions = (
            self.repository.list_migration_transactions(category)
        )

        affected_ids = {
            transaction.id
            for transaction in affected_transactions
        }
        submitted_ids = [
            assignment.transaction_id
            for assignment in migration_data.transaction_assignments
        ]

        if len(submitted_ids) != len(set(submitted_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaction assignments contain duplicate IDs",
            )

        if set(submitted_ids) != affected_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Every affected transaction must have exactly "
                    "one replacement"
                ),
            )

        replacement_ids = {
            assignment.replacement_category_id
            for assignment in migration_data.transaction_assignments
        }

        replacements = {
            replacement_id: self.get_category(
                replacement_id,
                current_user=current_user,
            )
            for replacement_id in replacement_ids
        }

        for replacement in replacements.values():
            self._validate_replacement_category(
                category,
                replacement,
            )

        transaction_replacements = {
            assignment.transaction_id: replacements[
                assignment.replacement_category_id
            ].name
            for assignment in migration_data.transaction_assignments
        }

        transactions_updated = (
            self.repository.apply_reviewed_migration(
                category=category,
                transaction_replacements=transaction_replacements,
            )
        )

        return TransactionCategoryMigrationApplyRead(
            deleted_category_id=category.id,
            transactions_updated=transactions_updated,
        )

    def get_category_usage(
        self,
        category_id: int,
        *,
        current_user: CurrentUser,
    ) -> TransactionCategoryUsageRead:
        category = self.get_category(category_id, current_user=current_user)

        return TransactionCategoryUsageRead(
            transaction_count=self.repository.get_usage_count(category),
        )

    def delete_category(
        self,
        category_id: int,
        *,
        current_user: CurrentUser,
    ) -> None:
        category = self.get_category(category_id, current_user=current_user)
        usage = self.repository.get_usage_count(category)

        if usage > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Category is still used by transactions. "
                    "Choose replacements before deleting it."
                ),
            )

        self.repository.delete(category)

    def replace_and_delete_category(
        self,
        category_id: int,
        replacement_category_id: int,
        *,
        current_user: CurrentUser,
    ) -> TransactionCategoryReplaceDeleteRead:
        category = self.get_category(category_id, current_user=current_user)
        replacement = self.get_category(
            replacement_category_id,
            current_user=current_user,
        )

        self._validate_replacement_category(
            category,
            replacement,
        )

        transactions_updated = self.repository.replace_and_delete(
            category,
            replacement,
        )

        return TransactionCategoryReplaceDeleteRead(
            deleted_category_id=category.id,
            replacement_category_id=replacement.id,
            transactions_updated=transactions_updated,
        )

    def _validate_replacement_category(
        self,
        category: TransactionCategory,
        replacement: TransactionCategory,
    ) -> None:
        if replacement.id == category.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Replacement category must be different",
            )

        if not replacement.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Replacement category must be active",
            )

        if replacement.direction != category.direction:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Replacement category must use the same direction",
            )

        if replacement.cashflow_type != category.cashflow_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Replacement category must use the same "
                    "cashflow type"
                ),
            )

    def _raise_if_duplicate(
        self,
        category_data: TransactionCategoryCreate,
        user_id: str,
        exclude_category_id: int | None = None,
    ) -> None:
        candidate_fingerprint = self._fingerprint(
            category_data.name,
            category_data.direction,
            category_data.cashflow_type,
        )

        for existing_category in self.repository.list_all(user_id):
            if (
                exclude_category_id is not None
                and existing_category.id == exclude_category_id
            ):
                continue

            existing_fingerprint = self._fingerprint(
                existing_category.name,
                existing_category.direction,
                existing_category.cashflow_type,
            )

            if existing_fingerprint == candidate_fingerprint:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "An equivalent transaction category "
                        "already exists"
                    ),
                )

    def _get_update_candidate(
        self,
        category: TransactionCategory,
        category_data: TransactionCategoryUpdate,
    ) -> TransactionCategoryCreate:
        update_data = category_data.model_dump(exclude_unset=True)

        return TransactionCategoryCreate(
            name=update_data.get("name", category.name),
            direction=update_data.get(
                "direction",
                category.direction,
            ),
            cashflow_type=update_data.get(
                "cashflow_type",
                category.cashflow_type,
            ),
            is_active=update_data.get(
                "is_active",
                category.is_active,
            ),
            sort_order=update_data.get(
                "sort_order",
                category.sort_order,
            ),
        )

    def _normalise_create(
        self,
        category_data: TransactionCategoryCreate,
    ) -> TransactionCategoryCreate:
        return category_data.model_copy(
            update={"name": category_data.name.strip()}
        )

    def _normalise_update(
        self,
        category_data: TransactionCategoryUpdate,
    ) -> TransactionCategoryUpdate:
        update_data = category_data.model_dump(exclude_unset=True)

        if "name" in update_data and update_data["name"] is not None:
            update_data["name"] = update_data["name"].strip()

        return TransactionCategoryUpdate(**update_data)

    def _fingerprint(
        self,
        name: str,
        direction: str,
        cashflow_type: str,
    ) -> tuple[str, str, str]:
        return (
            name.strip().casefold(),
            direction,
            cashflow_type,
        )
