"""add pending signups

Revision ID: 7d1f2a8e6c40
Revises: 4c2e8a1d7f90
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7d1f2a8e6c40"
down_revision: Union[str, Sequence[str], None] = "4c2e8a1d7f90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pending_signups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "decided_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column("decided_by", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_pending_signups_email"),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'denied')",
            name="ck_pending_signups_status_known",
        ),
    )
    op.create_index(
        "ix_pending_signups_user_id",
        "pending_signups",
        ["user_id"],
    )
    op.create_index(
        "ix_pending_signups_email",
        "pending_signups",
        ["email"],
    )
    op.create_index(
        "ix_pending_signups_status",
        "pending_signups",
        ["status"],
    )


def downgrade() -> None:
    op.drop_table("pending_signups")
