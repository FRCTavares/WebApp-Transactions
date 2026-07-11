"""remove category rules

Revision ID: c4d2e6f8a130
Revises: b8e1c3f4a920
Create Date: 2026-07-11 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4d2e6f8a130"
down_revision: Union[str, Sequence[str], None] = "b8e1c3f4a920"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLE_NAME = "category_rules"


def upgrade() -> None:
    op.drop_table(TABLE_NAME)


def downgrade() -> None:
    op.create_table(
        TABLE_NAME,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "user_id",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column(
            "subcategory",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "match_text",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "match_field",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "direction",
            sa.String(length=10),
            nullable=True,
        ),
        sa.Column(
            "source",
            sa.String(length=50),
            nullable=True,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    for column_name in (
        "id",
        "user_id",
        "category",
        "match_text",
        "direction",
        "source",
        "is_active",
    ):
        op.create_index(
            op.f(f"ix_{TABLE_NAME}_{column_name}"),
            TABLE_NAME,
            [column_name],
            unique=False,
        )
