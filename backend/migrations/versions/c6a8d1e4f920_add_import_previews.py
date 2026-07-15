"""add import previews

Revision ID: c6a8d1e4f920
Revises: f4b8c2d6e913
Create Date: 2026-07-15 10:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c6a8d1e4f920"
down_revision: Union[str, Sequence[str], None] = "f4b8c2d6e913"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "import_previews",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=100), nullable=False),
        sa.Column("mode", sa.String(length=40), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("file_sha256", sa.String(length=64), nullable=False),
        sa.Column("rows_total", sa.Integer(), nullable=False),
        sa.Column("rows_valid", sa.Integer(), nullable=False),
        sa.Column("rows_duplicates", sa.Integer(), nullable=False),
        sa.Column("rows_invalid", sa.Integer(), nullable=False),
        sa.Column("transactions_pending", sa.Integer(), nullable=False),
        sa.Column("investment_events_pending", sa.Integer(), nullable=False),
        sa.Column("owed_items_pending", sa.Integer(), nullable=False),
        sa.Column("wealth_snapshots_pending", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "rows_total >= 0",
            name="ck_import_previews_rows_total_non_negative",
        ),
        sa.CheckConstraint(
            "rows_valid >= 0",
            name="ck_import_previews_rows_valid_non_negative",
        ),
        sa.CheckConstraint(
            "rows_duplicates >= 0",
            name="ck_import_previews_rows_duplicates_non_negative",
        ),
        sa.CheckConstraint(
            "rows_invalid >= 0",
            name="ck_import_previews_rows_invalid_non_negative",
        ),
        sa.CheckConstraint(
            "transactions_pending >= 0",
            name="ck_import_previews_transactions_pending_non_negative",
        ),
        sa.CheckConstraint(
            "investment_events_pending >= 0",
            name="ck_import_previews_events_pending_non_negative",
        ),
        sa.CheckConstraint(
            "owed_items_pending >= 0",
            name="ck_import_previews_owed_pending_non_negative",
        ),
        sa.CheckConstraint(
            "wealth_snapshots_pending >= 0",
            name="ck_import_previews_wealth_pending_non_negative",
        ),
        sa.CheckConstraint(
            "length(file_sha256) = 64",
            name="ck_import_previews_sha256_length",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_import_previews_user_id",
        "import_previews",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_import_previews_mode",
        "import_previews",
        ["mode"],
        unique=False,
    )
    op.create_index(
        "ix_import_previews_source",
        "import_previews",
        ["source"],
        unique=False,
    )
    op.create_index(
        "ix_import_previews_user_created_at",
        "import_previews",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_import_previews_user_expires_at",
        "import_previews",
        ["user_id", "expires_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_import_previews_user_expires_at",
        table_name="import_previews",
    )
    op.drop_index(
        "ix_import_previews_user_created_at",
        table_name="import_previews",
    )
    op.drop_index(
        "ix_import_previews_source",
        table_name="import_previews",
    )
    op.drop_index(
        "ix_import_previews_mode",
        table_name="import_previews",
    )
    op.drop_index(
        "ix_import_previews_user_id",
        table_name="import_previews",
    )
    op.drop_table("import_previews")
