"""add user preferences

Revision ID: 1a3d5e7f9b20
Revises: f7a3c9e2d814
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "1a3d5e7f9b20"
down_revision: Union[str, Sequence[str], None] = "f7a3c9e2d814"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_preferences",
        sa.Column("user_id", sa.String(length=100), nullable=False),
        sa.Column("locale", sa.String(length=10), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("time_zone", sa.String(length=64), nullable=False),
        sa.Column("date_format", sa.String(length=20), nullable=False),
        sa.Column("language", sa.String(length=5), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("user_preferences")
