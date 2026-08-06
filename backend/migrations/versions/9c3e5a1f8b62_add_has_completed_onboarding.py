"""add has_completed_onboarding to user_preferences

Revision ID: 9c3e5a1f8b62
Revises: 7d1f2a8e6c40
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9c3e5a1f8b62"
down_revision: Union[str, Sequence[str], None] = "7d1f2a8e6c40"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column(
            "has_completed_onboarding",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("user_preferences", "has_completed_onboarding")
