from fastapi import HTTPException, status

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.models.transaction_category import TransactionCategory
from app.repositories.transaction_category_repository import (
    TransactionCategoryRepository,
)
from app.schemas.transaction_category import (
    TransactionCategoryCreate,
    TransactionCategoryUpdate,
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
        current_user: CurrentUser | None = None,
    ) -> TransactionCategory:
        user_id = self._get_user_id(current_user)
        normalised_data = self._normalise_create(category_data)

        self._raise_if_duplicate(
            category_data=normalised_data,
            user_id=user_id,
        )

        return self.repository.create(
            normalised_data,
            user_id,
        )

    def list_categories(
        self,
        active_only: bool = False,
        direction: str | None = None,
        cashflow_type: str | None = None,
        limit: int = 200,
        offset: int = 0,
        current_user: CurrentUser | None = None,
    ) -> list[TransactionCategory]:
        return self.repository.list(
            user_id=self._get_user_id(current_user),
            active_only=active_only,
            direction=direction,
            cashflow_type=cashflow_type,
            limit=limit,
            offset=offset,
        )

    def get_category(
        self,
        category_id: int,
        current_user: CurrentUser | None = None,
    ) -> TransactionCategory:
        category = self.repository.get_by_id(
            category_id,
            self._get_user_id(current_user),
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
        current_user: CurrentUser | None = None,
    ) -> TransactionCategory:
        category = self.get_category(category_id, current_user)
        user_id = self._get_user_id(current_user)
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

    def delete_category(
        self,
        category_id: int,
        current_user: CurrentUser | None = None,
    ) -> None:
        category = self.get_category(category_id, current_user)
        self.repository.delete(category)

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
                    detail="An equivalent transaction category already exists",
                )

    def _get_update_candidate(
        self,
        category: TransactionCategory,
        category_data: TransactionCategoryUpdate,
    ) -> TransactionCategoryCreate:
        update_data = category_data.model_dump(exclude_unset=True)

        return TransactionCategoryCreate(
            name=update_data.get("name", category.name),
            direction=update_data.get("direction", category.direction),
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

    def _get_user_id(
        self,
        current_user: CurrentUser | None,
    ) -> str:
        if current_user is None:
            return LOCAL_DEFAULT_USER_ID

        return current_user.id
