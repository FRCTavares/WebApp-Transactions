"""remove investment funding months

Revision ID: 5e9a2c7f1b40
Revises: 9c3e5a1f8b62
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5e9a2c7f1b40"
down_revision: Union[str, Sequence[str], None] = "9c3e5a1f8b62"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLE_NAME = "investment_funding_months"


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
            server_default="local-default-user",
        ),
        sa.Column("month", sa.String(length=7), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column(
            "manual_amount",
            sa.Numeric(precision=12, scale=2),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "cashback_rounding_amount",
            sa.Numeric(precision=12, scale=2),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "currency",
            sa.String(length=3),
            nullable=False,
            server_default="EUR",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.CheckConstraint(
            "length(month) = 7",
            name=f"ck_{TABLE_NAME}_month_length",
        ),
        sa.CheckConstraint(
            "manual_amount >= 0",
            name=f"ck_{TABLE_NAME}_manual_non_negative",
        ),
        sa.CheckConstraint(
            "cashback_rounding_amount >= 0",
            name=f"ck_{TABLE_NAME}_cashback_rounding_non_negative",
        ),
        sa.CheckConstraint(
            "length(currency) = 3",
            name=f"ck_{TABLE_NAME}_currency_length",
        ),
        sa.UniqueConstraint(
            "user_id",
            "month",
            "source",
            name=f"uq_{TABLE_NAME}_user_month_source",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f(f"ix_{TABLE_NAME}_user_month"),
        TABLE_NAME,
        ["user_id", "month"],
        unique=False,
    )
    op.create_index(
        op.f(f"ix_{TABLE_NAME}_user_source"),
        TABLE_NAME,
        ["user_id", "source"],
        unique=False,
    )
