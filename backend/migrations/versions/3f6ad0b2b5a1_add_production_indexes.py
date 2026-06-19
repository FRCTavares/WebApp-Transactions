"""add production indexes

Revision ID: 3f6ad0b2b5a1
Revises: 7ce5c0e3316b
Create Date: 2026-06-19 16:10:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "3f6ad0b2b5a1"
down_revision: Union[str, Sequence[str], None] = "7ce5c0e3316b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_transactions_user_date",
        "transactions",
        ["user_id", "date"],
        unique=False,
    )
    op.create_index(
        "ix_transactions_user_direction_date",
        "transactions",
        ["user_id", "direction", "date"],
        unique=False,
    )
    op.create_index(
        "ix_transactions_user_cashflow_type_date",
        "transactions",
        ["user_id", "cashflow_type", "date"],
        unique=False,
    )
    op.create_index(
        "ix_owed_items_user_status_person",
        "owed_items",
        ["user_id", "status", "person"],
        unique=False,
    )
    op.create_index(
        "ix_investment_events_user_date",
        "investment_events",
        ["user_id", "date"],
        unique=False,
    )
    op.create_index(
        "ix_investment_events_user_source_date",
        "investment_events",
        ["user_id", "source", "date"],
        unique=False,
    )
    op.create_index(
        "ix_wealth_snapshots_user_account_date",
        "wealth_snapshots",
        ["user_id", "account_id", "snapshot_date"],
        unique=False,
    )
    op.create_index(
        "ix_import_batches_user_imported_at",
        "import_batches",
        ["user_id", "imported_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_import_batches_user_imported_at", table_name="import_batches")
    op.drop_index(
        "ix_wealth_snapshots_user_account_date",
        table_name="wealth_snapshots",
    )
    op.drop_index(
        "ix_investment_events_user_source_date",
        table_name="investment_events",
    )
    op.drop_index("ix_investment_events_user_date", table_name="investment_events")
    op.drop_index("ix_owed_items_user_status_person", table_name="owed_items")
    op.drop_index(
        "ix_transactions_user_cashflow_type_date",
        table_name="transactions",
    )
    op.drop_index("ix_transactions_user_direction_date", table_name="transactions")
    op.drop_index("ix_transactions_user_date", table_name="transactions")
