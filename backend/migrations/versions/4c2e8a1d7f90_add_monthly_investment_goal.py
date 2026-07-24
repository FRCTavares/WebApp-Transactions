"""add monthly investment goal

Revision ID: 4c2e8a1d7f90
Revises: 913e77ab658e
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4c2e8a1d7f90"
down_revision: Union[str, Sequence[str], None] = "913e77ab658e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column(
            "monthly_investment_goal_eur",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="100.00",
        ),
    )


def downgrade() -> None:
    op.drop_column(
        "user_preferences",
        "monthly_investment_goal_eur",
    )
