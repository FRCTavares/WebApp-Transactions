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


TABLE_NAME = "investment_funding_months"


def _table_exists() -> bool:
    bind = op.get_bind()
    return sa.inspect(bind).has_table(TABLE_NAME)


def _index_exists(index_name: str) -> bool:
    bind = op.get_bind()
    existing_indexes = sa.inspect(bind).get_indexes(TABLE_NAME)

    return any(index["name"] == index_name for index in existing_indexes)


def upgrade() -> None:
    if not _table_exists():
        op.create_table(
            TABLE_NAME,
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

    if not _index_exists("ix_investment_funding_months_id"):
        op.create_index(
            op.f("ix_investment_funding_months_id"),
            TABLE_NAME,
            ["id"],
            unique=False,
        )

    if not _index_exists("ix_investment_funding_months_user_month"):
        op.create_index(
            "ix_investment_funding_months_user_month",
            TABLE_NAME,
            ["user_id", "month"],
            unique=False,
        )

    if not _index_exists("ix_investment_funding_months_user_source"):
        op.create_index(
            "ix_investment_funding_months_user_source",
            TABLE_NAME,
            ["user_id", "source"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()

    if bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_investment_funding_months_user_source")
        op.execute("DROP INDEX IF EXISTS ix_investment_funding_months_user_month")
        op.execute("DROP INDEX IF EXISTS ix_investment_funding_months_id")
        op.execute(f"DROP TABLE IF EXISTS {TABLE_NAME}")
        return

    if not _table_exists():
        return

    if _index_exists("ix_investment_funding_months_user_source"):
        op.drop_index(
            "ix_investment_funding_months_user_source",
            table_name=TABLE_NAME,
        )

    if _index_exists("ix_investment_funding_months_user_month"):
        op.drop_index(
            "ix_investment_funding_months_user_month",
            table_name=TABLE_NAME,
        )

    if _index_exists("ix_investment_funding_months_id"):
        op.drop_index(
            op.f("ix_investment_funding_months_id"),
            table_name=TABLE_NAME,
        )

    op.drop_table(TABLE_NAME)
