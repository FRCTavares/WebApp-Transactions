from pydantic import BaseModel
from fastapi import HTTPException, status

from app.repositories.investment_event_repository import (
    InvestmentEventRepository,
)
from app.repositories.transaction_repository import TransactionRepository


TRANSACTION_LINK_FIELDS = (
    "transaction_id",
    "matched_transaction_id",
)


def validate_investment_transaction_links(
    event_data: BaseModel,
    *,
    transaction_repository: TransactionRepository | None,
    investment_event_repository: InvestmentEventRepository | None,
    user_id: str,
    existing_event_id: int | None = None,
    existing_transaction_id: int | None = None,
    existing_matched_transaction_id: int | None = None,
) -> None:
    """Validate explicitly supplied investment transaction relationships."""

    supplied_values = event_data.model_dump(exclude_unset=True)

    effective_transaction_id = supplied_values.get(
        "transaction_id",
        existing_transaction_id,
    )
    effective_matched_transaction_id = supplied_values.get(
        "matched_transaction_id",
        existing_matched_transaction_id,
    )

    create_links_mismatch = (
        existing_event_id is None
        and effective_transaction_id is not None
        and effective_matched_transaction_id is not None
        and effective_transaction_id
        != effective_matched_transaction_id
    )
    update_links_mismatch = (
        existing_event_id is not None
        and effective_transaction_id
        != effective_matched_transaction_id
    )

    if create_links_mismatch or update_links_mismatch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Transaction links must reference the same transaction"
            ),
        )

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

        if investment_event_repository is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Investment event repository is required",
            )

        existing_link = (
            investment_event_repository.get_by_transaction_link(
                transaction_id,
                user_id=user_id,
                exclude_event_id=existing_event_id,
            )
        )

        if existing_link is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Transaction is already linked to another "
                    "investment event"
                ),
            )
