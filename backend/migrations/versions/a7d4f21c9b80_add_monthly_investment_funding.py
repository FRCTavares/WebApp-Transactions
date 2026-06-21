"""add monthly investment funding

Revision ID: a7d4f21c9b80
Revises: 9b2c7d4e5f61
Create Date: 2026-06-21 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7d4f21c9b80"
down_revision: Union[str, Sequence[str], None] = "9b2c7d4e5f61"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "investment_funding_months",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=100), nullable=False),
        sa.Column("month", sa.String(length=7), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("manual_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column(
            "cashback_rounding_amount",
            sa.Numeric(precision=12, scale=2),
            nullable=False,
        ),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "length(month) = 7",
            name="ck_investment_funding_months_month_length",
        ),
        sa.CheckConstraint(
            "manual_amount >= 0",
            name="ck_investment_funding_months_manual_non_negative",
        ),
        sa.CheckConstraint(
            "cashback_rounding_amount >= 0",
            name="ck_investment_funding_months_cashback_rounding_non_negative",
        ),
        sa.CheckConstraint(
            "length(currency) = 3",
            name="ck_investment_funding_months_currency_length",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "month",
            "source",
            name="uq_investment_funding_months_user_month_source",
        ),
    )
    op.create_index(
        op.f("ix_investment_funding_months_id"),
        "investment_funding_months",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_investment_funding_months_user_month",
        "investment_funding_months",
        ["user_id", "month"],
        unique=False,
    )
    op.create_index(
        "ix_investment_funding_months_user_source",
        "investment_funding_months",
        ["user_id", "source"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_investment_funding_months_user_source",
        table_name="investment_funding_months",
    )
    op.drop_index(
        "ix_investment_funding_months_user_month",
        table_name="investment_funding_months",
    )
    op.drop_index(
        op.f("ix_investment_funding_months_id"),
        table_name="investment_funding_months",
    )
    op.drop_table("investment_funding_months")
