from pydantic import BaseModel
from fastapi import HTTPException, status

from app.repositories.transaction_repository import TransactionRepository


TRANSACTION_LINK_FIELDS = (
    "transaction_id",
    "matched_transaction_id",
)


def validate_investment_transaction_links(
    event_data: BaseModel,
    *,
    transaction_repository: TransactionRepository | None,
    user_id: str,
) -> None:
    """Validate explicitly supplied investment transaction relationships."""

    supplied_values = event_data.model_dump(exclude_unset=True)

    for field_name in TRANSACTION_LINK_FIELDS:
        if field_name not in supplied_values:
            continue

        transaction_id = supplied_values[field_name]

        if transaction_id is None:
            continue

        if transaction_repository is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Transaction repository is required",
            )

        transaction = transaction_repository.get_by_id(
            transaction_id,
            user_id=user_id,
        )

        if transaction is None:
            readable_field = field_name.replace("_", " ")

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{readable_field.capitalize()} not found",
            )
