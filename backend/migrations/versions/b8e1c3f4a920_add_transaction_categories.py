"""add transaction categories

Revision ID: b8e1c3f4a920
Revises: a7d4f21c9b80
Create Date: 2026-07-10 20:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8e1c3f4a920"
down_revision: Union[str, Sequence[str], None] = "a7d4f21c9b80"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLE_NAME = "transaction_categories"


def upgrade() -> None:
    op.create_table(
        TABLE_NAME,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("direction", sa.String(length=10), nullable=False),
        sa.Column("cashflow_type", sa.String(length=30), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
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
            "direction IN ('in', 'out')",
            name="ck_transaction_categories_direction_known",
        ),
        sa.CheckConstraint(
            "cashflow_type IN ('income', 'expense', 'transfer')",
            name="ck_transaction_categories_cashflow_type_known",
        ),
        sa.CheckConstraint(
            "sort_order >= 0",
            name="ck_transaction_categories_sort_order_non_negative",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "name",
            "direction",
            "cashflow_type",
            name="uq_transaction_categories_user_name_direction_type",
        ),
    )

    op.create_index(
        op.f("ix_transaction_categories_id"),
        TABLE_NAME,
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transaction_categories_user_id"),
        TABLE_NAME,
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transaction_categories_name"),
        TABLE_NAME,
        ["name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transaction_categories_direction"),
        TABLE_NAME,
        ["direction"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transaction_categories_cashflow_type"),
        TABLE_NAME,
        ["cashflow_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transaction_categories_is_active"),
        TABLE_NAME,
        ["is_active"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transaction_categories_sort_order"),
        TABLE_NAME,
        ["sort_order"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_transaction_categories_sort_order"),
        table_name=TABLE_NAME,
    )
    op.drop_index(
        op.f("ix_transaction_categories_is_active"),
        table_name=TABLE_NAME,
    )
    op.drop_index(
        op.f("ix_transaction_categories_cashflow_type"),
        table_name=TABLE_NAME,
    )
    op.drop_index(
        op.f("ix_transaction_categories_direction"),
        table_name=TABLE_NAME,
    )
    op.drop_index(
        op.f("ix_transaction_categories_name"),
        table_name=TABLE_NAME,
    )
    op.drop_index(
        op.f("ix_transaction_categories_user_id"),
        table_name=TABLE_NAME,
    )
    op.drop_index(
        op.f("ix_transaction_categories_id"),
        table_name=TABLE_NAME,
    )
    op.drop_table(TABLE_NAME)
