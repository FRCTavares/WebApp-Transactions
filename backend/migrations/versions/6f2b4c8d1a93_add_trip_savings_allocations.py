"""add trip savings allocations

Revision ID: 6f2b4c8d1a93
Revises: 5e9a2c7f1b40
Create Date: 2026-09-22 17:35:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6f2b4c8d1a93"
down_revision: Union[str, Sequence[str], None] = "5e9a2c7f1b40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLE_NAME = "trip_savings_allocations"


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column(
            "monthly_trip_savings_goal_eur",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="50.00",
        ),
    )

    op.create_table(
        TABLE_NAME,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=100), nullable=False),
        sa.Column("month", sa.String(length=7), nullable=False),
        sa.Column(
            "amount_eur",
            sa.Numeric(precision=12, scale=2),
            nullable=False,
        ),
        sa.Column(
            "goal_eur",
            sa.Numeric(precision=12, scale=2),
            nullable=False,
        ),
        sa.Column("source", sa.String(length=20), nullable=False),
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
            name="ck_trip_savings_allocations_month_length",
        ),
        sa.CheckConstraint(
            "amount_eur >= 0",
            name="ck_trip_savings_allocations_amount_non_negative",
        ),
        sa.CheckConstraint(
            "goal_eur > 0",
            name="ck_trip_savings_allocations_goal_positive",
        ),
        sa.CheckConstraint(
            "source IN ('default', 'override')",
            name="ck_trip_savings_allocations_source_known",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "month",
            name="uq_trip_savings_allocations_user_month",
        ),
    )

    op.create_index(
        op.f("ix_trip_savings_allocations_id"),
        TABLE_NAME,
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_trip_savings_allocations_user_id"),
        TABLE_NAME,
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_trip_savings_allocations_month"),
        TABLE_NAME,
        ["month"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_trip_savings_allocations_month"),
        table_name=TABLE_NAME,
    )
    op.drop_index(
        op.f("ix_trip_savings_allocations_user_id"),
        table_name=TABLE_NAME,
    )
    op.drop_index(
        op.f("ix_trip_savings_allocations_id"),
        table_name=TABLE_NAME,
    )
    op.drop_table(TABLE_NAME)
    op.drop_column(
        "user_preferences",
        "monthly_trip_savings_goal_eur",
    )
