"""add investment funding indexes

Revision ID: d9e4f6a2b731
Revises: c4d2e6f8a130
Create Date: 2026-07-11 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d9e4f6a2b731"
down_revision: Union[str, Sequence[str], None] = "c4d2e6f8a130"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLE_NAME = "investment_funding_months"

INDEXES = (
    (
        "ix_investment_funding_months_user_id",
        ["user_id"],
    ),
    (
        "ix_investment_funding_months_month",
        ["month"],
    ),
    (
        "ix_investment_funding_months_source",
        ["source"],
    ),
)


def _table_exists() -> bool:
    return sa.inspect(op.get_bind()).has_table(TABLE_NAME)


def _existing_index_names() -> set[str]:
    if not _table_exists():
        return set()

    return {
        index["name"]
        for index in sa.inspect(op.get_bind()).get_indexes(TABLE_NAME)
        if index.get("name")
    }


def upgrade() -> None:
    if not _table_exists():
        raise RuntimeError(
            f"Required table does not exist: {TABLE_NAME}"
        )

    existing_indexes = _existing_index_names()

    for index_name, columns in INDEXES:
        if index_name not in existing_indexes:
            op.create_index(
                index_name,
                TABLE_NAME,
                columns,
                unique=False,
            )


def downgrade() -> None:
    existing_indexes = _existing_index_names()

    for index_name, _columns in reversed(INDEXES):
        if index_name in existing_indexes:
            op.drop_index(
                index_name,
                table_name=TABLE_NAME,
            )
